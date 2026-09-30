// End-to-end test against a deployed environment (dev only):
//   npm run e2e
//
// Uses your local AWS credentials to create two throwaway Cognito users
// (no emails are sent), signs in with SRP exactly like the app, exercises
// every route including a real S3 photo upload, and always deletes the users
// and their data at the end.

import { randomBytes } from 'node:crypto';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { ApiGatewayV2Client, GetApisCommand } from '@aws-sdk/client-apigatewayv2';
import cognitoIdentity from 'amazon-cognito-identity-js';

const { AuthenticationDetails, CognitoUser, CognitoUserPool } = cognitoIdentity;

const ENV = process.env.PAWPERS_ENV ?? 'dev';
const REGION = 'eu-west-2';
const PREFIX = `pawpers-${ENV}`;

if (ENV !== 'dev') {
  console.error(`Refusing to run against "${ENV}": the e2e test only runs against dev.`);
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const apigw = new ApiGatewayV2Client({ region: REGION });

// ---------------------------------------------------------------------------
// Discovery and users
// ---------------------------------------------------------------------------

async function discover() {
  const pools = await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  const poolId = pools.UserPools?.find((p) => p.Name === PREFIX)?.Id;
  if (!poolId) throw new Error(`User pool ${PREFIX} not found`);

  const clients = await cognito.send(new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 60 }));
  const clientId = clients.UserPoolClients?.find((c) => c.ClientName === `${PREFIX}-app`)?.ClientId;
  if (!clientId) throw new Error(`App client ${PREFIX}-app not found`);

  const apis = await apigw.send(new GetApisCommand({}));
  const apiUrl = apis.Items?.find((a) => a.Name === `${PREFIX}-api`)?.ApiEndpoint;
  if (!apiUrl) throw new Error(`API ${PREFIX}-api not found`);

  return { poolId, clientId, apiUrl };
}

interface TestUser {
  email: string;
  password: string;
}

async function createUser(poolId: string, label: string): Promise<TestUser> {
  const email = `e2e+${label}-${Date.now()}@example.com`;
  const password = `E2e-${randomBytes(12).toString('hex')}`;
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
    }),
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: email, Password: password, Permanent: true }),
  );
  return { email, password };
}

/** SRP sign-in, as the app does it. Returns the access token. */
function signIn(poolId: string, clientId: string, { email, password }: TestUser): Promise<string> {
  const user = new CognitoUser({
    Username: email,
    Pool: new CognitoUserPool({ UserPoolId: poolId, ClientId: clientId }),
  });
  return new Promise((resolve, reject) =>
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (session) => resolve(session.getAccessToken().getJwtToken()),
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('Unexpected new-password challenge')),
    }),
  );
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function client(apiUrl: string, token: string | null) {
  return async (method: string, path: string, body?: unknown): Promise<{ status: number; body: Json }> => {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : undefined };
  };
}

async function uploadToS3(upload: { url: string; fields: Record<string, string> }, bytes: Uint8Array) {
  const form = new FormData();
  for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
  const res = await fetch(upload.url, { method: 'POST', body: form });
  return { status: res.status, text: await res.text() };
}

// A 1x1 JPEG. S3 checks the declared Content-Type and size, not the pixels.
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

let passed = 0;
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}`);
    throw err;
  }
}

function expect(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(`${message}${detail === undefined ? '' : `\n    got: ${JSON.stringify(detail)}`}`);
}

async function run() {
  const { poolId, clientId, apiUrl } = await discover();
  console.log(`E2E against ${PREFIX}: ${apiUrl}\n`);

  const users: TestUser[] = [];
  const cleanups: (() => Promise<unknown>)[] = [];
  try {
    const alice = await createUser(poolId, 'alice');
    users.push(alice);
    const bob = await createUser(poolId, 'bob');
    users.push(bob);

    let aliceToken = '';
    let bobToken = '';
    await step('signs in with SRP and gets access tokens', async () => {
      aliceToken = await signIn(poolId, clientId, alice);
      bobToken = await signIn(poolId, clientId, bob);
    });

    const anon = client(apiUrl, null);
    const api = client(apiUrl, aliceToken);
    const bobApi = client(apiUrl, bobToken);
    cleanups.push(async () => {
      for (const c of [api, bobApi]) {
        const { body } = await c('GET', '/pets');
        for (const p of body?.pets ?? []) await c('DELETE', `/pets/${p.id}`);
      }
    });

    await step('rejects requests without a token (401)', async () => {
      const r = await anon('GET', '/pets');
      expect(r.status === 401, 'expected 401', r);
    });

    await step('rejects a garbage token (401)', async () => {
      const r = await client(apiUrl, 'not-a-jwt')('GET', '/pets');
      expect(r.status === 401, 'expected 401', r);
    });

    await step('new user has no pets', async () => {
      const r = await api('GET', '/pets');
      expect(r.status === 200 && r.body.pets.length === 0, 'expected empty list', r);
    });

    await step('validates input (bad microchip -> 400)', async () => {
      const r = await api('POST', '/pets', { name: 'Rex', species: 'Dog', chip: '123' });
      expect(r.status === 400 && r.body.details?.[0]?.path === 'chip', 'expected 400 on chip', r);
    });

    let petId = '';
    await step('creates a pet', async () => {
      const r = await api('POST', '/pets', {
        name: 'E2E Rex',
        species: 'Dog',
        breed: 'Collie',
        dob: '2025-06-01',
        chip: '933012400146699',
        weightKg: 18.25,
      });
      expect(
        r.status === 201 && r.body.id && r.body.breed === 'Collie' && r.body.weightKg === 18.3,
        'expected 201 pet with weight rounded to 18.3',
        r,
      );
      petId = r.body.id;
    });

    await step('clears a field with an empty string', async () => {
      const r = await api('PATCH', `/pets/${petId}`, { breed: '' });
      expect(r.status === 200 && r.body.breed === null && r.body.name === 'E2E Rex', 'expected breed cleared', r);
    });

    await step("another user can't read, edit or delete the pet (404)", async () => {
      const get = await bobApi('GET', `/pets/${petId}`);
      const patch = await bobApi('PATCH', `/pets/${petId}`, { name: 'Stolen' });
      const del = await bobApi('DELETE', `/pets/${petId}`);
      const vax = await bobApi('POST', `/pets/${petId}/vaccinations`, { type: 'Rabies', given: '2026-01-01' });
      expect(
        [get, patch, del, vax].every((r) => r.status === 404),
        'expected 404s',
        [get.status, patch.status, del.status, vax.status],
      );
      const list = await bobApi('GET', '/pets');
      expect(list.body.pets.length === 0, "bob's list should be empty", list);
    });

    let vaccinationId = '';
    await step('adds a vaccination', async () => {
      const r = await api('POST', `/pets/${petId}/vaccinations`, {
        type: 'Rabies',
        given: '2026-03-01',
        expires: '2029-03-01',
        manufacturer: 'Nobivac',
        lotNumber: 'E2E-LOT-1',
      });
      expect(
        r.status === 201 && r.body.id && r.body.manufacturer === 'Nobivac' && r.body.lotNumber === 'E2E-LOT-1',
        'expected 201 vaccination with manufacturer and lot number',
        r,
      );
      vaccinationId = r.body.id;
    });

    await step('rejects an expiry before the stored date given (400)', async () => {
      const r = await api('PATCH', `/pets/${petId}/vaccinations/${vaccinationId}`, { expires: '2026-01-01' });
      expect(r.status === 400, 'expected 400', r);
    });

    await step('updates a vaccination', async () => {
      const r = await api('PATCH', `/pets/${petId}/vaccinations/${vaccinationId}`, { vet: 'Village Vets' });
      expect(r.status === 200 && r.body.vet === 'Village Vets' && r.body.expires === '2029-03-01', 'expected update', r);
    });

    let photoKey = '';
    await step('uploads a photo via presigned POST', async () => {
      const start = await api('POST', `/pets/${petId}/photo/upload`);
      expect(start.status === 201 && start.body.url, 'expected presigned POST', start);
      const up = await uploadToS3(start.body, TINY_JPEG);
      expect(up.status === 204, 'expected S3 204', up);
      photoKey = start.body.key;
    });

    await step('S3 rejects an oversized upload', async () => {
      const start = await api('POST', `/pets/${petId}/photo/upload`);
      const up = await uploadToS3(start.body, new Uint8Array(start.body.maxBytes + 1));
      expect(up.status === 400 && up.text.includes('EntityTooLarge'), 'expected EntityTooLarge', up.status);
    });

    await step("refuses to attach another user's upload", async () => {
      const r = await bobApi('PUT', `/pets/${petId}/photo`, { key: photoKey });
      expect(r.status === 400, 'expected 400', r);
    });

    let photoUrl = '';
    await step('confirms the photo and sets photoUpdatedAt', async () => {
      const r = await api('PUT', `/pets/${petId}/photo`, { key: photoKey });
      expect(r.status === 200 && r.body.photoUrl && r.body.photoUpdatedAt, 'expected photo set', r);
      photoUrl = r.body.photoUrl;
    });

    await step('downloads the photo from its presigned URL', async () => {
      const res = await fetch(photoUrl);
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(res.status === 200 && Buffer.from(bytes).equals(TINY_JPEG), 'expected same bytes', res.status);
    });

    await step('lists the pet with its vaccination and photo', async () => {
      const r = await api('GET', '/pets');
      const pet = r.body.pets?.[0];
      expect(
        r.status === 200 && r.body.pets.length === 1 && pet.vaccinations.length === 1 && pet.photoUrl,
        'expected one pet with vaccination and photo',
        r,
      );
    });

    await step('removes the photo', async () => {
      const del = await api('DELETE', `/pets/${petId}/photo`);
      const r = await api('GET', `/pets/${petId}`);
      expect(del.status === 204 && r.body.photoUrl === null && r.body.photoUpdatedAt === null, 'expected no photo', r);
      const res = await fetch(photoUrl);
      expect(res.status === 403 || res.status === 404, 'expected photo object deleted', res.status);
    });

    await step('deletes the vaccination', async () => {
      const r = await api('DELETE', `/pets/${petId}/vaccinations/${vaccinationId}`);
      expect(r.status === 204, 'expected 204', r);
    });

    await step('deletes the pet', async () => {
      const del = await api('DELETE', `/pets/${petId}`);
      const get = await api('GET', `/pets/${petId}`);
      expect(del.status === 204 && get.status === 404, 'expected deleted', [del.status, get.status]);
    });
  } finally {
    for (const c of cleanups) await c().catch((e) => console.warn('cleanup failed:', e));
    for (const u of users) {
      await cognito
        .send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: u.email }))
        .catch((e) => console.warn(`could not delete ${u.email}:`, e));
    }
    console.log(`\nCleaned up ${users.length} test user(s).`);
  }
}

run()
  .then(() => console.log(`All ${passed} checks passed.`))
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err);
    process.exitCode = 1;
  });

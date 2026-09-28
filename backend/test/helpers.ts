import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

export const USER = '11111111-2222-3333-4444-555555555555';
export const PET = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
export const VAX = 'ffffffff-0000-1111-2222-333333333333';

process.env.TABLE_NAME = 'pawpers-test';
process.env.PHOTOS_BUCKET = 'pawpers-test-photos';
process.env.AWS_REGION = 'eu-west-2';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

export function event(
  routeKey: string,
  opts: { params?: Record<string, string>; body?: unknown; sub?: string | null } = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  const sub = opts.sub === undefined ? USER : opts.sub;
  return {
    routeKey,
    pathParameters: opts.params,
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
    isBase64Encoded: false,
    requestContext: {
      authorizer: { jwt: { claims: sub === null ? {} : { sub }, scopes: [] } },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;
}

export function parse(res: unknown): { statusCode: number; body: any } {
  const r = res as { statusCode: number; body?: string };
  return { statusCode: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
}

export const petItem = (overrides: Record<string, unknown> = {}) => ({
  PK: `USER#${USER}`,
  SK: `PET#${PET}`,
  entity: 'pet',
  id: PET,
  name: 'Bramble',
  species: 'Dog',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const vaccinationItem = (overrides: Record<string, unknown> = {}) => ({
  PK: `USER#${USER}`,
  SK: `PET#${PET}#VAX#${VAX}`,
  entity: 'vaccination',
  id: VAX,
  petId: PET,
  type: 'Rabies',
  given: '2026-03-01',
  expires: '2029-03-01',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

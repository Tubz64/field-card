import { beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { PET, USER, VAX, event, parse, petItem, vaccinationItem } from './helpers.js';
import { handler, routeKeys, routes } from '../src/api/index.js';

const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);

beforeEach(() => {
  ddb.reset();
  s3.reset();
});

const call = async (...args: Parameters<typeof event>) => parse(await handler(event(...args)));

describe('routing and auth', () => {
  it('has a handler for exactly the routes Terraform deploys', () => {
    expect(Object.keys(routes).sort()).toEqual([...routeKeys].sort());
  });

  it('rejects a request without a user', async () => {
    expect((await call('GET /pets', { sub: null })).statusCode).toBe(401);
  });

  it('returns 404 for an unknown route', async () => {
    expect((await call('GET /nope')).statusCode).toBe(404);
  });

  it('returns 400 for a malformed JSON body', async () => {
    expect((await call('POST /pets', { body: '{not json' })).statusCode).toBe(400);
  });

  it('only ever queries the signed-in user\'s partition', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    await call('GET /pets');
    const input = ddb.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(input.ExpressionAttributeValues?.[':pk']).toBe(`USER#${USER}`);
  });
});

describe('pets', () => {
  it('lists pets with their vaccinations nested', async () => {
    ddb.on(QueryCommand).resolves({ Items: [petItem(), vaccinationItem()] });
    const { statusCode, body } = await call('GET /pets');
    expect(statusCode).toBe(200);
    expect(body.pets).toHaveLength(1);
    expect(body.pets[0]).toMatchObject({ id: PET, name: 'Bramble', breed: null, photoUrl: null });
    expect(body.pets[0].vaccinations).toEqual([expect.objectContaining({ id: VAX, type: 'Rabies' })]);
  });

  it('includes a signed photo URL when the pet has a photo', async () => {
    const photoKey = `users/${USER}/pets/${PET}/${VAX}.jpg`;
    ddb.on(QueryCommand).resolves({ Items: [petItem({ photoKey, photoUpdatedAt: '2026-05-01T00:00:00.000Z' })] });
    const { body } = await call('GET /pets');
    expect(body.pets[0].photoUrl).toContain(photoKey);
    expect(body.pets[0].photoUrl).toContain('X-Amz-Signature=');
    expect(body.pets[0].photoUpdatedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('creates a pet without storing empty optional fields', async () => {
    ddb.on(PutCommand).resolves({});
    const { statusCode, body } = await call('POST /pets', { body: { name: 'Bramble', species: 'Dog', breed: '' } });
    expect(statusCode).toBe(201);
    expect(body).toMatchObject({ name: 'Bramble', breed: null, vaccinations: [] });
    const item = ddb.commandCalls(PutCommand)[0]!.args[0].input.Item!;
    expect(item).not.toHaveProperty('breed');
    expect(item.PK).toBe(`USER#${USER}`);
  });

  it('returns 404 when updating a pet that does not exist', async () => {
    ddb.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const { statusCode } = await call('PATCH /pets/{petId}', { params: { petId: PET }, body: { name: 'X' } });
    expect(statusCode).toBe(404);
  });

  it('clears fields sent as null and leaves the rest', async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: petItem() });
    ddb.on(QueryCommand).resolves({ Items: [petItem()] });
    await call('PATCH /pets/{petId}', { params: { petId: PET }, body: { breed: null, name: 'Bramble' } });
    const input = ddb.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(input.UpdateExpression).toBe('SET #updatedAt = :updatedAt, #name = :name REMOVE #breed');
  });

  it('deletes the pet, its vaccinations and its photos', async () => {
    ddb.on(QueryCommand).resolves({ Items: [petItem(), vaccinationItem()] });
    ddb.on(BatchWriteCommand).resolves({});
    s3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: `users/${USER}/pets/${PET}/a.jpg` }] });
    s3.on(DeleteObjectsCommand).resolves({});
    const { statusCode } = await call('DELETE /pets/{petId}', { params: { petId: PET } });
    expect(statusCode).toBe(204);
    const deletes = ddb.commandCalls(BatchWriteCommand)[0]!.args[0].input.RequestItems!['pawpers-test']!;
    expect(deletes).toHaveLength(2);
    expect(s3.commandCalls(ListObjectsV2Command)[0]!.args[0].input.Prefix).toBe(`users/${USER}/pets/${PET}/`);
  });

  it('returns 404 when deleting a pet that does not exist', async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    expect((await call('DELETE /pets/{petId}', { params: { petId: PET } })).statusCode).toBe(404);
    expect(s3.commandCalls(ListObjectsV2Command)).toHaveLength(0);
  });
});

describe('vaccinations', () => {
  it('returns 404 when the pet does not exist', async () => {
    ddb.on(TransactWriteCommand).rejects(new TransactionCanceledException({ message: 'x', $metadata: {} }));
    const { statusCode } = await call('POST /pets/{petId}/vaccinations', {
      params: { petId: PET },
      body: { type: 'Rabies', given: '2026-03-01' },
    });
    expect(statusCode).toBe(404);
  });

  it('rejects an expiry that would fall before the stored date given', async () => {
    ddb.on(UpdateCommand).rejects(
      new ConditionalCheckFailedException({ message: 'x', $metadata: {}, Item: { given: { S: '2026-03-01' } } }),
    );
    const { statusCode, body } = await call('PATCH /pets/{petId}/vaccinations/{vaccinationId}', {
      params: { petId: PET, vaccinationId: VAX },
      body: { expires: '2026-01-01' },
    });
    expect(statusCode).toBe(400);
    expect(body.details[0].path).toBe('expires');
  });

  it('returns 404 when deleting a vaccination that does not exist', async () => {
    ddb.on(DeleteCommand).rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    const { statusCode } = await call('DELETE /pets/{petId}/vaccinations/{vaccinationId}', {
      params: { petId: PET, vaccinationId: VAX },
    });
    expect(statusCode).toBe(404);
  });
});

describe('photos', () => {
  it('issues a presigned POST limited to this pet and to JPEGs', async () => {
    ddb.on(QueryCommand).resolves({ Items: [petItem()] });
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    ddb.on(GetCommand).resolves({ Item: petItem() });
    const { statusCode, body } = await call('POST /pets/{petId}/photo/upload', { params: { petId: PET } });
    expect(statusCode).toBe(201);
    expect(body.key).toMatch(new RegExp(`^users/${USER}/pets/${PET}/[0-9a-f-]{36}\\.jpg$`));
    expect(body.fields['Content-Type']).toBe('image/jpeg');
    const policy = JSON.parse(Buffer.from(body.fields.Policy, 'base64').toString());
    expect(policy.conditions).toContainEqual(['content-length-range', 1, 5 * 1024 * 1024]);
  });

  it('refuses to attach a key from another user or pet', async () => {
    const { statusCode } = await call('PUT /pets/{petId}/photo', {
      params: { petId: PET },
      body: { key: `users/someone-else/pets/${PET}/${VAX}.jpg` },
    });
    expect(statusCode).toBe(400);
    expect(s3.commandCalls(HeadObjectCommand)).toHaveLength(0);
  });

  it('refuses to attach a photo that was never uploaded', async () => {
    s3.on(HeadObjectCommand).rejects(Object.assign(new Error('NotFound'), { name: 'NotFound' }));
    const { statusCode } = await call('PUT /pets/{petId}/photo', {
      params: { petId: PET },
      body: { key: `users/${USER}/pets/${PET}/${VAX}.jpg` },
    });
    expect(statusCode).toBe(400);
  });

  it('records photoUpdatedAt and deletes the previous photo', async () => {
    const oldKey = `users/${USER}/pets/${PET}/00000000-0000-0000-0000-000000000000.jpg`;
    const newKey = `users/${USER}/pets/${PET}/${VAX}.jpg`;
    s3.on(HeadObjectCommand).resolves({});
    s3.on(DeleteObjectCommand).resolves({});
    ddb.on(UpdateCommand).resolves({ Attributes: petItem({ photoKey: oldKey }) });
    ddb.on(QueryCommand).resolves({ Items: [petItem({ photoKey: newKey, photoUpdatedAt: '2026-09-26T00:00:00.000Z' })] });
    const { statusCode, body } = await call('PUT /pets/{petId}/photo', { params: { petId: PET }, body: { key: newKey } });
    expect(statusCode).toBe(200);
    expect(body.photoUpdatedAt).toBe('2026-09-26T00:00:00.000Z');
    expect(ddb.commandCalls(UpdateCommand)[0]!.args[0].input.UpdateExpression).toContain('photoUpdatedAt = :now');
    expect(s3.commandCalls(DeleteObjectCommand)[0]!.args[0].input.Key).toBe(oldKey);
  });
});

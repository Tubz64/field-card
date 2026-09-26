import { randomUUID } from 'node:crypto';
import { DeleteCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { ddb, tableName } from '../lib/aws.js';
import { json, noContent, notFound } from '../lib/http.js';
import {
  petSk,
  toVaccination,
  userPk,
  vaccinationSk,
  type VaccinationItem,
} from '../lib/model.js';
import { buildUpdate, compact } from '../lib/store.js';
import type { RouteContext } from '../lib/types.js';
import { createVaccinationSchema, updateVaccinationSchema } from '../lib/validation.js';

const ids = (ctx: RouteContext) => ({
  petId: ctx.params.petId ?? '',
  vaccinationId: ctx.params.vaccinationId ?? '',
});

export async function createVaccination(ctx: RouteContext) {
  const input = createVaccinationSchema.parse(ctx.body);
  const { petId } = ids(ctx);
  const now = new Date().toISOString();
  const id = randomUUID();
  const item: VaccinationItem = compact({
    PK: userPk(ctx.userId),
    SK: vaccinationSk(petId, id),
    entity: 'vaccination' as const,
    id,
    petId,
    ...input,
    createdAt: now,
    updatedAt: now,
  }) as VaccinationItem;
  try {
    // Only write the vaccination if the pet exists (and belongs to this user).
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: tableName(),
              Key: { PK: userPk(ctx.userId), SK: petSk(petId) },
              ConditionExpression: 'attribute_exists(SK)',
            },
          },
          { Put: { TableName: tableName(), Item: item } },
        ],
      }),
    );
  } catch (err) {
    if (err instanceof TransactionCanceledException) throw notFound('Pet');
    throw err;
  }
  return json(201, toVaccination(item));
}

export async function updateVaccination(ctx: RouteContext) {
  const patch = updateVaccinationSchema.parse(ctx.body);
  const { petId, vaccinationId } = ids(ctx);
  const update = buildUpdate(patch, new Date().toISOString());
  // A patch that sets only one date must still keep expires >= given.
  const dateGuard =
    patch.expires && !patch.given
      ? ' AND (attribute_not_exists(given) OR given <= :expires)'
      : patch.given && patch.expires === undefined
        ? ' AND (attribute_not_exists(expires) OR expires >= :given)'
        : '';
  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: userPk(ctx.userId), SK: vaccinationSk(petId, vaccinationId) },
        ConditionExpression: `attribute_exists(SK)${dateGuard}`,
        ReturnValues: 'ALL_NEW',
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
        ...update,
      }),
    );
    return json(200, toVaccination(Attributes as VaccinationItem));
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      if (err.Item) {
        return json(400, {
          message: 'Invalid request',
          details: [{ path: 'expires', message: 'Expiry must be on or after the date given' }],
        });
      }
      throw notFound('Vaccination');
    }
    throw err;
  }
}

export async function deleteVaccination(ctx: RouteContext) {
  const { petId, vaccinationId } = ids(ctx);
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { PK: userPk(ctx.userId), SK: vaccinationSk(petId, vaccinationId) },
        ConditionExpression: 'attribute_exists(SK)',
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw notFound('Vaccination');
    throw err;
  }
  return noContent();
}

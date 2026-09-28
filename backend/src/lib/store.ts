import {
  BatchWriteCommand,
  GetCommand,
  QueryCommand,
  type BatchWriteCommandInput,
  type BatchWriteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { ddb, tableName } from './aws.js';
import { notFound } from './http.js';
import { petSk, userPk, type Item, type PetItem, type VaccinationItem } from './model.js';

/** All items under a key prefix for one user, following pagination. */
async function queryPrefix(userId: string, prefix: string): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': userPk(userId), ':prefix': prefix },
        ExclusiveStartKey,
      }),
    );
    items.push(...((page.Items ?? []) as Item[]));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export const queryUserItems = (userId: string) => queryPrefix(userId, 'PET#');

/** A pet and its vaccinations, or 404. */
export async function queryPet(
  userId: string,
  petId: string,
): Promise<{ pet: PetItem; vaccinations: VaccinationItem[]; items: Item[] }> {
  const items = await queryPrefix(userId, petSk(petId));
  const pet = items.find((i): i is PetItem => i.entity === 'pet' && i.id === petId);
  if (!pet) throw notFound('Pet');
  const vaccinations = items.filter(
    (i): i is VaccinationItem => i.entity === 'vaccination' && i.petId === petId,
  );
  return { pet, vaccinations, items };
}

export async function getPetItem(userId: string, petId: string): Promise<PetItem> {
  const { Item } = await ddb.send(
    new GetCommand({ TableName: tableName(), Key: { PK: userPk(userId), SK: petSk(petId) } }),
  );
  if (!Item) throw notFound('Pet');
  return Item as PetItem;
}

/** Deletes items in batches of 25, retrying any the service leaves unprocessed. */
export async function deleteItems(items: Pick<Item, 'PK' | 'SK'>[]): Promise<void> {
  const table = tableName();
  for (let i = 0; i < items.length; i += 25) {
    let requests: BatchWriteCommandInput['RequestItems'] = {
      [table]: items.slice(i, i + 25).map(({ PK, SK }) => ({ DeleteRequest: { Key: { PK, SK } } })),
    };
    for (let attempt = 0; requests && Object.keys(requests).length > 0; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      if (attempt > 5) throw new Error('BatchWrite left unprocessed items after retries');
      const res: BatchWriteCommandOutput = await ddb.send(
        new BatchWriteCommand({ RequestItems: requests }),
      );
      requests = res.UnprocessedItems;
    }
  }
}

/**
 * Builds a DynamoDB UPDATE expression from a patch: null clears (REMOVE),
 * anything else is SET. updatedAt is always set.
 */
export function buildUpdate(patch: Record<string, unknown>, now: string) {
  const set: string[] = ['#updatedAt = :updatedAt'];
  const remove: string[] = [];
  const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const values: Record<string, unknown> = { ':updatedAt': now };
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    names[`#${field}`] = field;
    if (value === null) {
      remove.push(`#${field}`);
    } else {
      set.push(`#${field} = :${field}`);
      values[`:${field}`] = value;
    }
  }
  return {
    UpdateExpression: `SET ${set.join(', ')}${remove.length ? ` REMOVE ${remove.join(', ')}` : ''}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

/** Drops null/undefined so optional fields are simply absent on new items. */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as T;
}

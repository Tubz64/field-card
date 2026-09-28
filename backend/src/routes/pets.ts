import { randomUUID } from 'node:crypto';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ddb, tableName } from '../lib/aws.js';
import { json, noContent, notFound } from '../lib/http.js';
import { groupPets, petSk, toPet, userPk, type PetItem } from '../lib/model.js';
import { deletePetPhotos, photoUrl } from '../lib/photos.js';
import { buildUpdate, compact, deleteItems, queryPet, queryUserItems } from '../lib/store.js';
import type { RouteContext } from '../lib/types.js';
import { createPetSchema, updatePetSchema } from '../lib/validation.js';

const petId = (ctx: RouteContext) => ctx.params.petId ?? '';

export async function listPets({ userId }: RouteContext) {
  const groups = groupPets(await queryUserItems(userId));
  const pets = await Promise.all(
    groups.map(async ({ pet, vaccinations }) => toPet(pet, vaccinations, await photoUrl(pet.photoKey))),
  );
  return json(200, { pets });
}

export async function getPet(ctx: RouteContext) {
  const { pet, vaccinations } = await queryPet(ctx.userId, petId(ctx));
  return json(200, toPet(pet, vaccinations, await photoUrl(pet.photoKey)));
}

export async function createPet({ userId, body }: RouteContext) {
  const input = createPetSchema.parse(body);
  const now = new Date().toISOString();
  const id = randomUUID();
  const item: PetItem = compact({
    PK: userPk(userId),
    SK: petSk(id),
    entity: 'pet' as const,
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  }) as PetItem;
  await ddb.send(
    new PutCommand({
      TableName: tableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(SK)',
    }),
  );
  return json(201, toPet(item, [], null));
}

export async function updatePet(ctx: RouteContext) {
  const patch = updatePetSchema.parse(ctx.body);
  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: userPk(ctx.userId), SK: petSk(petId(ctx)) },
        ConditionExpression: 'attribute_exists(SK)',
        ReturnValues: 'ALL_NEW',
        ...buildUpdate(patch, new Date().toISOString()),
      }),
    );
    const { vaccinations } = await queryPet(ctx.userId, petId(ctx));
    const pet = Attributes as PetItem;
    return json(200, toPet(pet, vaccinations, await photoUrl(pet.photoKey)));
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw notFound('Pet');
    throw err;
  }
}

/** Deletes the pet, all its vaccinations and all its photos. */
export async function deletePet(ctx: RouteContext) {
  const { items } = await queryPet(ctx.userId, petId(ctx));
  await deletePetPhotos(ctx.userId, petId(ctx));
  await deleteItems(items);
  return noContent();
}

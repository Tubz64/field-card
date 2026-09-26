import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ddb, tableName } from '../lib/aws.js';
import { HttpError, json, noContent, notFound } from '../lib/http.js';
import { petSk, toPet, userPk, type PetItem } from '../lib/model.js';
import {
  createPhotoUpload,
  deletePhoto,
  isOwnPhotoKey,
  photoExists,
  photoUrl,
} from '../lib/photos.js';
import { getPetItem, queryPet } from '../lib/store.js';
import type { RouteContext } from '../lib/types.js';
import { confirmPhotoSchema } from '../lib/validation.js';

const petId = (ctx: RouteContext) => ctx.params.petId ?? '';

/**
 * Step 1 of a photo change: returns a presigned POST. The app uploads the
 * JPEG straight to S3 (multipart form: `fields` first, then `file`), then
 * calls PUT /pets/{petId}/photo with the returned key.
 */
export async function startPhotoUpload(ctx: RouteContext) {
  await getPetItem(ctx.userId, petId(ctx));
  return json(201, await createPhotoUpload(ctx.userId, petId(ctx)));
}

/** Step 2: points the pet at the uploaded photo and deletes the previous one. */
export async function confirmPhoto(ctx: RouteContext) {
  const { key } = confirmPhotoSchema.parse(ctx.body);
  if (!isOwnPhotoKey(ctx.userId, petId(ctx), key)) {
    throw new HttpError(400, 'Photo key does not belong to this pet');
  }
  if (!(await photoExists(key))) {
    throw new HttpError(400, 'Photo has not been uploaded');
  }
  const now = new Date().toISOString();
  let previous: PetItem;
  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: userPk(ctx.userId), SK: petSk(petId(ctx)) },
        ConditionExpression: 'attribute_exists(SK)',
        UpdateExpression: 'SET photoKey = :key, photoUpdatedAt = :now, updatedAt = :now',
        ExpressionAttributeValues: { ':key': key, ':now': now },
        ReturnValues: 'ALL_OLD',
      }),
    );
    previous = Attributes as PetItem;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw notFound('Pet');
    throw err;
  }
  if (previous.photoKey && previous.photoKey !== key) await deletePhoto(previous.photoKey);

  const { pet, vaccinations } = await queryPet(ctx.userId, petId(ctx));
  return json(200, toPet(pet, vaccinations, await photoUrl(pet.photoKey)));
}

export async function removePhoto(ctx: RouteContext) {
  let previous: PetItem;
  try {
    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { PK: userPk(ctx.userId), SK: petSk(petId(ctx)) },
        ConditionExpression: 'attribute_exists(SK)',
        UpdateExpression: 'SET updatedAt = :now REMOVE photoKey, photoUpdatedAt',
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
        ReturnValues: 'ALL_OLD',
      }),
    );
    previous = Attributes as PetItem;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) throw notFound('Pet');
    throw err;
  }
  if (previous.photoKey) await deletePhoto(previous.photoKey);
  return noContent();
}

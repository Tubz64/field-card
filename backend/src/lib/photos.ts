import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { photosBucket, s3 } from './aws.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 60 * 60;

const petPrefix = (userId: string, petId: string) => `users/${userId}/pets/${petId}/`;

/** True if `key` is a photo key this API could have issued for this user's pet. */
export function isOwnPhotoKey(userId: string, petId: string, key: string): boolean {
  const prefix = petPrefix(userId, petId);
  return (
    key.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.jpg$/.test(key.slice(prefix.length))
  );
}

/**
 * Presigned POST (not PUT) so S3 itself enforces the content type and a
 * size limit on the upload.
 */
export async function createPhotoUpload(userId: string, petId: string) {
  const key = `${petPrefix(userId, petId)}${randomUUID()}.jpg`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: photosBucket(),
    Key: key,
    Fields: { 'Content-Type': 'image/jpeg' },
    Conditions: [
      ['content-length-range', 1, MAX_PHOTO_BYTES],
      ['eq', '$Content-Type', 'image/jpeg'],
    ],
    Expires: UPLOAD_TTL_SECONDS,
  });
  return {
    url,
    fields,
    key,
    maxBytes: MAX_PHOTO_BYTES,
    expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
  };
}

export async function photoExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: photosBucket(), Key: key }));
    return true;
  } catch (err) {
    if ((err as { name?: string }).name === 'NotFound') return false;
    throw err;
  }
}

/** Signed locally (no network call), so it's cheap to do for every pet in a list. */
export async function photoUrl(key: string | undefined): Promise<string | null> {
  if (!key) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: photosBucket(), Key: key }), {
    expiresIn: DOWNLOAD_TTL_SECONDS,
  });
}

export async function deletePhoto(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: photosBucket(), Key: key }));
}

/** Removes every object stored for a pet, including abandoned uploads. */
export async function deletePetPhotos(userId: string, petId: string): Promise<void> {
  const Bucket = photosBucket();
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: petPrefix(userId, petId), ContinuationToken }),
    );
    const objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects, Quiet: true } }));
    }
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
}

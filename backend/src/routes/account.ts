import {
  AdminDeleteUserCommand,
  AdminUserGlobalSignOutCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognito, userPoolId } from '../lib/aws.js';
import { noContent } from '../lib/http.js';
import { deleteUserPhotos } from '../lib/photos.js';
import { deleteItems, queryAllUserItems } from '../lib/store.js';
import type { RouteContext } from '../lib/types.js';

/**
 * Deletes the caller's account and everything they own (UK GDPR erasure;
 * also an App Store requirement). Data goes first, the Cognito user last, so
 * a failure part-way leaves an account the user can retry with, never an
 * orphaned pile of data. Safe to call again.
 */
export async function deleteAccount({ userId, username }: RouteContext) {
  await deleteUserPhotos(userId);
  await deleteItems(await queryAllUserItems(userId));
  try {
    // Revoke refresh tokens on every device, then remove the user.
    await cognito.send(new AdminUserGlobalSignOutCommand({ UserPoolId: userPoolId(), Username: username }));
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId(), Username: username }));
  } catch (err) {
    if (!(err instanceof UserNotFoundException)) throw err;
  }
  return noContent();
}

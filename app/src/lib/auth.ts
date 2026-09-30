// Cognito sign-in with SRP (the password never leaves the device). Thin
// promise wrappers around amazon-cognito-identity-js; React state lives in
// AuthProvider.
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { config } from './config';
import { tokenStorage } from './tokenStorage';

const EMAIL_KEY = 'pawpers.email';

let pool: CognitoUserPool | undefined;
function userPool(): CognitoUserPool {
  pool ??= new CognitoUserPool({
    UserPoolId: config.userPoolId,
    ClientId: config.userPoolClientId,
    Storage: tokenStorage,
  });
  return pool;
}

const cognitoUser = (email: string) =>
  new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool(), Storage: tokenStorage });

/** Email of the signed-in user from local storage; works offline. */
export function currentEmail(): string | null {
  return userPool().getCurrentUser() ? tokenStorage.getItem(EMAIL_KEY) : null;
}

export type SignInResult = { status: 'signed-in' } | { status: 'new-password-required'; user: CognitoUser };

export function signIn(email: string, password: string): Promise<SignInResult> {
  const user = cognitoUser(email);
  const details = new AuthenticationDetails({ Username: email.trim().toLowerCase(), Password: password });
  return new Promise((resolve, reject) =>
    user.authenticateUser(details, {
      onSuccess: () => {
        tokenStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
        resolve({ status: 'signed-in' });
      },
      onFailure: reject,
      // Invited users (prod is invite-only) sign in with a temporary password first.
      newPasswordRequired: () => resolve({ status: 'new-password-required', user }),
    }),
  );
}

export function completeNewPassword(user: CognitoUser, email: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) =>
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: () => {
        tokenStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
        resolve();
      },
      onFailure: reject,
    }),
  );
}

export function signUp(email: string, password: string): Promise<void> {
  const normalised = email.trim().toLowerCase();
  return new Promise((resolve, reject) =>
    userPool().signUp(
      normalised,
      password,
      [new CognitoUserAttribute({ Name: 'email', Value: normalised })],
      [],
      (err) => (err ? reject(err) : resolve()),
    ),
  );
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) =>
    cognitoUser(email).confirmRegistration(code.trim(), true, (err) => (err ? reject(err) : resolve())),
  );
}

export function resendCode(email: string): Promise<void> {
  return new Promise((resolve, reject) =>
    cognitoUser(email).resendConfirmationCode((err) => (err ? reject(err) : resolve())),
  );
}

export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) =>
    cognitoUser(email).forgotPassword({ onSuccess: () => resolve(), onFailure: reject, inputVerificationCode: () => resolve() }),
  );
}

export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) =>
    cognitoUser(email).confirmPassword(code.trim(), newPassword, { onSuccess: () => resolve(), onFailure: reject }),
  );
}

/**
 * A valid access token, refreshed with the refresh token when expired.
 * Rejects when offline with an expired token, or when the session has been
 * revoked; callers treat the latter as signed out.
 */
export function getAccessToken(): Promise<string> {
  const user = userPool().getCurrentUser();
  if (!user) return Promise.reject(new SignedOutError());
  return new Promise((resolve, reject) =>
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return reject(isAuthFailure(err) ? new SignedOutError() : err);
      resolve(session.getAccessToken().getJwtToken());
    }),
  );
}

export function signOut(): void {
  userPool().getCurrentUser()?.signOut();
  tokenStorage.clear();
}

export class SignedOutError extends Error {
  constructor() {
    super('Your session has ended. Please sign in again.');
  }
}

const isAuthFailure = (err: unknown) =>
  (err as { code?: string } | null)?.code === 'NotAuthorizedException';

/** Turns Cognito errors into messages fit for the UI. */
export function authErrorMessage(err: unknown): string {
  const e = err as { code?: string; name?: string; message?: string };
  switch (e?.code ?? e?.name) {
    case 'NotAuthorizedException':
      return e.message?.includes('disabled') ? 'Sign-up is by invitation only.' : 'Incorrect email or password.';
    case 'UserNotFoundException':
      return 'Incorrect email or password.';
    case 'UserNotConfirmedException':
      return 'Please confirm your email first.';
    case 'UsernameExistsException':
      return 'An account with this email already exists.';
    case 'CodeMismatchException':
      return 'That code is not right. Check the email and try again.';
    case 'ExpiredCodeException':
      return 'That code has expired. Ask for a new one.';
    case 'InvalidPasswordException':
      return 'Password must be at least 10 characters with a lowercase letter and a number.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'NetworkError':
      return 'No connection. Check your signal and try again.';
    default:
      return e?.message ?? 'Something went wrong.';
  }
}

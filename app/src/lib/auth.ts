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

export interface Profile {
  email: string;
  givenName: string | null;
  familyName: string | null;
}

/**
 * The signed-in user's profile, read from the stored ID token's claims (no
 * network, so it works offline). Display only; the API verifies tokens.
 */
export function currentProfile(): Profile | null {
  const user = userPool().getCurrentUser();
  if (!user) return null;
  const idToken = tokenStorage.getItem(
    `CognitoIdentityServiceProvider.${config.userPoolClientId}.${user.getUsername()}.idToken`,
  );
  const claims = idToken ? decodeJwtPayload(idToken) : {};
  return {
    email: typeof claims.email === 'string' ? claims.email : user.getUsername(),
    givenName: typeof claims.given_name === 'string' ? claims.given_name : null,
    familyName: typeof claims.family_name === 'string' ? claims.family_name : null,
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    const base64 = jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    // atob gives bytes; decode them as UTF-8 so names like "Zoë" survive.
    const utf8 = Array.from(binary, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    return JSON.parse(decodeURIComponent(utf8));
  } catch {
    return {};
  }
}

export type SignInResult = { status: 'signed-in' } | { status: 'new-password-required'; user: CognitoUser };

export function signIn(email: string, password: string): Promise<SignInResult> {
  const user = cognitoUser(email);
  const details = new AuthenticationDetails({ Username: email.trim().toLowerCase(), Password: password });
  return new Promise((resolve, reject) =>
    user.authenticateUser(details, {
      onSuccess: () => resolve({ status: 'signed-in' }),
      onFailure: reject,
      // Invited users (prod is invite-only) sign in with a temporary password first.
      newPasswordRequired: () => resolve({ status: 'new-password-required', user }),
    }),
  );
}

export function completeNewPassword(user: CognitoUser, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) =>
    user.completeNewPasswordChallenge(newPassword, {}, { onSuccess: () => resolve(), onFailure: reject }),
  );
}

export interface SignUpDetails {
  givenName: string;
  familyName: string;
  email: string;
  password: string;
}

export function signUp({ givenName, familyName, email, password }: SignUpDetails): Promise<void> {
  const normalised = email.trim().toLowerCase();
  return new Promise((resolve, reject) =>
    userPool().signUp(
      normalised,
      password,
      [
        new CognitoUserAttribute({ Name: 'email', Value: normalised }),
        new CognitoUserAttribute({ Name: 'given_name', Value: givenName.trim() }),
        new CognitoUserAttribute({ Name: 'family_name', Value: familyName.trim() }),
      ],
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
      return "That password doesn't meet the rules shown below the field.";
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'NetworkError':
      return 'No connection. Check your signal and try again.';
    default:
      return e?.message ?? 'Something went wrong.';
  }
}

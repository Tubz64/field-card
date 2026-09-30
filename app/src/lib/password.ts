// Mirrors the Cognito password policy in infra/modules/auth/main.tf so the
// app can show the rules as someone types. Cognito still enforces them.
export const PASSWORD_MIN_LENGTH = 10;
/** Cognito's hard limit for passwords. */
export const PASSWORD_MAX_LENGTH = 256;

export interface PasswordRule {
  label: string;
  met: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { label: 'A lowercase letter', met: /[a-z]/.test(password) },
    { label: 'A number', met: /\d/.test(password) },
    { label: 'No spaces at the start or end', met: password === password.trim() },
  ];
}

export const passwordValid = (password: string) =>
  password.length <= PASSWORD_MAX_LENGTH && passwordRules(password).every((r) => r.met);

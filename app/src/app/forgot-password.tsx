import { useState } from 'react';
import { router } from 'expo-router';
import { PasswordField } from '../components/fields';
import { Banner, Body, Button, Field, Screen } from '../components/ui';
import { authErrorMessage, confirmForgotPassword, forgotPassword } from '../lib/auth';
import { notify } from '../lib/confirm';
import { passwordValid } from '../lib/password';

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {step === 'email' ? (
        <>
          <Body>Enter your email and we&apos;ll send you a code to reset your password.</Body>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
          <Button
            title="Send code"
            busy={busy}
            disabled={!email}
            onPress={() => run(async () => {
              await forgotPassword(email);
              setStep('reset');
            })}
          />
        </>
      ) : (
        <>
          <Body>If {email} has an account, we&apos;ve emailed it a code.</Body>
          <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
          <PasswordField label="New password" value={password} onChangeText={setPassword} />
          <Button
            title="Reset password"
            busy={busy}
            disabled={!code || !passwordValid(password)}
            onPress={() => run(async () => {
              await confirmForgotPassword(email, code, password);
              notify('Password reset', 'You can now sign in with your new password.');
              router.back();
            })}
          />
        </>
      )}
    </Screen>
  );
}

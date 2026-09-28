import { useState } from 'react';
import { Banner, Body, Button, Field, Screen } from '../components/ui';
import { authErrorMessage, confirmSignUp, resendCode, signUp } from '../lib/auth';
import { useAuth } from '../lib/AuthProvider';

/** Two steps: create the account, then enter the code Cognito emails. */
export default function SignUp() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ tone: 'error', text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (step === 'details') {
    return (
      <Screen>
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint="At least 10 characters, with a lowercase letter and a number."
        />
        <Button
          title="Create account"
          busy={busy}
          disabled={!email || !password}
          onPress={() => run(async () => {
            await signUp(email, password);
            setStep('code');
          })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Body>We&apos;ve emailed a code to {email}. Enter it to confirm your account.</Body>
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" />
      <Button
        title="Confirm and sign in"
        busy={busy}
        disabled={!code}
        onPress={() => run(async () => {
          await confirmSignUp(email, code);
          await signIn(email, password);
        })}
      />
      <Button
        title="Send a new code"
        kind="secondary"
        onPress={() => run(async () => {
          await resendCode(email);
          setMessage({ tone: 'info', text: 'New code sent.' });
        })}
      />
    </Screen>
  );
}

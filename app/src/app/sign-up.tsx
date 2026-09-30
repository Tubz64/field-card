import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PasswordField } from '../components/fields';
import { Banner, Body, Button, Field, Screen } from '../components/ui';
import { authErrorMessage, confirmSignUp, resendCode, signUp } from '../lib/auth';
import { useAuth } from '../lib/AuthProvider';
import { passwordValid } from '../lib/password';

/** Two steps: create the account, then enter the code Cognito emails. */
export default function SignUp() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
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
    const complete = givenName.trim() && familyName.trim() && email.trim() && passwordValid(password);
    return (
      <Screen>
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="First name" value={givenName} onChangeText={setGivenName} autoComplete="given-name" autoCapitalize="words" textContentType="givenName" />
          </View>
          <View style={styles.flex}>
            <Field label="Surname" value={familyName} onChangeText={setFamilyName} autoComplete="family-name" autoCapitalize="words" textContentType="familyName" />
          </View>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <PasswordField value={password} onChangeText={setPassword} />
        <Button
          title="Create account"
          busy={busy}
          disabled={!complete}
          onPress={() => run(async () => {
            await signUp({ givenName, familyName, email, password });
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});

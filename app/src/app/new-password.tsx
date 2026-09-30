import { useState } from 'react';
import { Redirect } from 'expo-router';
import { Banner, Body, Button, Field, Screen } from '../components/ui';
import { authErrorMessage } from '../lib/auth';
import { useAuth } from '../lib/AuthProvider';

/** First sign-in with the temporary password from an invite. */
export default function NewPassword() {
  const { pendingChallenge, completeNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingChallenge) return <Redirect href="/sign-in" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await completeNewPassword(password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Body>Welcome to Pawpers. Choose a password to replace the temporary one from your invite.</Body>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 10 characters, with a lowercase letter and a number."
      />
      <Button title="Save and sign in" onPress={submit} busy={busy} disabled={!password} />
    </Screen>
  );
}

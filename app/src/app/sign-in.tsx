import { useState } from 'react';
import { Link, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner, Body, Button, Field, Heading, Screen } from '../components/ui';
import { authErrorMessage } from '../lib/auth';
import { useAuth } from '../lib/AuthProvider';
import { config } from '../lib/config';
import { useColors } from '../theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (result === 'new-password-required') router.push('/new-password');
      // On success the layout's guard switches to the signed-in screens.
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Heading style={styles.title}>Pawpers</Heading>
        <Body muted>Your pet&apos;s vaccination papers, always on hand.</Body>
        {config.env !== 'prod' ? <Body style={{ color: colors.amber }}>{config.env} environment</Body> : null}
      </View>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Button title="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
      <View style={styles.links}>
        <Link href="/sign-up" style={[styles.link, { color: colors.moss }]}>
          Create an account
        </Link>
        <Link href="/forgot-password" style={[styles.link, { color: colors.moss }]}>
          Forgot password?
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48, marginBottom: 12, gap: 6 },
  title: { fontSize: 40 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  link: { fontSize: 15, paddingVertical: 6 },
});

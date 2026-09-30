import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { PasswordField } from '../components/fields';
import { Banner, Body, Button, Card, Field, Heading, Screen, SectionLabel } from '../components/ui';
import { authErrorMessage, changePassword } from '../lib/auth';
import { useAuth } from '../lib/AuthProvider';
import { confirm } from '../lib/confirm';
import {
  cancelReminders,
  getRemindersEnabled,
  remindersSupported,
  setRemindersEnabled,
  syncReminders,
} from '../lib/notifications';
import { passwordValid } from '../lib/password';
import { usePets } from '../lib/queries';
import { useColors } from '../theme';

type Message = { tone: 'info' | 'error'; text: string } | null;

export default function Profile() {
  const { profile, updateName, signOut, deleteAccount } = useAuth();
  const { data: pets } = usePets();
  const colors = useColors();

  const [givenName, setGivenName] = useState(profile?.givenName ?? '');
  const [familyName, setFamilyName] = useState(profile?.familyName ?? '');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  const [reminders, setReminders] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void getRemindersEnabled().then(setReminders);
  }, []);

  async function saveName() {
    setNameBusy(true);
    setNameMessage(null);
    try {
      await updateName(givenName, familyName);
      setNameMessage({ tone: 'info', text: 'Name saved.' });
    } catch (err) {
      setNameMessage({ tone: 'error', text: authErrorMessage(err) });
    } finally {
      setNameBusy(false);
    }
  }

  async function savePassword() {
    setPasswordBusy(true);
    setPasswordMessage(null);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setPasswordMessage({ tone: 'info', text: 'Password changed.' });
    } catch (err) {
      setPasswordMessage({ tone: 'error', text: authErrorMessage(err) });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function toggleReminders(enabled: boolean) {
    setReminders(enabled);
    await setRemindersEnabled(enabled);
    if (enabled) await syncReminders(pets ?? []);
    else await cancelReminders();
  }

  async function removeAccount() {
    const sure = await confirm(
      'Delete your account?',
      'This permanently deletes your account and all of your pets, vaccination records and photos. It cannot be undone.',
      'Delete everything',
    );
    if (!sure) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete your account.');
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <View>
        <Heading>{[profile?.givenName, profile?.familyName].filter(Boolean).join(' ') || 'Your account'}</Heading>
        <Body muted>{profile?.email}</Body>
      </View>

      <SectionLabel>Your name</SectionLabel>
      {nameMessage ? <Banner tone={nameMessage.tone}>{nameMessage.text}</Banner> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="First name" value={givenName} onChangeText={setGivenName} autoCapitalize="words" autoComplete="given-name" />
        </View>
        <View style={styles.flex}>
          <Field label="Surname" value={familyName} onChangeText={setFamilyName} autoCapitalize="words" autoComplete="family-name" />
        </View>
      </View>
      <Button
        title="Save name"
        kind="secondary"
        busy={nameBusy}
        disabled={!givenName.trim() || !familyName.trim()}
        onPress={saveName}
      />

      <SectionLabel>Reminders</SectionLabel>
      <Card>
        {remindersSupported ? (
          <View style={styles.switchRow}>
            <Body style={styles.flex}>
              Remind me 30 days and 7 days before a vaccination expires, and on the day.
            </Body>
            <Switch
              value={reminders}
              onValueChange={toggleReminders}
              trackColor={{ true: colors.moss, false: colors.line }}
              accessibilityLabel="Expiry reminders"
            />
          </View>
        ) : (
          <Body muted>Expiry reminders are sent on your phone. Open Pawpers on your phone to use them.</Body>
        )}
      </Card>

      <SectionLabel>Change password</SectionLabel>
      {passwordMessage ? <Banner tone={passwordMessage.tone}>{passwordMessage.text}</Banner> : null}
      <PasswordField label="Current password" value={oldPassword} onChangeText={setOldPassword} isNew={false} />
      <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} />
      <Button
        title="Change password"
        kind="secondary"
        busy={passwordBusy}
        disabled={!oldPassword || !passwordValid(newPassword)}
        onPress={savePassword}
      />

      <SectionLabel>Account</SectionLabel>
      <Button title="Sign out" kind="secondary" onPress={signOut} />
      {deleteError ? <Banner tone="error">{deleteError}</Banner> : null}
      <Button title="Delete account" kind="danger" busy={deleting} onPress={removeAccount} />
      <Body muted style={styles.small}>
        Deleting your account permanently removes everything stored for you, including photos.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { fontSize: 12 },
});

// Local expiry-reminder notifications (phones only; web has no support).
// Works in Expo Go: only *push* notifications need a development build.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { buildReminders } from './reminders';
import type { Pet } from './types';

export const remindersSupported = Platform.OS !== 'web';

const PREF_KEY = 'pawpers.reminders.enabled';
const CHANNEL_ID = 'expiry-reminders';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** On by default; the user can turn them off in Profile. */
export async function getRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) !== 'false';
  } catch {
    return true;
  }
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_KEY, String(enabled));
  } catch {
    // Preference just won't persist; reminders still follow the toggle this session.
  }
}

/** Asks for permission if it hasn't been refused before. */
async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function cancelReminders(): Promise<void> {
  if (remindersSupported) await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Replaces all scheduled reminders with ones for the current records. Asks
 * for notification permission the first time there's something to remind
 * about.
 */
export async function syncReminders(pets: Pet[]): Promise<void> {
  if (!remindersSupported) return;
  const reminders = buildReminders(pets);
  if (!(await getRemindersEnabled()) || reminders.length === 0) {
    await cancelReminders();
    return;
  }
  if (!(await hasPermission())) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Vaccination reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  await cancelReminders();
  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { url: r.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
    });
  }
}

// Which expiry reminders to schedule. Pure (no notification APIs) so it can
// be unit-tested; lib/notifications.ts does the scheduling.
import { formatDate } from './format';
import type { Pet, Vaccination } from './types';

/** Remind this many days before a vaccination expires (0 = on the day). */
export const REMINDER_DAYS_BEFORE = [30, 7, 0];
/** Local time reminders fire at. */
export const REMINDER_HOUR = 9;
/** iOS keeps at most 64 pending local notifications per app; stay under it. */
export const MAX_SCHEDULED = 60;

export interface Reminder {
  /** Stable per vaccination + offset, so re-syncing replaces rather than duplicates. */
  id: string;
  date: Date;
  title: string;
  body: string;
  /** Screen to open when the notification is tapped. */
  url: string;
}

/**
 * Only the most recent vaccination of each type counts: an older record that
 * a booster has replaced shouldn't trigger reminders.
 */
function currentVaccinations(pet: Pet): Vaccination[] {
  const latest = new Map<string, Vaccination>();
  for (const v of pet.vaccinations) {
    const key = v.type.trim().toLowerCase();
    const seen = latest.get(key);
    if (!seen || v.given > seen.given) latest.set(key, v);
  }
  return [...latest.values()];
}

export function buildReminders(pets: Pet[], now: Date = new Date()): Reminder[] {
  const reminders: Reminder[] = [];
  for (const pet of pets) {
    for (const v of currentVaccinations(pet)) {
      if (!v.expires) continue;
      const [y, m, d] = v.expires.split('-').map(Number);
      for (const daysBefore of REMINDER_DAYS_BEFORE) {
        const date = new Date(y!, m! - 1, d! - daysBefore, REMINDER_HOUR, 0, 0);
        if (date <= now) continue;
        reminders.push({
          id: `${v.id}-${daysBefore}`,
          date,
          title:
            daysBefore === 0
              ? `${pet.name}'s ${v.type} expires today`
              : `${pet.name}'s ${v.type} expires in ${daysBefore} days`,
          body:
            daysBefore === 0
              ? 'Book a booster with your vet to keep their records valid.'
              : `Due ${formatDate(v.expires)}. Book a booster with your vet.`,
          url: `/pets/${pet.id}`,
        });
      }
    }
  }
  return reminders.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

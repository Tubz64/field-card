// Vaccination status and photo reminders. Ported from the prototype's
// statusFor()/overallStatus() in index.html. Pure functions; `today` is a
// YYYY-MM-DD string in the user's local time so tests are deterministic.
import type { Pet, Vaccination } from './types';

export type StatusLevel = 'good' | 'amber' | 'red' | 'none';

export interface Status {
  level: StatusLevel;
  label: string;
}

/** Days before expiry at which a vaccination turns amber. */
export const DUE_SOON_DAYS = 30;
/** A photo this old prompts a refresh. */
export const PHOTO_MAX_AGE_DAYS = 2 * 365;
/** Photos taken before this age prompt a refresh once the pet is older. */
export const GROWN_UP_MONTHS = 12;

export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const utc = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!) - (td! < fd! ? 1 : 0);
}

export function statusFor(v: Pick<Vaccination, 'expires'>, today: string): Status {
  if (!v.expires) return { level: 'none', label: 'No expiry set' };
  const days = daysBetween(today, v.expires);
  if (days < 0) return { level: 'red', label: 'Expired' };
  if (days === 0) return { level: 'amber', label: 'Expires today' };
  if (days <= DUE_SOON_DAYS) return { level: 'amber', label: `${days}d left` };
  return { level: 'good', label: 'Valid' };
}

const RANK: Record<StatusLevel, number> = { red: 0, amber: 1, none: 2, good: 3 };

/** The worst status across a pet's vaccinations, for the summary badge. */
export function overallStatus(pet: Pick<Pet, 'vaccinations'>, today: string): Status {
  if (pet.vaccinations.length === 0) return { level: 'none', label: 'No records' };
  const worst = pet.vaccinations
    .map((v) => statusFor(v, today).level)
    .reduce((a, b) => (RANK[b] < RANK[a] ? b : a), 'good' as StatusLevel);
  switch (worst) {
    case 'red':
      return { level: 'red', label: 'Overdue' };
    case 'amber':
      return { level: 'amber', label: 'Due soon' };
    case 'none':
      return { level: 'none', label: 'No expiry set' };
    default:
      return { level: 'good', label: 'Up to date' };
  }
}

/** Vaccinations with an expiry date, soonest first. */
export function upcoming(pet: Pick<Pet, 'vaccinations'>): Vaccination[] {
  return pet.vaccinations
    .filter((v) => v.expires)
    .sort((a, b) => a.expires!.localeCompare(b.expires!));
}

export interface PhotoReminder {
  reason: 'grown-up' | 'old';
  message: string;
}

/**
 * Suggests refreshing a pet's photo when it no longer looks like them:
 * taken as a youngster (under 12 months) and they're now grown, or simply
 * more than two years old.
 */
export function photoReminder(
  pet: Pick<Pet, 'name' | 'dob' | 'photoUpdatedAt'>,
  today: string,
): PhotoReminder | null {
  if (!pet.photoUpdatedAt) return null;
  const takenOn = pet.photoUpdatedAt.slice(0, 10);

  if (pet.dob) {
    const ageAtPhoto = monthsBetween(pet.dob, takenOn);
    const ageNow = monthsBetween(pet.dob, today);
    if (ageAtPhoto < GROWN_UP_MONTHS && ageNow >= GROWN_UP_MONTHS) {
      return {
        reason: 'grown-up',
        message: `${pet.name}'s photo is from before they were a year old. Time for a grown-up one?`,
      };
    }
  }
  if (daysBetween(takenOn, today) >= PHOTO_MAX_AGE_DAYS) {
    return {
      reason: 'old',
      message: `${pet.name}'s photo is over two years old. Worth updating so it still looks like them.`,
    };
  }
  return null;
}

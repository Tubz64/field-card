// Dates: the API stores YYYY-MM-DD; people type and read DD-MM-YYYY.
export { localToday as localTodayIso } from './status';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

/** "2026-03-01" -> "01-03-2026" (for editing). */
export function isoToUk(iso: string | null | undefined): string {
  if (!iso || !ISO_DATE.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** "01-03-2026" -> "2026-03-01", or null if it isn't a complete, real date. */
export function ukToIso(uk: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(uk);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isIsoDate(iso) ? iso : null;
}

/**
 * Formats keystrokes into DD-MM-YYYY, adding the dashes automatically:
 * "0103" -> "01-03", "01032026" -> "01-03-2026". Accepts "/" or "." too.
 */
export function formatUkDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('-');
}

/** "2026-03-01" -> "1 Mar 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "5 minutes ago"-style label for when records were last synced. */
export function formatAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(new Date(timestamp).toISOString());
}

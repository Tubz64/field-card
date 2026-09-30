import { describe, expect, it } from 'vitest';
import { daysBetween, overallStatus, photoReminder, statusFor, upcoming } from './status';
import type { Vaccination } from './types';

const TODAY = '2026-09-28';
const vax = (expires: string | null, given = '2026-01-01'): Vaccination => ({
  id: expires ?? 'none',
  petId: 'p',
  type: 'Rabies',
  vet: null,
  manufacturer: null,
  lotNumber: null,
  given,
  expires,
  createdAt: '',
  updatedAt: '',
});

describe('statusFor', () => {
  it.each([
    [null, 'none', 'No expiry set'],
    ['2026-09-27', 'red', 'Expired'],
    ['2026-09-28', 'amber', 'Expires today'],
    ['2026-10-28', 'amber', '30d left'],
    ['2026-10-29', 'good', 'Valid'],
  ])('expires %s -> %s', (expires, level, label) => {
    expect(statusFor({ expires }, TODAY)).toEqual({ level, label });
  });

  it('counts days across a clock change without drifting', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('overallStatus', () => {
  it('reports no records for a pet without vaccinations', () => {
    expect(overallStatus({ vaccinations: [] }, TODAY).label).toBe('No records');
  });

  it('takes the worst status', () => {
    expect(overallStatus({ vaccinations: [vax('2030-01-01'), vax('2026-10-01')] }, TODAY).label).toBe('Due soon');
    expect(overallStatus({ vaccinations: [vax('2026-10-01'), vax('2026-01-01')] }, TODAY).label).toBe('Overdue');
    expect(overallStatus({ vaccinations: [vax('2030-01-01')] }, TODAY).label).toBe('Up to date');
  });
});

describe('upcoming', () => {
  it('lists dated vaccinations soonest first', () => {
    const list = upcoming({ vaccinations: [vax('2030-01-01'), vax(null), vax('2027-01-01')] });
    expect(list.map((v) => v.expires)).toEqual(['2027-01-01', '2030-01-01']);
  });
});

describe('photoReminder', () => {
  const pet = { name: 'Bramble', dob: '2025-06-01' as string | null, photoUpdatedAt: null as string | null };

  it('says nothing without a photo', () => {
    expect(photoReminder(pet, TODAY)).toBeNull();
  });

  it('suggests a grown-up photo once a puppy photo pet turns one', () => {
    const p = { ...pet, photoUpdatedAt: '2025-09-01T10:00:00.000Z' }; // taken at 3 months
    expect(photoReminder(p, '2026-05-31')).toBeNull(); // 11 months old
    expect(photoReminder(p, '2026-06-01')?.reason).toBe('grown-up'); // 12 months old
  });

  it('does not nag about a photo taken as an adult', () => {
    expect(photoReminder({ ...pet, photoUpdatedAt: '2026-07-01T00:00:00.000Z' }, TODAY)).toBeNull();
  });

  it('flags a photo over two years old', () => {
    const p = { name: 'Bramble', dob: null, photoUpdatedAt: '2024-09-01T00:00:00.000Z' };
    expect(photoReminder(p, TODAY)?.reason).toBe('old');
  });
});

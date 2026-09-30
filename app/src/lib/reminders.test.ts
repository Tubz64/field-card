import { describe, expect, it } from 'vitest';
import { buildReminders, MAX_SCHEDULED } from './reminders';
import type { Pet, Vaccination } from './types';

const vax = (id: string, type: string, given: string, expires: string | null): Vaccination => ({
  id,
  petId: 'p1',
  type,
  vet: null,
  manufacturer: null,
  lotNumber: null,
  given,
  validFrom: null,
  expires,
  createdAt: '',
  updatedAt: '',
});

const pet = (vaccinations: Vaccination[]): Pet => ({
  id: 'p1',
  name: 'Bramble',
  species: 'Dog',
  breed: null,
  dob: null,
  chip: null,
  weightKg: null,
  photoUrl: null,
  photoUpdatedAt: null,
  createdAt: '',
  updatedAt: '',
  vaccinations,
});

const NOW = new Date(2026, 8, 30, 12, 0, 0); // 30 Sep 2026, midday local

describe('buildReminders', () => {
  it('schedules 30 days, 7 days and on the day, at 9am local', () => {
    const r = buildReminders([pet([vax('v1', 'Rabies', '2026-01-01', '2026-12-01')])], NOW);
    expect(r.map((x) => [x.id, x.date.getMonth() + 1, x.date.getDate(), x.date.getHours()])).toEqual([
      ['v1-30', 11, 1, 9],
      ['v1-7', 11, 24, 9],
      ['v1-0', 12, 1, 9],
    ]);
    expect(r[0]!.title).toBe("Bramble's Rabies expires in 30 days");
    expect(r[2]!.title).toBe("Bramble's Rabies expires today");
    expect(r[0]!.url).toBe('/pets/p1');
  });

  it('skips reminders that are already in the past', () => {
    const r = buildReminders([pet([vax('v1', 'Rabies', '2026-01-01', '2026-10-05')])], NOW);
    expect(r.map((x) => x.id)).toEqual(['v1-0']);
  });

  it('ignores vaccinations without an expiry', () => {
    expect(buildReminders([pet([vax('v1', 'Booster', '2026-01-01', null)])], NOW)).toEqual([]);
  });

  it('only reminds about the latest vaccination of each type', () => {
    const r = buildReminders(
      [pet([vax('old', 'Rabies', '2024-01-01', '2026-12-01'), vax('new', 'rabies', '2026-09-01', '2029-09-01')])],
      NOW,
    );
    expect(r.every((x) => x.id.startsWith('new-'))).toBe(true);
  });

  it('keeps the soonest reminders under the iOS limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => vax(`v${i}`, `Type ${i}`, '2026-01-01', '2027-06-01'));
    expect(buildReminders([pet(many)], NOW)).toHaveLength(MAX_SCHEDULED);
  });
});

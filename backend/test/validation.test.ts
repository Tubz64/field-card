import { describe, expect, it } from 'vitest';
import {
  createPetSchema,
  createVaccinationSchema,
  updatePetSchema,
  updateVaccinationSchema,
} from '../src/lib/validation.js';

describe('createPetSchema', () => {
  it('accepts a minimal pet and normalises empty optional fields to null', () => {
    expect(createPetSchema.parse({ name: ' Bramble ', species: 'Dog', breed: '', chip: '' })).toEqual({
      name: 'Bramble',
      species: 'Dog',
      breed: null,
      dob: null,
      chip: null,
      weightKg: null,
    });
  });

  it('accepts a weight in kg, rounded to one decimal place', () => {
    expect(createPetSchema.parse({ name: 'B', species: 'Dog', weightKg: 12.345 }).weightKg).toBe(12.3);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', weightKg: 0 }).success).toBe(false);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', weightKg: 250 }).success).toBe(false);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', weightKg: '12' }).success).toBe(false);
  });

  it('requires a 15-digit microchip', () => {
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', chip: '933012400146699' }).success).toBe(true);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', chip: '93301240014669' }).success).toBe(false);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', chip: '93301240014669x' }).success).toBe(false);
  });

  it('rejects unknown species, bad dates and unknown fields', () => {
    expect(createPetSchema.safeParse({ name: 'B', species: 'Horse' }).success).toBe(false);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', dob: '2026-02-30' }).success).toBe(false);
    expect(createPetSchema.safeParse({ name: 'B', species: 'Dog', photo: 'data:...' }).success).toBe(false);
  });
});

describe('updatePetSchema', () => {
  it('leaves fields that were not sent untouched (absent, not null)', () => {
    expect(updatePetSchema.parse({ name: 'Bramble' })).toEqual({ name: 'Bramble' });
  });

  it('turns an explicit empty value into null so the field is cleared', () => {
    expect(updatePetSchema.parse({ breed: '' })).toEqual({ breed: null });
    expect(updatePetSchema.parse({ chip: null })).toEqual({ chip: null });
  });

  it('rejects an empty patch', () => {
    expect(updatePetSchema.safeParse({}).success).toBe(false);
  });
});

describe('vaccination schemas', () => {
  it('rejects an expiry before the date given', () => {
    const r = createVaccinationSchema.safeParse({ type: 'Rabies', given: '2026-03-01', expires: '2026-02-01' });
    expect(r.success).toBe(false);
  });

  it('allows no expiry', () => {
    expect(createVaccinationSchema.parse({ type: 'Rabies', given: '2026-03-01' })).toEqual({
      type: 'Rabies',
      vet: null,
      manufacturer: null,
      lotNumber: null,
      given: '2026-03-01',
      expires: null,
    });
  });

  it('keeps the manufacturer and lot number when given', () => {
    const v = createVaccinationSchema.parse({
      type: 'DHP',
      given: '2026-03-01',
      manufacturer: ' Nobivac ',
      lotNumber: 'A123B',
    });
    expect(v).toMatchObject({ manufacturer: 'Nobivac', lotNumber: 'A123B' });
  });

  it('checks dates in a patch only when both are sent', () => {
    expect(updateVaccinationSchema.safeParse({ expires: '2020-01-01' }).success).toBe(true);
    expect(updateVaccinationSchema.safeParse({ given: '2026-03-01', expires: '2026-01-01' }).success).toBe(false);
  });
});

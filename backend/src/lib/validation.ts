import { z } from 'zod';

export const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Other'] as const;

const isoDate = z.iso.date();

/** Optional free text: trimmed; "" or null clears the field. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalDate = z
  .union([isoDate, z.literal('')])
  .nullish()
  .transform((v) => (v ? v : null));

const petFields = {
  name: z.string().trim().min(1).max(60),
  species: z.enum(SPECIES),
  breed: optionalText(60),
  dob: optionalDate,
  // UK/EU ISO 11784/11785 microchips are 15 digits.
  chip: z
    .union([z.string().regex(/^\d{15}$/, 'Microchip number must be 15 digits'), z.literal('')])
    .nullish()
    .transform((v) => (v ? v : null)),
};

export const createPetSchema = z.strictObject(petFields);
export const updatePetSchema = z
  .strictObject(petFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const vaccinationFields = {
  type: z.string().trim().min(1).max(80),
  vet: optionalText(80),
  given: isoDate,
  expires: optionalDate,
};

const expiresAfterGiven = (v: { given?: string | null; expires?: string | null }) =>
  !v.given || !v.expires || v.expires >= v.given;

export const createVaccinationSchema = z
  .strictObject(vaccinationFields)
  .refine(expiresAfterGiven, { message: 'Expiry must be on or after the date given', path: ['expires'] });

export const updateVaccinationSchema = z
  .strictObject(vaccinationFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')
  .refine(expiresAfterGiven, { message: 'Expiry must be on or after the date given', path: ['expires'] });

export const confirmPhotoSchema = z.strictObject({ key: z.string().min(1).max(300) });

export type CreatePet = z.output<typeof createPetSchema>;
export type UpdatePet = z.output<typeof updatePetSchema>;
export type CreateVaccination = z.output<typeof createVaccinationSchema>;
export type UpdateVaccination = z.output<typeof updateVaccinationSchema>;

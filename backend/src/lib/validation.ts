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
  // Current weight in kg, kept to one decimal place.
  weightKg: z
    .number()
    .positive('Weight must be more than 0')
    .max(200, 'Weight must be 200 kg or less')
    .nullish()
    .transform((v) => (v == null ? null : Math.round(v * 10) / 10)),
};

export const createPetSchema = z.strictObject(petFields);
export const updatePetSchema = z
  .strictObject(petFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const vaccinationFields = {
  type: z.string().trim().min(1).max(80),
  vet: optionalText(80),
  // As recorded in a pet passport: "manufacturer and name of vaccine" and batch number.
  manufacturer: optionalText(80),
  lotNumber: optionalText(40),
  given: isoDate,
  // Pet passport "valid from": for a first rabies vaccination, 21 days after
  // it was given. Travel rules count from this date.
  validFrom: optionalDate,
  expires: optionalDate,
};

type VaccinationDates = { given?: string | null; validFrom?: string | null; expires?: string | null };

const expiresAfterGiven = (v: VaccinationDates) => !v.given || !v.expires || v.expires >= v.given;
const validFromInRange = (v: VaccinationDates) =>
  !v.validFrom || ((!v.given || v.validFrom >= v.given) && (!v.expires || v.validFrom <= v.expires));

const withDateRules = <T extends z.ZodType<VaccinationDates>>(schema: T) =>
  schema
    .refine(expiresAfterGiven, { message: 'Expiry must be on or after the date given', path: ['expires'] })
    .refine(validFromInRange, { message: 'Valid from must be between the date given and the expiry', path: ['validFrom'] });

export const createVaccinationSchema = withDateRules(z.strictObject(vaccinationFields));

export const updateVaccinationSchema = withDateRules(
  z
    .strictObject(vaccinationFields)
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update'),
);

export const confirmPhotoSchema = z.strictObject({ key: z.string().min(1).max(300) });

export type CreatePet = z.output<typeof createPetSchema>;
export type UpdatePet = z.output<typeof updatePetSchema>;
export type CreateVaccination = z.output<typeof createVaccinationSchema>;
export type UpdateVaccination = z.output<typeof updateVaccinationSchema>;

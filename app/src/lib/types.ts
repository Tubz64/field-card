// Mirrors the API's response shapes (backend/src/lib/model.ts and
// backend/README.md). Keep in sync when the API changes.

export const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Other'] as const;
export type Species = (typeof SPECIES)[number];

export interface Vaccination {
  id: string;
  petId: string;
  type: string;
  vet: string | null;
  given: string; // YYYY-MM-DD
  expires: string | null; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  dob: string | null;
  chip: string | null;
  /** Presigned, valid for 1 hour. Never persist it; expo-image caches the bytes. */
  photoUrl: string | null;
  photoUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vaccinations: Vaccination[];
}

export interface PetInput {
  name: string;
  species: Species;
  breed: string;
  dob: string;
  chip: string;
}

export interface VaccinationInput {
  type: string;
  vet: string;
  given: string;
  expires: string;
}

export interface PhotoUpload {
  url: string;
  fields: Record<string, string>;
  key: string;
  maxBytes: number;
  expiresAt: string;
}

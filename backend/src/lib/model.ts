// Single-table layout (see infra/modules/database):
//   PK = USER#<sub>   SK = PET#<petId>                 -> pet
//   PK = USER#<sub>   SK = PET#<petId>#VAX#<vaxId>     -> vaccination
// IDs are UUIDs (fixed length), so PET#<petId> never prefixes another pet's SK.

import type { Species } from './types.js';

export const userPk = (userId: string) => `USER#${userId}`;
export const petSk = (petId: string) => `PET#${petId}`;
export const vaccinationSk = (petId: string, vaccinationId: string) =>
  `PET#${petId}#VAX#${vaccinationId}`;

export interface PetItem {
  PK: string;
  SK: string;
  entity: 'pet';
  id: string;
  name: string;
  species: Species;
  breed?: string;
  dob?: string;
  chip?: string;
  photoKey?: string;
  /** ISO timestamp of the last confirmed photo upload; drives "update photo" reminders. */
  photoUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaccinationItem {
  PK: string;
  SK: string;
  entity: 'vaccination';
  id: string;
  petId: string;
  type: string;
  vet?: string;
  given: string;
  expires?: string;
  createdAt: string;
  updatedAt: string;
}

export type Item = PetItem | VaccinationItem;

export interface Vaccination {
  id: string;
  petId: string;
  type: string;
  vet: string | null;
  given: string;
  expires: string | null;
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
  /** Short-lived presigned GET URL; download and cache it on the device. */
  photoUrl: string | null;
  photoUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vaccinations: Vaccination[];
}

export function toVaccination(item: VaccinationItem): Vaccination {
  return {
    id: item.id,
    petId: item.petId,
    type: item.type,
    vet: item.vet ?? null,
    given: item.given,
    expires: item.expires ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toPet(
  item: PetItem,
  vaccinations: VaccinationItem[],
  photoUrl: string | null,
): Pet {
  return {
    id: item.id,
    name: item.name,
    species: item.species,
    breed: item.breed ?? null,
    dob: item.dob ?? null,
    chip: item.chip ?? null,
    photoUrl,
    photoUpdatedAt: item.photoUpdatedAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    vaccinations: vaccinations
      .map(toVaccination)
      .sort((a, b) => b.given.localeCompare(a.given)),
  };
}

/** Groups a user's items into pets with their vaccinations. */
export function groupPets(items: Item[]): { pet: PetItem; vaccinations: VaccinationItem[] }[] {
  const byPet = new Map<string, { pet?: PetItem; vaccinations: VaccinationItem[] }>();
  const entry = (petId: string) => {
    let e = byPet.get(petId);
    if (!e) byPet.set(petId, (e = { vaccinations: [] }));
    return e;
  };
  for (const item of items) {
    if (item.entity === 'pet') entry(item.id).pet = item;
    else if (item.entity === 'vaccination') entry(item.petId).vaccinations.push(item);
  }
  return [...byPet.values()]
    .filter((e): e is { pet: PetItem; vaccinations: VaccinationItem[] } => e.pet !== undefined)
    .sort((a, b) => a.pet.createdAt.localeCompare(b.pet.createdAt));
}

// Data hooks. Everything hangs off one cached query (the user's pets with
// their vaccinations), which is persisted to device storage so the app
// shows proof of vaccination with no signal.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Pet, PetInput, VaccinationInput } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** How long saved records stay usable offline. */
export const OFFLINE_MAX_AGE = 90 * DAY;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { gcTime: OFFLINE_MAX_AGE, staleTime: 30_000, retry: 1 },
  },
});

export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'pawpers.cache' });

export const PETS = ['pets'] as const;

export function usePets() {
  return useQuery({ queryKey: PETS, queryFn: api.listPets });
}

export function usePet(id: string | undefined) {
  const query = usePets();
  return { ...query, pet: query.data?.find((p) => p.id === id) };
}

/** Replace one pet in the cached list (or add it). */
function upsertPet(pet: Pet) {
  queryClient.setQueryData<Pet[]>(PETS, (pets = []) =>
    pets.some((p) => p.id === pet.id) ? pets.map((p) => (p.id === pet.id ? pet : p)) : [...pets, pet],
  );
}

const refresh = () => queryClient.invalidateQueries({ queryKey: PETS });

export function useSavePet(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PetInput) => (id ? api.updatePet(id, input) : api.createPet(input)),
    onSuccess: (pet) => {
      upsertPet(pet);
      void client.invalidateQueries({ queryKey: PETS });
    },
  });
}

export function useDeletePet() {
  return useMutation({
    mutationFn: (id: string) => api.deletePet(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Pet[]>(PETS, (pets = []) => pets.filter((p) => p.id !== id));
      void refresh();
    },
  });
}

export function useSaveVaccination(petId: string, id?: string) {
  return useMutation({
    mutationFn: (input: VaccinationInput) =>
      id ? api.updateVaccination(petId, id, input) : api.createVaccination(petId, input),
    onSuccess: () => refresh(),
  });
}

export function useDeleteVaccination(petId: string) {
  return useMutation({
    mutationFn: (id: string) => api.deleteVaccination(petId, id),
    onSuccess: () => refresh(),
  });
}

export function useSetPhoto(petId: string) {
  return useMutation({
    mutationFn: (fileUri: string) => api.setPhoto(petId, fileUri),
    onSuccess: (pet) => upsertPet(pet),
  });
}

export function useRemovePhoto(petId: string) {
  return useMutation({
    mutationFn: () => api.removePhoto(petId),
    onSuccess: () => refresh(),
  });
}

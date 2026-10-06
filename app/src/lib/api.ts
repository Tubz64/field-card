import { Platform } from 'react-native';
import { getAccessToken } from './auth';
import { config } from './config';
import type { Pet, PetInput, PhotoUpload, Vaccination, VaccinationInput } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No connection. Showing your saved records.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`, data.details);
  return data as T;
}

export const api = {
  listPets: () => request<{ pets: Pet[] }>('GET', '/pets').then((r) => r.pets),
  createPet: (input: PetInput) => request<Pet>('POST', '/pets', input),
  updatePet: (id: string, input: Partial<PetInput>) => request<Pet>('PATCH', `/pets/${id}`, input),
  deletePet: (id: string) => request<void>('DELETE', `/pets/${id}`),

  createVaccination: (petId: string, input: VaccinationInput) =>
    request<Vaccination>('POST', `/pets/${petId}/vaccinations`, input),
  updateVaccination: (petId: string, id: string, input: Partial<VaccinationInput>) =>
    request<Vaccination>('PATCH', `/pets/${petId}/vaccinations/${id}`, input),
  deleteVaccination: (petId: string, id: string) =>
    request<void>('DELETE', `/pets/${petId}/vaccinations/${id}`),

  /** Upload a local JPEG (already resized) and attach it to the pet. */
  async setPhoto(petId: string, fileUri: string): Promise<Pet> {
    const upload = await request<PhotoUpload>('POST', `/pets/${petId}/photo/upload`);
    const form = new FormData();
    for (const [k, v] of Object.entries(upload.fields)) form.append(k, v);
    if (Platform.OS === 'web') {
      form.append('file', await (await fetch(fileUri)).blob(), 'photo.jpg');
    } else {
      // React Native's FormData streams a local file from { uri, name, type }.
      form.append('file', { uri: fileUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    const res = await fetch(upload.url, { method: 'POST', body: form });
    if (!res.ok) throw new ApiError(res.status, 'Photo upload failed. Try a smaller photo.');
    return request<Pet>('PUT', `/pets/${petId}/photo`, { key: upload.key });
  },
  removePhoto: (petId: string) => request<void>('DELETE', `/pets/${petId}/photo`),

  /** Permanently deletes the account, all pets, vaccinations and photos. */
  deleteAccount: () => request<void>('DELETE', '/account'),
};

/** First validation message for a field, if the API rejected it. */
export function fieldError(err: unknown, field: string): string | undefined {
  return err instanceof ApiError ? err.details?.find((d) => d.path === field)?.message : undefined;
}

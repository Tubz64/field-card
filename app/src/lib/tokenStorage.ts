// amazon-cognito-identity-js needs a *synchronous* storage for tokens. This
// keeps them in memory and mirrors every write to persistent storage:
// SecureStore (keychain/keystore) on phones, localStorage on web. Call
// hydrateTokenStorage() once at startup before touching the user pool.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const INDEX_KEY = 'pawpers.auth.keys';

interface Persist {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const persist: Persist =
  Platform.OS === 'web'
    ? {
        get: async (k) => globalThis.localStorage?.getItem(k) ?? null,
        set: async (k, v) => globalThis.localStorage?.setItem(k, v),
        remove: async (k) => globalThis.localStorage?.removeItem(k),
      }
    : {
        get: (k) => SecureStore.getItemAsync(k),
        set: (k, v) => SecureStore.setItemAsync(k, v),
        remove: (k) => SecureStore.deleteItemAsync(k),
      };

// SecureStore keys may only contain letters, digits, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

const memory = new Map<string, string>();

function saveIndex() {
  void persist.set(INDEX_KEY, JSON.stringify([...memory.keys()])).catch(warn);
}

function warn(err: unknown) {
  console.warn('Token storage write failed', err);
}

export async function hydrateTokenStorage(): Promise<void> {
  try {
    const keys: string[] = JSON.parse((await persist.get(INDEX_KEY)) ?? '[]');
    for (const key of keys) {
      const value = await persist.get(safeKey(key));
      if (value !== null) memory.set(key, value);
    }
  } catch (err) {
    console.warn('Could not restore saved sign-in', err);
  }
}

/** Implements the Storage interface amazon-cognito-identity-js expects. */
export const tokenStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
    void persist.set(safeKey(key), value).catch(warn);
    saveIndex();
  },
  removeItem: (key: string) => {
    memory.delete(key);
    void persist.remove(safeKey(key)).catch(warn);
    saveIndex();
  },
  clear: () => {
    for (const key of memory.keys()) void persist.remove(safeKey(key)).catch(warn);
    memory.clear();
    saveIndex();
  },
};

import { StorageBackend } from './types';

/**
 * In-memory `StorageBackend`. Used by unit tests and as the automatic
 * fallback when a real persistent backend is unavailable (e.g. the native
 * AsyncStorage module isn't linked into the current build yet). Data lives
 * only for the lifetime of the JS runtime - nothing is written to disk.
 */
export function createMemoryBackend(
  seed?: Record<string, string>,
): StorageBackend {
  const store = new Map<string, string>(seed ? Object.entries(seed) : undefined);

  return {
    async getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
  };
}

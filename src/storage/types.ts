/**
 * The minimal async key/value contract the app persists through.
 *
 * Deliberately tiny and storage-engine agnostic: everything the game needs to
 * save (currently just player progress) is a JSON string under a string key.
 * The default backend is `@react-native-async-storage/async-storage`; tests
 * and any environment where that native module isn't linked fall back to an
 * in-memory backend with the same shape. Swap the implementation in one place
 * (`createDefaultBackend`) without touching callers.
 */
export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

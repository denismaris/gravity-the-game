import { createMemoryBackend } from './memoryBackend';
import { StorageBackend } from './types';

export type { StorageBackend } from './types';
export { createMemoryBackend } from './memoryBackend';

let cached: StorageBackend | null = null;

/**
 * The backend the app persists through in production: React Native's
 * community AsyncStorage, resolved lazily so it is never required in a test
 * or Node context. If the native module can't be loaded (not linked into
 * this build, running under Jest, etc.) this transparently falls back to an
 * in-memory backend so the game still runs - progress just won't survive a
 * cold app restart until the module is present.
 */
export function createDefaultBackend(): StorageBackend {
  if (cached) return cached;

  try {
    const mod = require('@react-native-async-storage/async-storage');
    const AsyncStorage = (mod?.default ?? mod) as StorageBackend;

    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      cached = {
        getItem: key => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        removeItem: key => AsyncStorage.removeItem(key),
      };
      return cached;
    }
  } catch {
    // fall through to the in-memory backend
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      '[storage] AsyncStorage unavailable - falling back to in-memory storage. ' +
        'Player progress will not persist across app restarts.',
    );
  }

  cached = createMemoryBackend();
  return cached;
}

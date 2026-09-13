import { StorageBackend } from '../storage';
import { defaultSettings, Settings, SETTINGS_VERSION } from './settings';

/** Single key everything settings-related is stored under. Deliberately a
 * different key from `PLAYER_PROGRESS_KEY` - preferences and progress are
 * unrelated concerns with independent lifecycles/versioning. */
export const SETTINGS_KEY = 'gravity:settings';

const READABLE_VERSIONS = [1];

function parseSeenTutorials(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Parses whatever came back from storage into a trusted `Settings`.
 * Anything unexpected - missing key, malformed JSON, unreadable version, a
 * corrupt field - degrades to the default (sound/haptics on, no tutorials
 * seen) rather than throwing, exactly like `parseProgress`.
 */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return defaultSettings();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultSettings();
  }

  if (typeof parsed !== 'object' || parsed === null) return defaultSettings();

  const record = parsed as {
    version?: unknown;
    soundEnabled?: unknown;
    hapticsEnabled?: unknown;
    seenTutorials?: unknown;
  };
  if (typeof record.version !== 'number' || !READABLE_VERSIONS.includes(record.version)) {
    return defaultSettings();
  }

  return {
    version: SETTINGS_VERSION,
    soundEnabled: typeof record.soundEnabled === 'boolean' ? record.soundEnabled : true,
    hapticsEnabled: typeof record.hapticsEnabled === 'boolean' ? record.hapticsEnabled : true,
    seenTutorials: parseSeenTutorials(record.seenTutorials),
  };
}

/** Loads persisted settings. Never rejects - returns the default on any failure. */
export async function loadSettings(backend: StorageBackend): Promise<Settings> {
  try {
    const raw = await backend.getItem(SETTINGS_KEY);
    return parseSettings(raw);
  } catch {
    return defaultSettings();
  }
}

/** Persists settings. Resolves even if the write fails (best-effort). */
export async function saveSettings(backend: StorageBackend, settings: Settings): Promise<void> {
  try {
    await backend.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort; in-memory state remains the source of truth this session
  }
}

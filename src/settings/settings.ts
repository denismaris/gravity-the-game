/**
 * User preferences and one-time "have I seen this" flags.
 *
 * Kept as its own persisted blob, separate from `PlayerProgress` (stars/
 * completions): a different kind of state with a different lifecycle -
 * preferences change rarely and never "grow" the way completions do, and
 * tutorial flags are write-once. See `settingsStore.ts` for persistence and
 * `SettingsProvider` for the React glue.
 */
export interface Settings {
  readonly version: 1;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  /** Ids of one-time tutorial overlays already shown - see
   * `src/game/tutorials.ts` for the fixed set of ids. Only ever grows. */
  readonly seenTutorials: ReadonlyArray<string>;
}

export const SETTINGS_VERSION = 1 as const;

export function defaultSettings(): Settings {
  return { version: SETTINGS_VERSION, soundEnabled: true, hapticsEnabled: true, seenTutorials: [] };
}

export function withSoundEnabled(settings: Settings, enabled: boolean): Settings {
  if (settings.soundEnabled === enabled) return settings;
  return { ...settings, soundEnabled: enabled };
}

export function withHapticsEnabled(settings: Settings, enabled: boolean): Settings {
  if (settings.hapticsEnabled === enabled) return settings;
  return { ...settings, hapticsEnabled: enabled };
}

/** Marks `tutorialId` as shown. Idempotent - showing the same one twice
 * (e.g. a queued mutation replayed - see `SettingsProvider`) is a no-op. */
export function withTutorialSeen(settings: Settings, tutorialId: string): Settings {
  if (settings.seenTutorials.includes(tutorialId)) return settings;
  return { ...settings, seenTutorials: [...settings.seenTutorials, tutorialId] };
}

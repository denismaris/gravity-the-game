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
  /** Whether the calming swipe-maze interstitial shows between level
   * batches (see `src/interstitial/`). Defaults to `true` - shown by
   * default, matching the spec's own "default to shown" instruction. */
  readonly calmingInterstitialEnabled: boolean;
  /** Ids of one-time tutorial overlays already shown - see
   * `src/game/tutorials.ts` for the fixed set of ids. Only ever grows. */
  readonly seenTutorials: ReadonlyArray<string>;
  /** A daily local notification about the Daily puzzle (see
   * `src/notifications/`). Off until the player turns it on - the system
   * permission prompt is only ever shown in answer to that. */
  readonly remindersEnabled: boolean;
  /** The hour (0-23, local time) the reminder arrives. */
  readonly reminderHour: number;
  /** Light, dark, or whatever the phone is set to (the default). */
  readonly appearance: AppearancePreference;
}

export type AppearancePreference = 'system' | 'light' | 'dark';

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function withAppearance(settings: Settings, appearance: AppearancePreference): Settings {
  if (settings.appearance === appearance) return settings;
  return { ...settings, appearance };
}

export const SETTINGS_VERSION = 1 as const;

export function defaultSettings(): Settings {
  return {
    version: SETTINGS_VERSION,
    soundEnabled: true,
    hapticsEnabled: true,
    calmingInterstitialEnabled: true,
    seenTutorials: [],
    remindersEnabled: false,
    reminderHour: DEFAULT_REMINDER_HOUR,
    appearance: 'system',
  };
}

/** Early evening: after work, before bed. */
export const DEFAULT_REMINDER_HOUR = 19;

export function withReminders(settings: Settings, enabled: boolean, hour: number = settings.reminderHour): Settings {
  const clamped = Math.max(0, Math.min(23, Math.floor(hour)));
  if (settings.remindersEnabled === enabled && settings.reminderHour === clamped) return settings;
  return { ...settings, remindersEnabled: enabled, reminderHour: clamped };
}

export function withSoundEnabled(settings: Settings, enabled: boolean): Settings {
  if (settings.soundEnabled === enabled) return settings;
  return { ...settings, soundEnabled: enabled };
}

export function withHapticsEnabled(settings: Settings, enabled: boolean): Settings {
  if (settings.hapticsEnabled === enabled) return settings;
  return { ...settings, hapticsEnabled: enabled };
}

export function withCalmingInterstitialEnabled(settings: Settings, enabled: boolean): Settings {
  if (settings.calmingInterstitialEnabled === enabled) return settings;
  return { ...settings, calmingInterstitialEnabled: enabled };
}

/** Marks `tutorialId` as shown. Idempotent - showing the same one twice
 * (e.g. a queued mutation replayed - see `SettingsProvider`) is a no-op. */
export function withTutorialSeen(settings: Settings, tutorialId: string): Settings {
  if (settings.seenTutorials.includes(tutorialId)) return settings;
  return { ...settings, seenTutorials: [...settings.seenTutorials, tutorialId] };
}

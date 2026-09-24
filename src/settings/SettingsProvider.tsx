import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { setHapticsEnabled as setHapticsGate, setSoundEnabled as setSoundGate } from '../game/rendering';
import { createDefaultBackend, StorageBackend } from '../storage';
import {
  defaultSettings,
  Settings,
  withCalmingInterstitialEnabled,
  withHapticsEnabled,
  withSoundEnabled,
  withTutorialSeen,
} from './settings';
import { loadSettings, saveSettings } from './settingsStore';

/** A pure `Settings` update, replayable in order once the real loaded data
 * is available - same race-safety pattern as `PlayerProgressProvider`'s
 * `ProgressMutation`/`applyMutation` (see there for the full reasoning). */
type SettingsMutation = (settings: Settings) => Settings;

interface SettingsContextValue {
  readonly settings: Settings;
  /** False until the initial load from storage has finished. */
  readonly ready: boolean;
  setSoundEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  setCalmingInterstitialEnabled(enabled: boolean): void;
  /** Marks a one-time tutorial overlay as shown, so it never appears again. */
  markTutorialSeen(tutorialId: string): void;
  hasSeenTutorial(tutorialId: string): boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export interface SettingsProviderProps {
  children: React.ReactNode;
  /** Injectable for tests; defaults to AsyncStorage (memory fallback). */
  backend?: StorageBackend;
}

/**
 * Loads settings from storage once on mount, keeps them in React state as
 * the in-session source of truth, and writes through to storage on every
 * change - the same shape as `PlayerProgressProvider`, kept separate because
 * settings and progress are unrelated concerns with independent lifecycles.
 *
 * Also the single place that keeps `game/rendering`'s imperative sound/
 * haptics gates (`setSoundEnabled`/`setHapticsEnabled` in `haptics.ts`/
 * `sound.ts`) in sync with the persisted preference - those are plain module
 * flags rather than React state because `triggerHaptic`/`triggerSound` are
 * called imperatively from many non-hook call sites (`PressableScale`,
 * every game screen), and threading a hook through all of them would be a
 * much larger change for the same effect.
 */
export function SettingsProvider({ children, backend }: SettingsProviderProps): React.JSX.Element {
  const backendRef = useRef<StorageBackend>(backend ?? createDefaultBackend());
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const readyRef = useRef(false);
  const pendingRef = useRef<SettingsMutation[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadSettings(backendRef.current).then(loaded => {
      if (cancelled) return;

      const pending = pendingRef.current;
      pendingRef.current = [];
      readyRef.current = true;

      const resolved = pending.reduce((s, mutate) => mutate(s), loaded);
      settingsRef.current = resolved;
      setSettings(resolved);
      setReady(true);
      if (pending.length > 0) saveSettings(backendRef.current, resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the imperative gates in sync with the latest settings, including
  // the very first load (not just user-driven toggles) - so a returning
  // player who muted sound stays muted from the first tap, not just after
  // they revisit Settings.
  useEffect(() => {
    setSoundGate(settings.soundEnabled);
    setHapticsGate(settings.hapticsEnabled);
  }, [settings.soundEnabled, settings.hapticsEnabled]);

  const applyMutation = useCallback((mutate: SettingsMutation): Settings => {
    const current = settingsRef.current;
    const next = mutate(current);
    if (next === current) return current;

    settingsRef.current = next;
    setSettings(next);
    if (readyRef.current) {
      saveSettings(backendRef.current, next);
    } else {
      pendingRef.current.push(mutate);
    }
    return next;
  }, []);

  const setSoundEnabled = useCallback(
    (enabled: boolean) => {
      applyMutation(current => withSoundEnabled(current, enabled));
    },
    [applyMutation],
  );

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      applyMutation(current => withHapticsEnabled(current, enabled));
    },
    [applyMutation],
  );

  const setCalmingInterstitialEnabled = useCallback(
    (enabled: boolean) => {
      applyMutation(current => withCalmingInterstitialEnabled(current, enabled));
    },
    [applyMutation],
  );

  const markTutorialSeen = useCallback(
    (tutorialId: string) => {
      applyMutation(current => withTutorialSeen(current, tutorialId));
    },
    [applyMutation],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      ready,
      setSoundEnabled,
      setHapticsEnabled,
      setCalmingInterstitialEnabled,
      markTutorialSeen,
      hasSeenTutorial: (tutorialId: string) => settings.seenTutorials.includes(tutorialId),
    }),
    [settings, ready, setSoundEnabled, setHapticsEnabled, setCalmingInterstitialEnabled, markTutorialSeen],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Access settings. Throws if used outside `SettingsProvider`. */
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return value;
}

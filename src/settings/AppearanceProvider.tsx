import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { ColorScheme, getColorScheme, setColorScheme } from '../theme';
import { AppearancePreference } from './settings';
import { useSettings } from './SettingsProvider';

interface AppearanceContextValue {
  /** The palette the app is drawn in right now. */
  readonly scheme: ColorScheme;
  /** While true, a change of scheme waits - see `useHoldAppearance`. */
  setHeld(held: boolean): void;
}

const AppearanceContext = createContext<AppearanceContextValue>({ scheme: 'light', setHeld: () => {} });

export function resolveScheme(preference: AppearancePreference, system: string | null | undefined): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * Chooses the palette - the player's choice, or the phone's when that is
 * "System" - and switches it.
 *
 * The palette is switched *during render*, before anything below reads a
 * colour, so the first frame after a change is already in the new
 * palette; the switch is idempotent, so a repeated render is harmless.
 * The caller remounts the current screen on `scheme` (see `App.tsx`), so
 * nothing holds on to a colour read before the switch.
 *
 * A switch can be held (`useHoldAppearance`): a phone that turns dark at
 * sunset mid-puzzle would otherwise remount the board and lose the
 * player's progress on it. The new palette then lands the moment they
 * leave the puzzle.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { settings } = useSettings();
  const system = useColorScheme();
  const wanted = resolveScheme(settings.appearance, system);
  const [held, setHeld] = useState(false);
  const applied = useRef<ColorScheme>(getColorScheme());
  if (!held && applied.current !== wanted) {
    applied.current = wanted;
    setColorScheme(wanted);
  }
  const scheme = applied.current;

  // Native chrome - alerts, the keyboard, pickers - follows too. "System"
  // hands control back to the phone, so `useColorScheme` keeps reporting
  // the phone's real setting rather than the override.
  useEffect(() => {
    Appearance.setColorScheme?.(settings.appearance === 'system' ? 'unspecified' : settings.appearance);
  }, [settings.appearance]);

  const value = useMemo(() => ({ scheme, setHeld }), [scheme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** The palette the app is drawn in right now. */
export function useAppearance(): ColorScheme {
  return useContext(AppearanceContext).scheme;
}

/** Holds any change of palette while `hold` is true - for a screen whose
 * state would be lost to a remount. */
export function useHoldAppearance(hold: boolean): void {
  const { setHeld } = useContext(AppearanceContext);
  useEffect(() => {
    setHeld(hold);
    return () => setHeld(false);
  }, [hold, setHeld]);
}

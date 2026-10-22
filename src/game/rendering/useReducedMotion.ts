import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { makeMutable, SharedValue } from 'react-native-reanimated';

/**
 * Whether the OS-level "reduce motion" accessibility setting is on, kept
 * live via `AccessibilityInfo`'s change event.
 *
 * Read once when the app loads and remembered here, so a screen that
 * mounts later knows from its first frame. Each hook starting at `false`
 * until its own async check resolved meant a board's deal had already
 * begun by the time it learned motion was meant to be reduced.
 */
let current = false;
const listeners = new Set<(value: boolean) => void>();

/** The same setting on the UI thread, for worklets (the deal) that cannot
 * take a hook per piece. */
const created = makeMutable(false) as SharedValue<boolean> | boolean;
export const reducedMotionFlag: { value: boolean } = typeof created === 'object' && created !== null ? created : { value: false };

function publish(value: boolean): void {
  if (value === current) return;
  current = value;
  reducedMotionFlag.value = value;
  listeners.forEach(listener => listener(value));
}

AccessibilityInfo.isReduceMotionEnabled?.()
  .then(publish)
  .catch(() => {});
AccessibilityInfo.addEventListener?.('reduceMotionChanged', publish);

/** The setting as last known, for code that reads it once (an entrance
 * starting on mount) rather than following it. */
export function isReducedMotion(): boolean {
  return current;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(current);

  useEffect(() => {
    let mounted = true;
    listeners.add(setReduced);
    setReduced(current);
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!mounted) return;
      publish(value);
      setReduced(value);
    });
    return () => {
      mounted = false;
      listeners.delete(setReduced);
    };
  }, []);

  return reduced;
}

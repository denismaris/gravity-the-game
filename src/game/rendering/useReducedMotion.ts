import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the OS-level "reduce motion" accessibility setting is on, kept
 * live via `AccessibilityInfo`'s change event. Starts `false` (motion as
 * normal) until the initial async check resolves - a one-frame default-
 * motion flash on mount is harmless, and far better than every screen
 * blocking its first paint on this.
 *
 * Reduced motion means fewer and gentler animations, not zero: callers
 * should keep opacity/colour changes that carry meaning (a state flipping,
 * an error appearing) and drop movement, scale and overshoot.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

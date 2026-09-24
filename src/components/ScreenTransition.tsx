import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { motion } from '../theme';

export interface ScreenTransitionProps {
  /** Identifies the screen currently mounted inside. Changing it (Home ->
   * a puzzle, one puzzle -> the next, back to Home) re-triggers the
   * entrance animation - the root navigation was a hard cut before this,
   * which is the single biggest "did this app actually ship" tell in a
   * screen-to-screen flow. */
  routeKey: string;
  /** Which way the app is moving. `'forward'` (deeper - Home into a
   * puzzle, one puzzle to the next) enters from the right; `'back'`
   * (returning to Home) enters from the left. The incoming screen sliding
   * *from* the side it conceptually came from is what gives the app a
   * sense of place rather than a stack of unrelated fades. */
  direction?: 'forward' | 'back';
  children: React.ReactNode;
}

/** How far the incoming screen travels. Small on purpose - this is a hint
 * of direction, not a carousel swipe. */
const SLIDE_PX = 24;

/**
 * Fades, slides in from the direction the app is travelling, and gently
 * rises whatever it wraps into place, every time
 * `routeKey` changes. Deliberately one-directional (no shared-element
 * cross-fade, no measuring the outgoing screen) - `App`'s screens already
 * remount on navigation (see their own `key` props), so there is no
 * "outgoing" content to animate out; this only has to make the incoming
 * one feel like it arrived.
 */
export function ScreenTransition({ routeKey, direction = 'forward', children }: ScreenTransitionProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  // Captured per transition, so a re-render cannot flip the direction of
  // an animation already on its way in.
  const slideFrom = useRef(SLIDE_PX);
  slideFrom.current = direction === 'back' ? -SLIDE_PX : SLIDE_PX;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.screenEnter.duration,
      easing: motion.screenEnter.easing,
      useNativeDriver: true,
    }).start();
    // Only `routeKey` should ever restart this - `progress` is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return (
    <Animated.View
      style={[
        styles.fill,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [slideFrom.current, 0],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

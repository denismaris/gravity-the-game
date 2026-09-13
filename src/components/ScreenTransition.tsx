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
  children: React.ReactNode;
}

/**
 * Fades and gently rises whatever it wraps into place, every time
 * `routeKey` changes. Deliberately one-directional (no shared-element
 * cross-fade, no measuring the outgoing screen) - `App`'s screens already
 * remount on navigation (see their own `key` props), so there is no
 * "outgoing" content to animate out; this only has to make the incoming
 * one feel like it arrived.
 */
export function ScreenTransition({ routeKey, children }: ScreenTransitionProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

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
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
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

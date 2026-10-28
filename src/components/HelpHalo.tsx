import React, { createContext, useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { theme, themedStyles } from '../theme';
import { curve } from '../theme/motion';

/** True on a game's first real puzzle (provided by `AppRoutes`): the one
 * time the "?" deserves pointing out. */
export const FirstPuzzleContext = createContext(false);

const HALO_BREATHS = 4;

/**
 * A soft ring breathing around the "?" in a game's header, on that game's
 * first puzzle only - so a player who skipped or forgot the lesson knows
 * where the rules live. Sits behind the icon and never takes a touch.
 */
export function HelpHalo(): React.JSX.Element | null {
  const first = useContext(FirstPuzzleContext);
  const t = useSharedValue(0);
  useEffect(() => {
    // A few breaths, then rest: enough to be noticed. Breathing for as long
    // as the puzzle was open kept the whole screen drawing every frame,
    // which a phone pays for in every tap on the board.
    if (first) t.value = withRepeat(withTiming(1, { duration: 1400, easing: curve.arrive }), HALO_BREATHS, false);
  }, [first, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.9 }] }));
  if (!first) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.dot} />
      <Animated.View style={[styles.ring, ring]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.accent, opacity: 0.18 },
  ring: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: theme.colors.accent },
}));

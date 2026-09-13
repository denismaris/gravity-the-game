import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { motion, theme } from '../theme';

export interface StarRowProps {
  /** How many of the three stars are filled (0-3). */
  earned: number;
  /** Pixel size of each star glyph. */
  size?: number;
  style?: ViewStyle;
  /** Pop each star in with a staggered spring instead of showing them
   * flat/static. Only meaningful the moment this row first appears - both
   * call sites mount a fresh `StarRow` exactly when a puzzle is freshly
   * solved, so "on mount" already means "the moment worth celebrating". */
  animateIn?: boolean;
}

const SLOTS = [1, 2, 3];

/**
 * The shared three-star readout: three star glyphs, the first `earned` of
 * them filled in the accent colour, the rest drawn as faint outlines. Used
 * on both the level-select rows and the level-complete card so mastery
 * always looks the same everywhere.
 */
export function StarRow({ earned, size = 16, style, animateIn = false }: StarRowProps): React.JSX.Element {
  const pop = useRef(SLOTS.map(() => new Animated.Value(animateIn ? 0 : 1))).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.stagger(
      110,
      pop.map(value =>
        Animated.spring(value, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }),
      ),
    ).start();
    // Mount-only: `animateIn` is the "should this instance ever animate"
    // switch, not a re-trigger. `pop` is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="text"
      accessibilityLabel={`${Math.max(0, Math.min(3, earned))} of 3 stars`}
    >
      {SLOTS.map((slot, i) => (
        <Animated.Text
          key={slot}
          style={[
            styles.star,
            { fontSize: size, transform: [{ scale: pop[i] }] },
            slot <= earned ? styles.earned : styles.empty,
          ]}
        >
          {'★'}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  star: {
    marginHorizontal: 1.5,
  },
  earned: {
    color: theme.colors.accent,
  },
  empty: {
    color: theme.colors.border,
  },
});

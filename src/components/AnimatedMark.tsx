import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { motion, theme } from '../theme';

export interface AnimatedMarkProps {
  size: number;
}

/**
 * A "this cell is definitely not it" cross mark, popping in with a spring
 * the instant it mounts. Shared by every board where tapping a cell can
 * cycle through a bookkeeping "marked" state (Constellation's crossed-out
 * cell, Tents and Trees' "not a tent" note) - the mark itself carries no
 * game-specific meaning, only "the player ruled this cell out." This
 * element only exists while a cell is in that state, so mounting IS the
 * transition into it - no change-tracking needed.
 */
export function AnimatedMark({ size }: AnimatedMarkProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    // Mount-only pop - `scale` is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.Text style={[styles.mark, { fontSize: size, transform: [{ scale }] }]}>×</Animated.Text>;
}

const styles = StyleSheet.create({
  mark: {
    color: theme.colors.textTertiary,
    fontFamily: theme.typography.families.ui,
  },
});

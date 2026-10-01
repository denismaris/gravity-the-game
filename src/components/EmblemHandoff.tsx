import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { GameKind } from '../game/journey';
import { useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { GameEmblem } from './GameEmblem';

/**
 * The hand-off into a puzzle: the game's emblem blooms at the centre of a
 * veil in the page's own colour, then the veil lifts off the board. A
 * beat of ceremony between Home and a puzzle - the mark you tapped on is
 * the mark you arrive under. Native-driven; skipped under reduced motion.
 */
export function EmblemHandoff({ kind, onDone }: { kind: GameKind; onDone: () => void }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    Animated.timing(t, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onDone());
  }, [t, reduced, onDone]);
  if (reduced) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.veil, { opacity: t.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.9, 0] }) }]} />
      <Animated.View
        style={[
          styles.center,
          {
            opacity: t.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.6, 1.05, 1.35] }) }],
          },
        ]}
      >
        <GameEmblem kind={kind} size={92} />
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.background },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));

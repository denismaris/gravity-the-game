import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { StarRow } from './StarRow';
import { theme } from '../theme';

export interface PuzzleSolvedProps {
  title?: string;
  stars: 1 | 2 | 3;
  hintsUsed: number;
  onReplay: () => void;
  onDone: () => void;
  /** Whether another puzzle follows this one in the Journey. When true, the
   * primary action advances there instead of leaving to Home - this is what
   * makes finishing a Constellation or Trajectory puzzle roll on to
   * whichever game the Journey deals next, matching Gravity's own
   * `LevelCompleteCard`. */
  hasNext?: boolean;
  /** Advance to the next Journey entry (only meaningful when `hasNext`). */
  onNext?: () => void;
}

/**
 * Shared "you solved it" overlay for the Constellation and Trajectory
 * games - a quiet card with the star result and two actions. Fades and
 * scales in as an immediate reaction to the finishing move.
 */
export function PuzzleSolved({
  title = 'SOLVED',
  stars,
  hintsUsed,
  onReplay,
  onDone,
  hasNext = false,
  onNext,
}: PuzzleSolvedProps): React.JSX.Element {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [t]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.card,
          { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <StarRow earned={stars} size={30} style={styles.stars} />
        <Text style={styles.note}>
          {hintsUsed === 0 ? 'No hints used' : `${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used`}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Replay puzzle"
            onPress={onReplay}
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Replay</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasNext ? 'Next puzzle' : 'Back to home'}
            onPress={hasNext && onNext ? onNext : onDone}
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{hasNext && onNext ? 'Next ›' : 'Done ›'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  title: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 3,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  stars: { marginBottom: theme.spacing.sm },
  note: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.lg,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  primary: { backgroundColor: theme.colors.primary },
  secondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.85 },
  primaryLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  secondaryLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

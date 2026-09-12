import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { StarRating } from '../game/scoring';
import { StarRow } from './StarRow';
import { theme } from '../theme';

export interface LevelCompleteCardProps {
  /** Best star rating ever earned on this level (this solve merged in). The
   * big star row shows mastery, so a weaker replay never appears to take
   * stars away. */
  stars: StarRating;
  /** Stars earned on *this* solve specifically. When it is below `stars` the
   * card notes that the earlier, better result was kept. */
  runStars: StarRating;
  /** Gravity moves used on this solve. */
  moves: number;
  /** Fewest moves the level has ever been solved in (this solve included). */
  bestMoves: number;
  /** Whether there is a next level to advance to. */
  hasNextLevel: boolean;
  /** Replay the current level from its start. */
  onReplay: () => void;
  /** Advance to the next level (only meaningful when `hasNextLevel`). */
  onNext: () => void;
  /** Leave to the home hub (used when there is no next level). */
  onExit: () => void;
}

/**
 * Overlay shown over the board once a puzzle is solved.
 *
 * Minimal by design: a title, the three-star result, this run's move count
 * next to the persisted best, and exactly two actions - replay, or continue.
 * Fades/scales in quickly so it reads as an immediate reaction to the
 * winning move. Contains no scoring logic: it only displays the numbers it
 * is handed.
 */
export function LevelCompleteCard({
  stars,
  runStars,
  moves,
  bestMoves,
  hasNextLevel,
  onReplay,
  onNext,
  onExit,
}: LevelCompleteCardProps): React.JSX.Element {
  const isNewBest = moves === bestMoves;
  const keptBetterResult = runStars < stars;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const opacity = progress;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.title}>LEVEL COMPLETE</Text>

        <StarRow earned={stars} size={34} style={styles.stars} />

        <View style={styles.rows}>
          <Text style={styles.rowText}>
            Moves: <Text style={styles.rowValue}>{moves}</Text>
          </Text>
          <Text style={styles.rowText}>
            Best: <Text style={styles.rowValue}>{bestMoves}</Text>
          </Text>
          {isNewBest && !keptBetterResult && <Text style={styles.note}>New best</Text>}
          {keptBetterResult && <Text style={styles.note}>Your best result is kept</Text>}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Replay level"
            onPress={onReplay}
            hitSlop={8}
            style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonSecondaryLabel}>Replay</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasNextLevel ? 'Next puzzle' : 'Back to home'}
            onPress={hasNextLevel ? onNext : onExit}
            hitSlop={8}
            style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonPrimaryLabel}>
              {hasNextLevel ? 'Next Puzzle ›' : 'Back to Home'}
            </Text>
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
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  stars: {
    marginBottom: theme.spacing.md,
  },
  rows: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  rowText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
  },
  rowValue: {
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.semibold,
  },
  note: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.caption,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonPrimaryLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  buttonSecondaryLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

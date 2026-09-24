import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { StarRating } from '../game/scoring';
import { ConfettiBurst } from './ConfettiBurst';
import { PressableScale } from './PressableScale';
import { GameEmblem } from './GameEmblem';
import { GeometricRule } from './GeometricRule';
import { StarRow } from './StarRow';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, gameLabelForKind, pickEncouragement } from '../game/journey';
import { motion, theme } from '../theme';

/** Kicker, stars, praise, the moves/best rows, rule, actions - staggered
 * in that reading order, matching `PuzzleSolved`. Must equal the number of
 * distinct `rowStyle(...)` indices used below. */
const ROW_COUNT = 6;

/** Shares `PuzzleSolved`'s reasoning for keeping this outside component
 * state - see that file's own note. Kept separate from it deliberately:
 * Gravity's card and the other four games' card are different components
 * and a player alternating between them should still see variety in each. */
let lastEncouragement: string | undefined;

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
  const { backdrop, card, hero, sheen, rowStyle } = useCardEntrance(ROW_COUNT);
  const starsRow = rowStyle(1);
  const accent = accentColorForKind('gravity');
  // Gravity scores on moves rather than hints, so a flawless run is one
  // that matched the level's own optimum - `bestMoves` is exactly that
  // bar, since a three-star result is defined against it.
  const praise = useMemo(() => {
    const line = pickEncouragement(encouragementTier(stars, moves <= bestMoves ? 0 : 1), lastEncouragement);
    lastEncouragement = line;
    return line;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
      <ConfettiBurst />
      {/* Shadow on an outer wrapper: the card clips for the sheen, and a
          clipped view clips its own shadow away with it. */}
      <Animated.View
        style={[
          styles.cardShadow,
          {
            opacity: card,
            transform: [
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) },
              { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.card}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.sheen,
              {
                opacity: sheen.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { rotate: '18deg' },
                  { translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-260, 300] }) },
                ],
              },
            ]}
          />

          <Animated.View
            style={[styles.accentBand, { backgroundColor: accent, transform: [{ scaleX: card }] }]}
            pointerEvents="none"
          />

          <Animated.View
            style={[
              styles.emblem,
              {
                opacity: hero,
                transform: [
                  { scale: hero },
                  { translateY: hero.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
                ],
              },
            ]}
          >
            <GameEmblem kind="gravity" size={72} />
          </Animated.View>

          <Animated.View style={rowStyle(0)}>
            <Text style={[styles.kicker, { color: accent }]}>{gameLabelForKind('gravity')}</Text>
            <Text style={[styles.title, stars === 3 && styles.titlePerfect]}>
              {stars === 3 ? 'PERFECT' : 'LEVEL COMPLETE'}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.stars, starsRow]}>
            <StarRow earned={stars} size={40} animateIn />
          </Animated.View>

          <Animated.Text style={[styles.praise, rowStyle(2)]}>{praise}</Animated.Text>

          <Animated.View style={[styles.rows, rowStyle(3)]}>
            <Text style={styles.rowText}>
              Moves: <Text style={styles.rowValue}>{moves}</Text>
            </Text>
            <Text style={styles.rowText}>
              Best: <Text style={styles.rowValue}>{bestMoves}</Text>
            </Text>
            {isNewBest && !keptBetterResult && <Text style={styles.note}>New best</Text>}
            {keptBetterResult && <Text style={styles.note}>Your best result is kept</Text>}
          </Animated.View>

          <Animated.View style={[styles.cardRule, rowStyle(4)]}>
            <GeometricRule variant="quiet" accentColor={accent} />
          </Animated.View>

          <Animated.View style={[styles.actions, rowStyle(5)]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Replay level"
              onPress={onReplay}
              hitSlop={8}
              style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.buttonSecondaryLabel}>Replay</Text>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={hasNextLevel ? 'Next puzzle' : 'Back to home'}
              onPress={hasNextLevel ? onNext : onExit}
              hitSlop={8}
              style={({ pressed }) => [styles.button, styles.buttonPrimary, { backgroundColor: accent }, pressed && styles.pressed]}
            >
              <Text style={styles.buttonPrimaryLabel}>
                {hasNextLevel ? 'Next Puzzle ›' : 'Back to Home'}
              </Text>
            </PressableScale>
          </Animated.View>
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
  },
  /** Separated from `overlay` so the dim can fade in on its own clock -
   * `overlay` still has to be laid out from frame one. */
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
  },
  /** Carries the elevation only - the card clips, and a clipped view
   * clips its own shadow away. */
  cardShadow: {
    borderRadius: theme.radii.lg,
    // Genuinely lifted off the page, unlike this app's inline cards - it
    // floats over a dimmed board, so there's no "ghost card" double
    // elevation to avoid here.
    shadowColor: '#3B1F52',
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl + theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    maxWidth: 340,
  },
  /** The diagonal light sweep - the card's own clipping is what turns it
   * into a sweep rather than a floating bar. */
  sheen: {
    position: 'absolute',
    top: -120,
    bottom: -120,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  emblem: {
    marginBottom: theme.spacing.md,
  },
  accentBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  praise: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: theme.spacing.md,
  },
  title: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 4,
    marginBottom: theme.spacing.lg,
  },
  titlePerfect: {
    color: theme.colors.accent,
  },
  stars: {
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardRule: {
    alignSelf: 'stretch',
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

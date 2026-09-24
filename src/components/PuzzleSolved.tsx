import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ConfettiBurst } from './ConfettiBurst';
import { PressableScale } from './PressableScale';
import { GameEmblem } from './GameEmblem';
import { GeometricRule } from './GeometricRule';
import { StarRow } from './StarRow';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, gameLabelForKind, pickEncouragement } from '../game/journey';
import { motion, theme } from '../theme';

export interface PuzzleSolvedProps {
  title?: string;
  stars: 1 | 2 | 3;
  hintsUsed: number;
  /** Which game was just finished. Drives the card's accent and its
   * kicker, so a Skyscrapers finish reads as a *Skyscrapers* finish rather
   * than a generic one. Optional so an existing caller that hasn't been
   * updated still renders, just without the per-game identity. */
  kind?: GameKind;
  /** Overrides the hint-derived note entirely - for a game whose secondary
   * metric isn't hints (Ink Trail's own coverage percentage). When set,
   * `hintsUsed` is only used for `mergeLevelResult`-style bookkeeping
   * upstream, never rendered. */
  note?: string;
  onReplay: () => void;
  onDone: () => void;
  /** Whether another puzzle follows this one in the Journey. When true, the
   * primary action advances there instead of leaving to Home - this is what
   * makes finishing a puzzle roll on to whichever game the Journey deals
   * next, matching Gravity's own `LevelCompleteCard`. */
  hasNext?: boolean;
  /** Advance to the next Journey entry (only meaningful when `hasNext`). */
  onNext?: () => void;
}

/**
 * Shared "you solved it" overlay used by every puzzle screen (Mirror Maze,
 * Tents and Trees, Skyscrapers, Binairo) - a quiet card with the star
 * result and two actions. Fades and scales in as an immediate reaction to
 * the finishing move.
 */
/** Kicker+title, stars, praise, stat line, rule, actions - staggered in
 * that reading order. The emblem is not in this count: it runs on the
 * entrance's own `hero` spring, ahead of the cascade.
 *
 * This card reports exactly one puzzle. Finishing a whole level is a
 * different, rarer occasion and gets its own card (`LevelSetComplete`) -
 * folding the two together produced one panel that did neither job well. */
const ROW_COUNT = 6;

/**
 * The praise line shown on the previous solve, so the next one can avoid
 * repeating it. Module-level on purpose: this card unmounts between
 * puzzles, so component state cannot remember anything, and "don't say the
 * same thing twice in a row" is exactly a between-mounts question. Worst
 * case after a reload is one repeat, which nobody will notice.
 */
let lastEncouragement: string | undefined;

export function PuzzleSolved({
  title,
  stars,
  hintsUsed,
  kind,
  note,
  onReplay,
  onDone,
  hasNext = false,
  onNext,
}: PuzzleSolvedProps): React.JSX.Element {
  const { backdrop, card, hero, sheen, rowStyle } = useCardEntrance(ROW_COUNT);

  // Three stars is rare enough to earn its own word - the same card
  // otherwise reads identically whether the player scraped a single star or
  // played it perfectly. An explicit `title` from a caller still wins.
  const heading = title ?? (stars === 3 ? 'PERFECT' : 'SOLVED');
  const accent = kind ? accentColorForKind(kind) : theme.colors.accent;
  const kicker = kind ? gameLabelForKind(kind) : null;

  // Picked once per mount, not per render - a re-render mid-animation must
  // not swap the sentence out from under the player.
  const praise = useMemo(() => {
    const line = pickEncouragement(encouragementTier(stars, hintsUsed), lastEncouragement);
    lastEncouragement = line;
    return line;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const starsRow = rowStyle(1);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
      <ConfettiBurst />
      {/* The shadow lives on an outer wrapper because the card itself has
          to clip (`overflow: 'hidden'`) for the sheen, and a clipped view
          clips its own shadow away with it. */}
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

          {/* A band in the finished game's own accent, so the card is
              recognisably a Skyscrapers card or a Binairo card at a glance
              rather than the same anonymous panel five times over. */}
          <Animated.View
            style={[styles.accentBand, { backgroundColor: accent, transform: [{ scaleX: card }] }]}
            pointerEvents="none"
          />

          {kind && (
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
              <GameEmblem kind={kind} size={72} />
            </Animated.View>
          )}

          <Animated.View style={rowStyle(0)}>
            {kicker && <Text style={[styles.kicker, { color: accent }]}>{kicker}</Text>}
            <Text style={[styles.title, stars === 3 && styles.titlePerfect]}>{heading}</Text>
          </Animated.View>

          <Animated.View style={[styles.stars, starsRow]}>
            <StarRow earned={stars} size={40} animateIn />
          </Animated.View>

          <Animated.Text style={[styles.praise, rowStyle(2)]}>{praise}</Animated.Text>

          <Animated.Text style={[styles.note, rowStyle(3)]}>
            {note ?? (hintsUsed === 0 ? 'No hints used' : `${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used`)}
          </Animated.Text>


          <Animated.View style={[styles.cardRule, rowStyle(4)]}>
            <GeometricRule variant="quiet" accentColor={accent} />
          </Animated.View>

          <Animated.View style={[styles.actions, rowStyle(5)]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Replay puzzle"
              onPress={onReplay}
              style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryLabel}>Replay</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={hasNext ? 'Next puzzle' : 'Back to home'}
              onPress={hasNext && onNext ? onNext : onDone}
              style={({ pressed }) => [styles.button, styles.primary, { backgroundColor: accent }, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>{hasNext && onNext ? 'Next ›' : 'Done ›'}</Text>
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
   * `overlay` still has to be laid out (and hit-testable) from frame one. */
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
  },
  /** Carries the elevation only. The card clips, and a clipped view would
   * clip its own shadow away. */
  cardShadow: {
    borderRadius: theme.radii.lg,
    // The one place in this app a card really is lifted off the page
    // rather than ruled onto it - it floats over a dimmed board, so there
    // is no "ghost card" double-elevation to worry about here.
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
    // The set summary can carry five emblems side by side, which would
    // otherwise size this card wider than a narrow phone. Capped here and
    // the emblem row wraps rather than overflowing.
    maxWidth: 340,
  },
  /** The diagonal light sweep. Deliberately tall and narrow, rotated, and
   * translated clean across the card - the card's own clipping is what
   * turns it into a sweep rather than a floating bar. */
  sheen: {
    position: 'absolute',
    top: -120,
    bottom: -120,
    width: 70,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  /** A slim bar of the game's accent across the card's top edge - the
   * card clips, so it lands flush in the corners with no extra radius
   * bookkeeping. */
  accentBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  emblem: {
    marginBottom: theme.spacing.md,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 5,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  /** The line that changes every solve - given real weight, since it is
   * the only part of this card the player hasn't already read before. */
  praise: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: theme.spacing.xs,
  },
  titlePerfect: {
    color: theme.colors.accent,
  },
  stars: {
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The app's own mark, closing the result off from the actions - the
   * same phrase the masthead and every board rule carry, so a card reads
   * as part of the app rather than a floating panel. */
  cardRule: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.lg,
  },
  note: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.md,
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

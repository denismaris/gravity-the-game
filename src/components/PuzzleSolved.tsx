import React, { useEffect, useMemo, useState } from 'react';
import { DailyStanding, reportDaily } from '../backend';
import { useLastBonus, usePlayerProgress } from '../progression/PlayerProgressProvider';
import { buildDailyShare } from '../progression/shareMessage';
import { dailyKeyOf, gameDisplayName } from '../game/journey';
import { cosmeticById } from '../progression/shop';
import { formatDuration } from '../progression/timing';
import { CosmeticPreview } from './CosmeticPreview';
import { Animated, Share, StyleSheet, Text, View } from 'react-native';
import { ConfettiBurst } from './ConfettiBurst';
import { PressableScale } from './PressableScale';
import { GameEmblem } from './GameEmblem';
import { GeometricRule } from './GeometricRule';
import { StarRow } from './StarRow';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, gameLabelForKind, pickEncouragement } from '../game/journey';
import { motion, theme, themedStyles } from '../theme';
import { CoinsEarned } from './Coins';

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
  /** Coins this solve paid out, shown under the note (nothing when 0). */
  coinsEarned?: number;
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
  coinsEarned = 0,
}: PuzzleSolvedProps): React.JSX.Element {
  const { backdrop, card, hero, sheen, rowStyle } = useCardEntrance(ROW_COUNT);
  // What multiplied this solve's coins: a golden puzzle, the clean-run
  // combo, the lucky charm (see the shop).
  const bonus = useLastBonus();
  const { dailyStreak } = usePlayerProgress();
  // Today's Daily, ready to post: the share sheet, with a no-spoiler card.
  // The world's Daily: post this first solve, then show where it stands
  // among everyone's. Silent offline - the card simply does not say.
  const [world, setWorld] = useState<DailyStanding | null>(null);
  useEffect(() => {
    if (!bonus?.daily || !kind) return;
    let live = true;
    reportDaily({ dayKey: dailyKeyOf(new Date()), game: gameDisplayName(kind), ms: bonus.daily.ms, stars }).then(standing => {
      if (live) setWorld(standing);
    });
    return () => {
      live = false;
    };
    // Once, for the solve this card reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shareDaily = () => {
    if (!bonus?.daily || !kind) return;
    const message = buildDailyShare({ dayKey: dailyKeyOf(new Date()), game: gameDisplayName(kind), stars, ms: bonus.daily.ms, streak: dailyStreak });
    Share.share({ message }).catch(() => {});
  };
  const paid = coinsEarned > 0;
  // A Weekly Grand milestone's exclusive, won by this very solve.
  const won = bonus?.grandCosmetic ? cosmeticById(bonus.grandCosmetic) : undefined;

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
          <Animated.View style={[rowStyle(3), styles.coinRow]}>
            <CoinsEarned amount={coinsEarned} style={styles.coins} />
            {paid && bonus?.golden && <Text style={[styles.charm, styles.golden]}>{'GOLDEN \u00D73'}</Text>}
            {paid && bonus && bonus.comboMultiplier > 1 && (
              <Text style={[styles.charm, styles.combo]}>{`CLEAN RUN ${bonus.cleanRun} \u00B7 \u00D7${bonus.comboMultiplier}`}</Text>
            )}
            {paid && bonus?.charmed && <Text style={styles.charm}>{'LUCKY \u00D72'}</Text>}
            {bonus?.grand && <Text style={[styles.charm, styles.golden]}>{'WEEKLY GRAND \u2713\uFE0E'}</Text>}
          </Animated.View>
          {bonus?.daily && (
            <Animated.View style={[rowStyle(3), styles.duel]}>
              <Text style={styles.duelKicker}>DAILY DUEL</Text>
              <Text style={styles.duelTime}>{formatDuration(bonus.daily.ms)}</Text>
              <Text style={styles.duelNote}>
                {bonus.daily.of === 1
                  ? 'YOUR FIRST TIMED DAILY'
                  : bonus.daily.place === 1
                    ? `NEW BEST · FASTEST OF YOUR ${bonus.daily.of}`
                    : `FASTER THAN ${Math.round(bonus.daily.beat * 100)}% OF YOUR DAILIES · BEST ${formatDuration(bonus.daily.best)}`}
              </Text>
              {world && world.players > 1 && (
                <Text style={styles.worldNote}>{`FASTER THAN ${Math.round(world.fasterThan * 100)}% OF ${world.players.toLocaleString('en-US')} PLAYERS TODAY`}</Text>
              )}
              <PressableScale accessibilityRole="button" accessibilityLabel="Share today's Daily result" onPress={shareDaily} hitSlop={6} style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
                <Text style={styles.shareText}>{'Share result  ↗︎'}</Text>
              </PressableScale>
            </Animated.View>
          )}
          {won && (
            <Animated.View style={[rowStyle(3), styles.wonRow]}>
              <View style={styles.wonPreview}>
                <CosmeticPreview item={won} size={30} />
              </View>
              <Text style={styles.wonText}>{`WON: ${won.name.toUpperCase()} · NOT IN THE SHOP`}</Text>
            </Animated.View>
          )}


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

const styles = themedStyles(() => ({
  coinRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, paddingHorizontal: theme.spacing.md },
  golden: { backgroundColor: theme.colors.goldFill, borderWidth: 1, borderColor: theme.colors.goldRim, color: theme.colors.onGold },
  duel: { alignItems: 'center', marginTop: theme.spacing.sm },
  duelKicker: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 1.4, color: theme.colors.secondary },
  duelTime: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  worldNote: { marginTop: 4, fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 0.8, fontWeight: theme.typography.weights.bold, color: theme.colors.secondary, textAlign: 'center' },
  share: { marginTop: theme.spacing.sm, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  shareText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  duelNote: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 0.8, color: theme.colors.textTertiary, textAlign: 'center' },
  wonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.goldRim,
  },
  wonPreview: { width: 34, height: 34, borderRadius: 9, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  wonText: {
    fontFamily: theme.typography.families.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  combo: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.textPrimary },
  charm: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.colors.accent,
    color: theme.colors.surfaceHi,
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
  },
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
    shadowColor: theme.colors.shadow,
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
    backgroundColor: theme.colors.sheen,
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
  coins: { marginTop: -theme.spacing.xs, marginBottom: theme.spacing.md },
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
}));

import React, { useEffect, useMemo, useState } from 'react';
import { DailyStanding, reportDaily } from '../backend';
import { useLastBonus, usePlayerProgress } from '../progression/PlayerProgressProvider';
import { INTRO_SOLVES, nextGameToArrive } from '../progression/batches';
import { buildDailyShare } from '../progression/shareMessage';
import { dailyKeyOf, gameDisplayName, gameShortName } from '../game/journey';
import { cosmeticById } from '../progression/shop';
import { formatDuration } from '../progression/timing';
import { CosmeticPreview } from './CosmeticPreview';
import { Animated, Share, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { GameEmblem } from './GameEmblem';
import { StarRow } from './StarRow';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, pickEncouragement } from '../game/journey';
import { motion, theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { ModalLayer } from './ModalLayer';

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
  /** The label under `note` in the result strip ("MOVES", "POINTS"). */
  noteLabel?: string;
  onReplay: () => void;
  onDone: () => void;
  /** Whether another puzzle follows this one in the Journey. When true, the
   * primary action advances there instead of leaving to Home - this is what
   * makes finishing a puzzle roll on to whichever game the Journey deals
   * next. */
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
/** Kicker+title, stars, praise, stat line, actions - staggered in
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
  noteLabel = 'RESULT',
  onReplay,
  onDone,
  hasNext = false,
  onNext,
  coinsEarned = 0,
}: PuzzleSolvedProps): React.JSX.Element {
  const { backdrop, card, hero, rowStyle } = useCardEntrance(ROW_COUNT);
  // What multiplied this solve's coins: a golden puzzle, the clean-run
  // combo, the lucky charm (see the shop).
  const bonus = useLastBonus();
  const { dailyStreak, progress } = usePlayerProgress();
  // While a game is being learned, every solve of it moves the next game
  // closer - shown here, where the solve happens.
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  const towardNext = arriving && kind === arriving.gate ? arriving : null;
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
  const heading = title ?? (stars === 3 ? 'Perfect' : 'Solved');
  const accent = kind ? accentColorForKind(kind) : theme.colors.accent;
  const kicker = kind ? gameDisplayName(kind) : null;

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
    <ModalLayer>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
        {/* The shadow lives on an outer wrapper because the card itself
            clips (`overflow: 'hidden'`), and a clipped view clips its own
            shadow away with it. */}
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
                <GameEmblem kind={kind} size={64} />
              </Animated.View>
            )}

            <Animated.View style={rowStyle(0)}>
              {kicker && <Text style={[styles.kicker, { color: accent }]}>{kicker}</Text>}
              <Text style={[styles.title, stars === 3 && styles.titlePerfect]}>{heading}</Text>
            </Animated.View>

            <Animated.View style={[styles.stars, starsRow]}>
              <StarRow earned={stars} size={46} animateIn />
            </Animated.View>

            <Animated.Text style={[styles.praise, rowStyle(2)]}>{praise}</Animated.Text>

            {/* What the solve paid, in one quiet line. */}
            <Animated.View style={[styles.result, rowStyle(3)]}>
              {paid && (
                <>
                  <CoinGlyph size={14} />
                  <Text style={[styles.resultText, styles.resultGold]}>{`+${coinsEarned}`}</Text>
                  <Text style={styles.resultDot}>·</Text>
                </>
              )}
              <Text style={styles.resultText}>
                {note ? `${note} ${noteLabel.toLowerCase()}` : hintsUsed === 0 ? 'No Insight used' : `${hintsUsed} Insight used`}
              </Text>
            </Animated.View>

            {towardNext && (
              <Animated.View style={[styles.toward, rowStyle(3)]}>
                <View style={styles.towardHead}>
                  <Text style={styles.towardText}>{`Next game: ${gameShortName(towardNext.kind)}`}</Text>
                  <Text style={styles.towardCount}>{`${towardNext.done}/${INTRO_SOLVES}`}</Text>
                </View>
                <View style={styles.towardTrack}>
                  <View style={[styles.towardFill, { width: `${(towardNext.done / INTRO_SOLVES) * 100}%`, backgroundColor: accent }]} />
                </View>
              </Animated.View>
            )}

            <Animated.View style={[rowStyle(3), styles.coinRow]}>
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


            {/* One clear way on, full width; Replay as a quiet second. */}
            <Animated.View style={[styles.actions, rowStyle(5)]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={hasNext ? 'Next puzzle' : 'Back to home'}
                onPress={hasNext && onNext ? onNext : onDone}
                containerStyle={styles.primaryWrap}
                style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel}>{hasNext && onNext ? 'Next puzzle ›' : 'Done'}</Text>
              </PressableScale>
              <PressableScale accessibilityRole="button" accessibilityLabel="Replay puzzle" onPress={onReplay} hitSlop={8} style={({ pressed }) => [styles.replay, pressed && styles.pressed]}>
                <Text style={styles.secondaryLabel}>Replay</Text>
              </PressableScale>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </ModalLayer>
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
    width: '86%',
    maxWidth: 340,
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
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl + theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    // The set summary can carry five emblems side by side, which would
    // otherwise size this card wider than a narrow phone. Capped here and
    // the emblem row wraps rather than overflowing.
    maxWidth: 340,
  },
  emblem: {
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.md },
  resultText: { fontSize: theme.typography.sizes.body, color: theme.colors.textSecondary },
  resultGold: { color: theme.colors.accentText, fontWeight: theme.typography.weights.semibold },
  resultDot: { fontSize: theme.typography.sizes.body, color: theme.colors.textTertiary },
  toward: { alignSelf: 'stretch', marginTop: theme.spacing.sm, gap: 6 },
  towardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  towardText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  towardCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  towardTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.border },
  towardFill: { height: 6, borderRadius: 3 },
  kicker: {
    fontSize: theme.typography.sizes.caption + 1,
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: 38,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
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
    color: theme.colors.accentText,
  },
  stars: {
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.md,
  },
  coins: { marginTop: -theme.spacing.xs, marginBottom: theme.spacing.md },
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.xl },
  primaryWrap: { alignSelf: 'stretch' },
  button: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
  },
  replay: { paddingHorizontal: theme.spacing.md, paddingVertical: 6 },
  primary: { backgroundColor: theme.colors.primary },
  secondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: { opacity: 0.85 },
  primaryLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body + 1,
    fontWeight: theme.typography.weights.semibold,
  },
  secondaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
}));

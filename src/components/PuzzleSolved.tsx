import React, { useEffect, useMemo, useState } from 'react';
import { DailyStanding, reportDaily } from '../backend';
import { useLastBonus, usePlayerProgress } from '../progression/PlayerProgressProvider';
import { INTRO_SOLVES, nextGameToArrive } from '../progression/batches';
import { dailyKeyOf, gameDisplayName, gameShortName, getDailyEntry } from '../game/journey';
import { cosmeticById } from '../progression/shop';
import { formatDuration } from '../progression/timing';
import { CosmeticPreview } from './CosmeticPreview';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { GameEmblem } from './GameEmblem';
import { StarRow } from './StarRow';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, pickEncouragement } from '../game/journey';
import { motion, theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { ModalLayer } from './ModalLayer';
import { DialogActions } from './dialog';
import { TileGlyph } from './TileGlyph';

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
  noteLabel = 'result',
  onDone,
  hasNext = false,
  onNext,
  coinsEarned = 0,
}: PuzzleSolvedProps): React.JSX.Element {
  const { backdrop, card, hero, rowStyle } = useCardEntrance(ROW_COUNT);
  // What multiplied this solve's coins: a golden puzzle, the clean-run
  // combo, the lucky charm (see the shop).
  const bonus = useLastBonus();
  const { progress } = usePlayerProgress();
  // While a game is being learned, every solve of it moves the next game
  // closer - shown here, where the solve happens.
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  const towardNext = arriving && kind === arriving.gate ? arriving : null;
  // Today's Daily, ready to post: the share sheet, with a no-spoiler card.
  // The world's Daily: post this first solve, then show where it stands
  // among everyone's. Silent offline - the card simply does not say.
  const [world, setWorld] = useState<DailyStanding | null>(null);
  useEffect(() => {
    if (!bonus?.daily || !kind || !getDailyEntry().shared) return;
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
  const paid = coinsEarned > 0;
  const tiles = bonus?.tesserae ?? 0;
  // The multipliers behind this solve's coins, in one plain line.
  const bonusLine =
    [
      paid && bonus?.golden ? 'Golden puzzle \u00D73' : null,
      paid && bonus && bonus.comboMultiplier > 1 ? `Clean run of ${bonus.cleanRun} \u00D7${bonus.comboMultiplier}` : null,
      paid && bonus?.charmed ? 'Lucky charm \u00D72' : null,
      bonus?.grand ? 'Weekly Grand solved' : null,
    ]
      .filter(Boolean)
      .join(' \u00B7 ') || null;
  // The Daily's clock. The first solve of the day is the official time
  // (ranked, posted, shareable); a replay still shows how long it took.
  const daily = bonus?.daily
    ? {
        official: true,
        ms: bonus.daily.ms,
        note:
          bonus.daily.of === 1
            ? 'Your first timed Daily'
            : bonus.daily.place === 1
              ? `Your best of ${bonus.daily.of} Dailies`
              : `Faster than ${Math.round(bonus.daily.beat * 100)}% of your Dailies. Best ${formatDuration(bonus.daily.best)}`,
      }
    : bonus?.dailyReplayMs
      ? { official: false, ms: bonus.dailyReplayMs, note: 'A replay. Your first solve today is the time that counts.' }
      : null;
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
                <GameEmblem kind={kind} size={58} />
              </Animated.View>
            )}

            <Animated.View style={rowStyle(0)}>
              {kicker && <Text style={[styles.kicker, { color: accent }]}>{kicker}</Text>}
              <Text style={[styles.title, stars === 3 && styles.titlePerfect]}>{heading}</Text>
            </Animated.View>

            <Animated.View style={[styles.stars, starsRow]}>
              <StarRow earned={3} size={46} animateIn />
            </Animated.View>

            <Animated.Text style={[styles.praise, rowStyle(2)]}>{praise}</Animated.Text>

            {/* What the solve paid: one quiet panel, a column per reward. */}
            <Animated.View style={[styles.ledger, rowStyle(3)]}>
              <View style={styles.ledgerRow}>
                {paid && (
                  <View style={styles.stat}>
                    <View style={styles.statValue}>
                      <CoinGlyph size={15} />
                      <Text style={[styles.statNumber, styles.statGold]}>{`+${coinsEarned}`}</Text>
                    </View>
                    <Text style={styles.statLabel}>coins</Text>
                  </View>
                )}
                {tiles > 0 && (
                  <>
                    {paid && <View style={styles.statRule} />}
                    <View style={styles.stat}>
                      <View style={styles.statValue}>
                        <TileGlyph size={14} />
                        <Text style={[styles.statNumber, styles.statTiles]}>{`+${tiles}`}</Text>
                      </View>
                      <Text style={styles.statLabel}>tiles</Text>
                    </View>
                  </>
                )}
                {(paid || tiles > 0) && <View style={styles.statRule} />}
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{note ?? String(hintsUsed)}</Text>
                  <Text style={styles.statLabel}>{note ? noteLabel.toLowerCase() : 'Insight used'}</Text>
                </View>
              </View>
              {bonusLine && <Text style={styles.bonusLine}>{bonusLine}</Text>}
              {daily && (
                <View style={styles.daily}>
                  <View style={styles.dailyHead}>
                    <Text style={styles.dailyLabel}>{daily.official ? 'Daily time' : 'This time'}</Text>
                    <Text style={styles.dailyTime}>{formatDuration(daily.ms)}</Text>
                  </View>
                  <Text style={styles.dailyNote}>{daily.note}</Text>
                  {world && world.players > 1 && daily.official && (
                    <Text style={styles.dailyWorld}>{`Faster than ${Math.round(world.fasterThan * 100)}% of ${world.players.toLocaleString('en-US')} players today`}</Text>
                  )}
                </View>
              )}
              {won && (
                <View style={styles.wonRow}>
                  <View style={styles.wonPreview}>
                    <CosmeticPreview item={won} size={30} />
                  </View>
                  <Text style={styles.wonText}>{`You won ${won.name}. It is never sold in the shop.`}</Text>
                </View>
              )}
            </Animated.View>

            {towardNext && (
              <Animated.View style={[styles.toward, rowStyle(4)]}>
                <GameEmblem kind={towardNext.kind} size={30} />
                <View style={styles.towardBody}>
                  <View style={styles.towardHead}>
                    <Text style={styles.towardText} numberOfLines={1}>{`Next: ${gameShortName(towardNext.kind)}`}</Text>
                    <Text style={styles.towardCount}>{`${towardNext.done}/${INTRO_SOLVES}`}</Text>
                  </View>
                  <View style={styles.towardTrack}>
                    <View style={[styles.towardFill, { width: `${(towardNext.done / INTRO_SOLVES) * 100}%`, backgroundColor: accent }]} />
                  </View>
                </View>
              </Animated.View>
            )}

            {/* One clear way on. Home stays a quiet second only when the
                primary goes on to another puzzle. */}
            <Animated.View style={[styles.actions, rowStyle(5)]}>
              <DialogActions
                primary={hasNext && onNext ? { label: 'Next puzzle', onPress: onNext } : { label: 'Done', onPress: onDone, accessibilityLabel: 'Back to home' }}
                secondary={hasNext && onNext ? { label: 'Home', onPress: onDone, accessibilityLabel: 'Back to home' } : undefined}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  /** Separated from `overlay` so the dim can fade in on its own clock. */
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  /** Carries the elevation only: the card clips, and a clipped view would
   * clip its own shadow away. */
  cardShadow: {
    width: '86%',
    maxWidth: 340,
    borderRadius: 30,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  emblem: { marginBottom: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, textAlign: 'center' },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: 36,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  titlePerfect: { color: theme.colors.accentText },
  stars: { marginBottom: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  /** The line that changes every solve. */
  praise: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  ledger: { alignSelf: 'stretch', marginTop: theme.spacing.md, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 20, backgroundColor: theme.colors.surfaceAlt, gap: 10 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statNumber: { fontSize: theme.typography.sizes.title - 3, fontWeight: theme.typography.weights.bold, fontVariant: ['tabular-nums'], color: theme.colors.textPrimary },
  statGold: { color: theme.colors.accentText },
  statTiles: { color: theme.colors.secondary },
  statLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4, backgroundColor: theme.colors.borderStrong },
  bonusLine: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.accentText, textAlign: 'center' },
  daily: { alignItems: 'center', gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderStrong },
  dailyHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dailyLabel: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
  dailyTime: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  dailyNote: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, textAlign: 'center' },
  dailyWorld: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary, textAlign: 'center' },
  share: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  shareText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  wonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderStrong },
  wonPreview: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  wonText: { flex: 1, fontSize: theme.typography.sizes.caption + 1, lineHeight: 17, color: theme.colors.textPrimary },
  toward: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md, paddingHorizontal: 4 },
  towardBody: { flex: 1, gap: 6 },
  towardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  towardText: { flex: 1, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  towardCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  towardTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.border },
  towardFill: { height: 6, borderRadius: 3 },
  actions: { alignSelf: 'stretch' },
  primaryWrap: { alignSelf: 'stretch' },
  button: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill },
  primary: { backgroundColor: theme.colors.primary },
  primaryLabel: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold },
  quiet: { paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  quietLabel: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  pressed: { opacity: 0.85 },
}));

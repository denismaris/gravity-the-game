import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DailyStanding, reportDaily } from '../backend';
import { useIsPractice, useLastBonus, usePlayerProgress } from '../progression/PlayerProgressProvider';
import { nextGameToArrive } from '../progression/batches';
import { dailyKeyOf, gameDisplayName, gameShortName, getDailyEntry } from '../game/journey';
import { cosmeticById } from '../progression/shop';
import { formatDuration } from '../progression/timing';
import { CosmeticPreview } from './CosmeticPreview';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEmblem } from './GameEmblem';
import { isReducedMotion, triggerFeedback } from '../game/rendering';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, pickEncouragement } from '../game/journey';
import { theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { GOLDEN_MULTIPLIER } from '../progression/coins';
import { ModalLayer } from './ModalLayer';
import { DialogActions } from './dialog';
import { curve } from '../theme/motion';
import { headerEmblemSpot, lendHeaderEmblem } from './PlayHeader';

export interface PuzzleSolvedProps {
  title?: string;
  /** Kept for what the solve paid and praise (a hint-free solve earns a
   * little more); never shown - the card has no stars. */
  stars?: 1 | 2 | 3;
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
 * Shared "you solved it" card used by every puzzle screen. No stars: the
 * point is finishing, so the card says it was solved - and, quietly,
 * whether it took a hint - with the game's emblem stamped at the top, what
 * the solve paid counting up, and the way on.
 */
/** Kicker and title, the praise and its note, what it paid, the way on to
 * the next game, the actions - staggered in that reading order. The emblem is not in this count: it runs on the
 * entrance's own `hero` spring, ahead of the cascade.
 *
 * This card reports exactly one puzzle. Finishing a whole level is a
 * different, rarer occasion and gets its own card (`LevelSetComplete`) -
 * folding the two together produced one panel that did neither job well. */
const ROW_COUNT = 5;

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
  stars = 3,
  hintsUsed,
  kind,
  note,
  noteLabel = 'result',
  onDone,
  hasNext = false,
  onNext,
  coinsEarned = 0,
}: PuzzleSolvedProps): React.JSX.Element {
  // The header's emblem, carried down into this page (see `EmblemFlight`):
  // the page builds round it a moment after it lifts.
  const flyFrom = useRef(kind && !isReducedMotion() ? headerEmblemSpot() : null).current;
  const { backdrop, hero, rowStyle } = useCardEntrance(ROW_COUNT, { delay: flyFrom ? FLIGHT_LEAD_MS : 0 });
  // What multiplied this solve's coins: a golden puzzle, the clean-run
  // combo, the lucky charm (see the shop).
  const bonus = useLastBonus();
  const { progress } = usePlayerProgress();
  // While a game is being learned, every solve of it moves the next game
  // closer - shown here, where the solve happens.
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  // A practice board moves nothing on, so it says nothing about what is next.
  const practice = useIsPractice();
  const towardNext = !practice && arriving && kind === arriving.gate ? arriving : null;
  // Today's Daily, ready to post: the share sheet, with a no-spoiler card.
  // The world's Daily: post this first solve, then show where it stands
  // among everyone's. Silent offline - the card simply does not say.
  const [world, setWorld] = useState<DailyStanding | null>(null);
  useEffect(() => {
    if (!bonus?.daily || !kind) return;
    let live = true;
    const daily = getDailyEntry();
    reportDaily({ dayKey: dailyKeyOf(new Date()), game: gameDisplayName(kind), ms: bonus.daily.ms, stars, board: daily.shared ? null : daily.puzzleId }).then(standing => {
      if (live) setWorld(standing);
    });
    return () => {
      live = false;
    };
    // Once, for the solve this card reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const paid = coinsEarned > 0;
  // The multipliers behind this solve's coins, in one plain line.
  const bonusLine =
    [
      paid && bonus?.golden ? `Golden puzzle \u00D7${GOLDEN_MULTIPLIER}` : null,
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

  const heading = title ?? 'Solved';
  // In place of stars, one quiet fact about how it went.
  const howItWent = note ? null : hintsUsed === 0 ? 'Without a hint' : hintsUsed === 1 ? 'With one hint' : `With ${hintsUsed} hints`;
  const accent = kind ? accentColorForKind(kind) : theme.colors.accent;
  const insets = useSafeAreaInsets();
  const kicker = kind ? (practice ? `${gameDisplayName(kind)} · Practice` : gameDisplayName(kind)) : null;

  // Picked once per mount, not per render - a re-render mid-animation must
  // not swap the sentence out from under the player.
  const praise = useMemo(() => {
    const line = pickEncouragement(encouragementTier(stars, hintsUsed), lastEncouragement, Math.random, kind ?? undefined);
    lastEncouragement = line;
    return line;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // The figures under the title: how it went, what it paid, the clock.
  const figures: Array<{ key: string; label: string; node: React.ReactNode }> = [];
  if (howItWent) figures.push({ key: 'hints', label: hintsUsed === 1 ? 'Hint' : 'Hints', node: <Text style={[styles.figure, hintsUsed === 0 && { color: accent }]}>{hintsUsed === 0 ? 'None' : String(hintsUsed)}</Text> });
  if (note) figures.push({ key: 'note', label: noteLabel.charAt(0).toUpperCase() + noteLabel.slice(1).toLowerCase(), node: <Text style={styles.figure}>{note}</Text> });
  if (daily) figures.push({ key: 'time', label: daily.official ? 'Daily time' : 'This time', node: <Text style={styles.figure}>{formatDuration(daily.ms)}</Text> });
  if (paid)
    figures.push({
      key: 'coins',
      label: 'Coins',
      node: (
        <View style={styles.coinFigure}>
          <CoinGlyph size={18} />
          <CountUp value={coinsEarned} style={[styles.figure, styles.coinNumber]} />
        </View>
      ),
    });

  return (
    <ModalLayer>
      <View style={styles.overlay} pointerEvents="box-none">
        {/* The whole screen, in the paper's own colour and see-through: the
            finished board stays faintly there behind what it earned. No
            card, no sheet, no rules: the page itself is the moment. */}
        <Animated.View style={[styles.veil, { opacity: backdrop }]} pointerEvents="none" />
        <View style={[styles.page, { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.md }]} pointerEvents="box-none">
          <View style={styles.above} />
          <View style={styles.column}>
            {kind &&
              (flyFrom ? (
                <EmblemFlight kind={kind} from={flyFrom} />
              ) : (
                <Animated.View style={[styles.emblem, { opacity: hero, transform: [{ scale: hero.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1] }) }] }]}>
                  <GameEmblem kind={kind} size={FINISH_EMBLEM} raised />
                </Animated.View>
              ))}
            <Animated.View style={rowStyle(0)}>
              {kicker && <Text style={[styles.kicker, { color: accent }]}>{kicker}</Text>}
              <Text style={styles.title}>{heading === 'Solved' ? 'Solved.' : heading}</Text>
            </Animated.View>
            <Animated.View style={rowStyle(1)}>
              <Text style={styles.praise}>{praise}</Text>
            </Animated.View>

            {figures.length > 0 && (
              <Animated.View style={[styles.figures, rowStyle(2)]}>
                {figures.map(f => (
                  <View key={f.key} style={styles.figureCell}>
                    {f.node}
                    <Text style={styles.figureLabel}>{f.label}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.View style={[styles.notes, rowStyle(2)]}>
              {bonusLine && <Text style={styles.bonusLine}>{bonusLine}</Text>}
              {daily && <Text style={styles.note}>{daily.note}</Text>}
              {daily && world && world.players > 1 && daily.official && (
                <Text style={styles.note}>{`Faster than ${Math.round(world.fasterThan * 100)}% of ${world.players.toLocaleString('en-US')} players today`}</Text>
              )}
              {won && (
                <View style={styles.wonRow}>
                  <CosmeticPreview item={won} size={28} />
                  <Text style={styles.wonText}>{`You won ${won.name}. It is never sold in the shop.`}</Text>
                </View>
              )}
            </Animated.View>

            {towardNext && (
              <Animated.View style={[styles.toward, rowStyle(3)]}>
                <GameEmblem kind={towardNext.kind} size={24} />
                <Text style={styles.towardText} numberOfLines={1}>
                  {`${gameShortName(towardNext.kind)} opens in ${towardNext.need - towardNext.done} ${towardNext.need - towardNext.done === 1 ? 'solve' : 'solves'}`}
                </Text>
              </Animated.View>
            )}
          </View>
          <View style={styles.below} />

          {/* The way on, docked where the thumb is, as the game's keys are.
              Home stays a quiet second only when the primary goes on. */}
          <Animated.View style={[styles.actions, rowStyle(4)]}>
            <DialogActions
              primary={hasNext && onNext ? { label: 'Next puzzle', onPress: onNext, onward: true } : { label: 'Done', onPress: onDone, accessibilityLabel: 'Back to home' }}
              secondary={hasNext && onNext ? { label: 'Home', onPress: onDone, accessibilityLabel: 'Back to home' } : undefined}
            />
          </Animated.View>
        </View>
      </View>
    </ModalLayer>
  );
}

/** The emblem on this page. */
const FINISH_EMBLEM = 84;
/** The emblem lifts out of the header this long before the page builds
 * round it. */
const FLIGHT_LEAD_MS = 200;
/** Header to page, start to settled. */
const FLIGHT_MS = 680;
/** How high it bows above its straight line, at the middle of the flight. */
const FLIGHT_ARC = 34;
/** The small give as it lands: a few points of size, out and back. */
const LAND_GIVE = 0.07;

/** The flight, sampled once for the native driver. */
const FLIGHT_STEPS = Array.from({ length: 25 }, (_v, i) => i / 24);
function travel(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The game's emblem, lifted out of the board's header and carried down to
 * the head of this page: up a little off its line, across, growing to its
 * full size with a small give as it lands, a turn straightening on the
 * way. One clock on the native driver; the header's own emblem is lent
 * (hidden) while this one is out, so there is only ever one.
 */
function EmblemFlight({ kind, from }: { kind: GameKind; from: { x: number; y: number; width: number } }): React.JSX.Element {
  const slot = useRef<React.ElementRef<typeof View>>(null);
  const t = useRef(new Animated.Value(0)).current;
  const [path, setPath] = useState<{ dx: number; dy: number; scale: number } | null>(null);
  // Lent the moment this one is drawn in its place, never a frame before.
  useEffect(() => () => lendHeaderEmblem(false), []);
  const measure = () => {
    if (path) return;
    slot.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w <= 0) return;
      setPath({ dx: from.x - (x + w / 2), dy: from.y - (y + h / 2), scale: from.width / w });
    });
  };
  useEffect(() => {
    if (!path) return;
    lendHeaderEmblem(true);
    Animated.timing(t, { toValue: 1, duration: FLIGHT_MS, easing: curve.linear, useNativeDriver: true }).start(({ finished }) => {
      if (finished) triggerFeedback('stamp');
    });
  }, [path, t]);
  const along = (f: (k: number) => number) => t.interpolate({ inputRange: FLIGHT_STEPS, outputRange: FLIGHT_STEPS.map(f) });
  return (
    <View ref={slot} collapsable={false} onLayout={measure} style={[styles.emblem, !path && styles.unplaced]}>
      <Animated.View
        style={
          path && {
            transform: [
              { translateX: along(k => path.dx * (1 - travel(k))) },
              { translateY: along(k => path.dy * (1 - travel(k)) - FLIGHT_ARC * Math.sin(Math.PI * k)) },
              { rotate: along(k => -10 * (1 - curve.arrive(k))).interpolate({ inputRange: [-10, 0], outputRange: ['-10deg', '0deg'] }) },
              { scale: along(k => path.scale + (1 - path.scale) * travel(k) + LAND_GIVE * Math.sin(Math.PI * Math.min(1, Math.max(0, (k - 0.72) / 0.28)))) },
            ],
          }
        }
      >
        <GameEmblem kind={kind} size={FINISH_EMBLEM} raised />
      </Animated.View>
    </View>
  );
}

/** A reward counting up to its value as it lands. */
function CountUp({ value, style, delay = 0 }: { value: number; style: React.ComponentProps<typeof Text>['style']; delay?: number }): React.JSX.Element {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = new Animated.Value(0);
    const id = t.addListener(({ value: v }) => setShown(Math.round(v)));
    let live = true;
    Animated.sequence([Animated.delay(420 + delay), Animated.timing(t, { toValue: value, duration: 620, easing: curve.arrive, useNativeDriver: false })]).start(({ finished }) => {
      // The coins, heard as they land.
      if (finished && live && value > 0) triggerFeedback('coin');
    });
    return () => {
      live = false;
      t.removeListener(id);
    };
  }, [value, delay]);
  return <Text style={style}>{`+${shown}`}</Text>;
}

const styles = themedStyles(() => ({
  overlay: { ...StyleSheet.absoluteFill },
  /** The page's paper over the board, see-through. */
  veil: { ...StyleSheet.absoluteFill, backgroundColor: `${theme.colors.background}F5` },
  page: { flex: 1, paddingHorizontal: theme.spacing.xl },
  // The column sits a little above the middle of the room over the keys.
  above: { flex: 1 },
  below: { flex: 1.3 },
  column: { alignSelf: 'center', width: '100%', maxWidth: 420, alignItems: 'center' },
  emblem: { marginBottom: theme.spacing.lg },
  /** Measured, not yet drawn: the header's emblem is still in its place. */
  unplaced: { opacity: 0 },
  kicker: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, letterSpacing: 1.8, textTransform: 'uppercase', textAlign: 'center' },
  title: { marginTop: 6, fontFamily: theme.typography.families.display, fontSize: 56, lineHeight: 62, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  /** The line that changes every solve. */
  praise: { marginTop: 4, fontFamily: theme.typography.families.display, fontSize: 19, lineHeight: 26, color: theme.colors.textSecondary, textAlign: 'center' },
  // The facts as figures, spaced apart: no leaders, no rules.
  figures: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xl, marginTop: theme.spacing.xl },
  figureCell: { alignItems: 'center', minWidth: 64 },
  figure: { fontFamily: theme.typography.families.figures, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: theme.typography.sizes.headline, lineHeight: 34, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  coinFigure: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinNumber: { color: theme.colors.accentText },
  figureLabel: { marginTop: 2, fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.textTertiary },
  notes: { alignItems: 'center', gap: 4, marginTop: theme.spacing.md },
  bonusLine: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.accentText, textAlign: 'center' },
  note: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, textAlign: 'center' },
  wonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.sm },
  wonText: { flexShrink: 1, fontSize: theme.typography.sizes.body, color: theme.colors.textPrimary },
  toward: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.lg },
  towardText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  actions: { alignSelf: 'center', width: '100%', maxWidth: 420 },
}));

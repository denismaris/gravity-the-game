import React, { useEffect, useMemo, useState } from 'react';
import { DailyStanding, reportDaily } from '../backend';
import { useIsPractice, useLastBonus, usePlayerProgress } from '../progression/PlayerProgressProvider';
import { nextGameToArrive } from '../progression/batches';
import { dailyKeyOf, gameDisplayName, gameShortName, getDailyEntry } from '../game/journey';
import { cosmeticById } from '../progression/shop';
import { formatDuration } from '../progression/timing';
import { CosmeticPreview } from './CosmeticPreview';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEmblem } from './GameEmblem';
import { triggerFeedback } from '../game/rendering';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, encouragementTier, GameKind, pickEncouragement } from '../game/journey';
import { theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { GOLDEN_MULTIPLIER } from '../progression/coins';
import { ModalLayer } from './ModalLayer';
import { DialogActions } from './dialog';

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
  const { backdrop, card, cardOpacity, hero, rowStyle } = useCardEntrance(ROW_COUNT);
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


  return (
    <ModalLayer>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
        {/* A page, not a card: the whole screen in the paper's own colour,
            a little see-through, so the finished board shows faintly behind
            what it earned. It rises in gently rather than popping. */}
        <Animated.View
          style={[
            styles.cardShadow,
            {
              opacity: cardOpacity,
              transform: [
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) },
              ],
            },
          ]}
        >
          <View style={[styles.card, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            {/* The game's emblem, seated on the sheet's top edge. */}
            {kind && (
              <Animated.View style={[styles.seat, { opacity: hero, transform: [{ scale: hero.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1] }) }] }]}>
                <GameEmblem kind={kind} size={68} raised />
              </Animated.View>
            )}
            {/* Laid out like a page of the almanac rather than a centred
                badge: the game and the puzzle at the head, one large word,
                a line about how it went, then the facts as index lines with
                dotted leaders - the way a printed results column reads. */}
            <View style={styles.page}>
              <Animated.View style={[styles.head, rowStyle(0)]}>
                {kicker && <Text style={[styles.kicker, { color: accent }]}>{kicker}</Text>}
              </Animated.View>
              <Animated.View style={rowStyle(0)}>
                <Text style={styles.title}>{heading === 'Solved' ? 'Solved.' : heading}</Text>
              </Animated.View>
              <Animated.View style={rowStyle(1)}>
                <Text style={styles.praise}>{praise}</Text>
              </Animated.View>

              <Animated.View style={[styles.ledger, rowStyle(2)]}>
                {howItWent && <LedgerLine label="Hints" value={hintsUsed === 0 ? 'none' : String(hintsUsed)} strong={hintsUsed === 0} accent={accent} />}
                {note && <LedgerLine label={noteLabel.charAt(0) + noteLabel.slice(1).toLowerCase()} value={note} />}
                {daily && <LedgerLine label={daily.official ? 'Daily time' : 'This time'} value={formatDuration(daily.ms)} />}
                {paid && (
                  <LedgerLine label="Coins" accent={accent}>
                    <View style={styles.coinValue}>
                      <CoinGlyph size={14} />
                      <CountUp value={coinsEarned} style={styles.coinNumber} />
                    </View>
                  </LedgerLine>
                )}
                {bonusLine && <Text style={styles.bonusLine}>{bonusLine}</Text>}
                {daily && <Text style={styles.dailyNote}>{daily.note}</Text>}
                {daily && world && world.players > 1 && daily.official && (
                  <Text style={styles.dailyNote}>{`Faster than ${Math.round(world.fasterThan * 100)}% of ${world.players.toLocaleString('en-US')} players today`}</Text>
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
              <Animated.View style={[styles.toward, rowStyle(3)]}>
                <GameEmblem kind={towardNext.kind} size={30} />
                <View style={styles.towardBody}>
                  <View style={styles.towardHead}>
                    <Text style={styles.towardText} numberOfLines={1}>{`Next: ${gameShortName(towardNext.kind)}`}</Text>
                    <Text style={styles.towardCount}>{`${towardNext.done}/${towardNext.need}`}</Text>
                  </View>
                  <View style={styles.towardTrack}>
                    <View style={[styles.towardFill, { width: `${(towardNext.done / towardNext.need) * 100}%`, backgroundColor: accent }]} />
                  </View>
                </View>
              </Animated.View>
            )}

            </View>

            {/* One clear way on. Home stays a quiet second only when the
                primary goes on to another puzzle. */}
            <Animated.View style={[styles.actions, rowStyle(4)]}>
              <DialogActions
                primary={hasNext && onNext ? { label: 'Next puzzle', onPress: onNext, onward: true } : { label: 'Done', onPress: onDone, accessibilityLabel: 'Back to home' }}
                secondary={hasNext && onNext ? { label: 'Home', onPress: onDone, accessibilityLabel: 'Back to home' } : undefined}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

/** One fact on the page, index-style: the label, a dotted leader, the
 * value - the way an almanac's tables read. */
function LedgerLine({ label, value, strong = false, accent, children }: { label: string; value?: string; strong?: boolean; accent?: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.leader} numberOfLines={1} ellipsizeMode="clip">
        {' . '.repeat(40)}
      </Text>
      {children ?? <Text style={[styles.lineValue, strong && accent ? { color: accent } : null]}>{value}</Text>}
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
    Animated.sequence([Animated.delay(420 + delay), Animated.timing(t, { toValue: value, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: false })]).start(({ finished }) => {
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
  // Pushed down by the space above it: the page's content sits a little
  // above the middle, the way actions push from below.
  seal: { marginTop: 'auto', width: 136, height: 136, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.md },
  sealRing: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 2 },
  sealPlate: { position: 'absolute', width: 124, height: 124, borderRadius: 62, opacity: 0.1 },
  page: { alignSelf: 'center', width: '100%', maxWidth: 420, alignItems: 'center' },
  head: { marginBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 7 },
  lineLabel: { fontSize: theme.typography.sizes.body, color: theme.colors.textSecondary },
  leader: { flex: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.borderStrong, letterSpacing: 1 },
  lineValue: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  coinValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  coinNumber: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.body + 3, fontWeight: theme.typography.weights.bold, color: theme.colors.accentText },
  /** A paper ring the emblem sits in, cut into the sheet's top edge. */
  seat: { position: 'absolute', top: -46, alignSelf: 'center', width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  praiseBlock: { alignItems: 'center', gap: 10 },
  how: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  howText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  /** The page's paper, a touch see-through: the board stays faintly there. */
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: `${theme.colors.background}8C` },
  /** Carries the elevation only: the card clips, and a clipped view would
   * clip its own shadow away. */
  cardShadow: { width: '100%', shadowColor: theme.colors.shadow, shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  card: { alignItems: 'center', paddingTop: 58, paddingHorizontal: theme.spacing.xl, backgroundColor: theme.colors.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, borderTopWidth: 1, borderColor: theme.colors.border },
  emblem: { marginBottom: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.bold, letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' },
  /** A short rule in the game's colour under the title, as every Home card has. */
  titleRule: { alignSelf: 'center', width: 36, height: 2, borderRadius: 1, marginTop: 8 },
  title: { fontFamily: theme.typography.families.display, fontSize: 52, lineHeight: 58, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  /** The line that changes every solve. */
  praise: { fontFamily: theme.typography.families.display, fontSize: 19, lineHeight: 26, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'center' },
  // What it paid, as a clean row between two fine rules - not a slab.
  ledger: { alignSelf: 'stretch', marginTop: theme.spacing.lg, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderStrong },
  ledgerRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statNumber: { fontFamily: theme.typography.families.figures, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, fontVariant: ['tabular-nums'], color: theme.colors.textPrimary },
  statGold: { color: theme.colors.accentText },
  statLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.textTertiary },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4, backgroundColor: theme.colors.borderStrong },
  bonusLine: { marginTop: 6, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.accentText },
  daily: { alignItems: 'center', gap: 3, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderStrong },
  dailyHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dailyLabel: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
  dailyTime: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  dailyNote: { marginTop: 4, fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  dailyWorld: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary, textAlign: 'center' },
  share: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  shareText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  wonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderStrong },
  wonPreview: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  wonText: { flex: 1, fontSize: theme.typography.sizes.caption + 1, lineHeight: 17, color: theme.colors.textPrimary },
  toward: { alignSelf: 'center', width: '100%', maxWidth: 380, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md, paddingHorizontal: 4 },
  towardBody: { flex: 1, gap: 6 },
  towardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  towardText: { flex: 1, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  towardCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  towardTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.border },
  towardFill: { height: 6, borderRadius: 3 },
  // At the foot of the page, where the thumb already is.
  actions: { marginTop: theme.spacing.lg, alignSelf: 'center', width: '100%', maxWidth: 420 },
  primaryWrap: { alignSelf: 'stretch' },
  button: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill },
  primary: { backgroundColor: theme.colors.primary },
  primaryLabel: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold },
  quiet: { paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  quietLabel: { color: theme.colors.textSecondary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  pressed: { opacity: 0.85 },
}));

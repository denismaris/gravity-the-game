import React, { useEffect, useRef, useState } from 'react';
import { LEVELS_PER_CHAPTER, chapterAt } from '../progression/chapters';
import { toRoman } from '../progression/rank';
import { SET_BONUS } from '../progression/coins';
import { CoinGlyph } from './Coins';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { ConfettiBurst } from './ConfettiBurst';
import { GameEmblem } from './GameEmblem';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, GameKind, gameShortName } from '../game/journey';
import { motion, theme, themedStyles } from '../theme';
import { MODAL_EXIT_MS, ModalLayer } from './ModalLayer';
import { DialogActions, dialogStyles } from './dialog';

export interface LevelSetCompleteProps {
  /** The level number that was just finished. */
  readonly levelNumber: number;
  /** Every game in the set, in the order it was played. */
  readonly kinds: ReadonlyArray<GameKind>;
  /** Move on - to the calming interstitial, then the next level. */
  readonly onContinue: () => void;
}

/** Title, the tally, the closing line, the action. */
const ROW_COUNT = 4;
/** Each game is *counted*, not merely revealed - one at a time, each beat
 * overlapping the last a little so the tally flows rather than ticks. */
const PLACE_STAGGER_MS = 170;
/** The tally starts once the card and its heading have settled. */
const PLACE_DELAY_MS = 380;
/** How long each game's arrival takes, end to end: the emblem settling,
 * its check stamping on, its name sliding in. */
const PLACE_MS = 620;

/**
 * The end of a whole level - a distinct, larger moment than finishing one
 * puzzle inside it.
 *
 * Kept as its own component rather than a section bolted onto
 * `PuzzleSolved` because the two are answering different questions. That
 * card reports a single puzzle: how many stars, how many hints, replay or
 * move on. This one reports a *set*: which games it was made of, and that
 * all of them are behind you. Folding the second into the first made one
 * card that did neither job clearly, and buried the rarer, bigger occasion
 * underneath the routine one.
 *
 * The tally is the whole point of the screen, so it gets the room: each
 * game's emblem drops into place on its own beat, its name arriving with
 * it, counted out rather than presented all at once.
 */
export function LevelSetComplete({ levelNumber, kinds, onContinue }: LevelSetCompleteProps): React.JSX.Element {
  // It follows a puzzle's own card: arrives once that one has left.
  const { backdrop, card, cardOpacity, hero, rowStyle } = useCardEntrance(ROW_COUNT, { delay: MODAL_EXIT_MS });
  const places = useRef(kinds.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // One timing per game, on the native driver; every part of a row reads
    // its own slice of it (see `TallyRow`), so nothing springs or settles
    // separately and the whole count runs smooth.
    Animated.sequence([
      Animated.delay(PLACE_DELAY_MS),
      Animated.stagger(
        PLACE_STAGGER_MS,
        places.map(value => Animated.timing(value, { toValue: 1, duration: PLACE_MS, easing: Easing.linear, useNativeDriver: true })),
      ),
    ]).start();
    // Mount-only: this card is mounted exactly when a set is completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalLayer>
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
        <ConfettiBurst />
        <Animated.View
          style={[
            styles.cardShadow,
            {
              opacity: cardOpacity,
              transform: [
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) },
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.card}>
            <Animated.View
              style={[
                styles.crest,
                {
                  opacity: hero,
                  transform: [{ scale: hero }],
                },
              ]}
            >
              <View pointerEvents="none" style={styles.crestInner} />
              {/* Sized by its digits, never shrunk to fit: iOS measured the
                  fit against the line height and shrank even a short
                  number to the minimum. */}
              <Text style={[styles.crestNumber, String(levelNumber).length >= 3 && styles.crestNumberLong]} numberOfLines={1}>
                {levelNumber}
              </Text>
              {/* A bead round the medal for each game, lit in its colour as
                  that game is counted in. */}
              {kinds.map((kind, i) => {
                const a = (i / kinds.length) * Math.PI * 2 - Math.PI / 2;
                const r = CREST / 2 + 9;
                return (
                  <Animated.View
                    key={`bead-${i}`}
                    style={[
                      styles.bead,
                      {
                        left: CREST / 2 + Math.cos(a) * r - 5,
                        top: CREST / 2 + Math.sin(a) * r - 5,
                        backgroundColor: accentColorForKind(kind),
                        opacity: slice(places[i], 0.35, 0.6, glide, [0.15, 1], 0.15),
                        transform: [{ scale: slice(places[i], 0.35, 0.75, settle, [0.5, 1], 0.5) }],
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>

            <Animated.View style={rowStyle(0)}>
              <Text style={dialogStyles.kicker}>{`Level ${levelNumber} complete`}</Text>
              <Text style={styles.headline}>{kinds.length} games, all finished</Text>
            </Animated.View>

            {/* Rows of equal length: four in one row, six or eight in two. */}
            <View style={[styles.tally, { maxWidth: (kinds.length <= 4 ? kinds.length : Math.ceil(kinds.length / 2)) * (62 + 6) }]}>
              {kinds.map((kind, i) => (
                <TallyTile key={`${kind}-${i}`} kind={kind} t={places[i]} />
              ))}
            </View>

            {/* The level's own reward, counted up once every game is ticked
                off - paid with the set's last solve, shown here as the
                prize for the set as a whole. */}
            <Animated.View style={[styles.reward, rowStyle(2)]}>
              <CoinGlyph size={18} />
              <RewardCount to={SET_BONUS} after={PLACE_DELAY_MS + MODAL_EXIT_MS + kinds.length * PLACE_STAGGER_MS + 300} />
              <Text style={styles.rewardLabel}>Level reward</Text>
            </Animated.View>

            {levelNumber % LEVELS_PER_CHAPTER === 0 ? (
              <Animated.View style={[styles.chapter, rowStyle(2)]}>
                <Text style={styles.chapterKicker}>{`Chapter ${toRoman(levelNumber / LEVELS_PER_CHAPTER)} complete`}</Text>
                <Text style={styles.chapterName}>{chapterAt(levelNumber / LEVELS_PER_CHAPTER).name}</Text>
                <Text style={styles.chapterNote}>Its reward is waiting in your Almanac.</Text>
              </Animated.View>
            ) : (
              <Animated.Text style={[styles.closing, rowStyle(2)]}>
                That is the whole set. Take a breather; the next one is ready when you are.
              </Animated.Text>
            )}

            <Animated.View style={[styles.actions, rowStyle(3)]}>
              <DialogActions primary={{ label: 'Continue', onPress: onContinue }} />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

/** A number counting up to `to`, starting `after` ms from now. */
function RewardCount({ to, after }: { to: number; after: number }): React.JSX.Element {
  const [n, setN] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      const began = Date.now();
      timer = setInterval(() => {
        const k = Math.min(1, (Date.now() - began) / 520);
        setN(Math.round(to * (1 - (1 - k) ** 3)));
        if (k >= 1 && timer) clearInterval(timer);
      }, 30);
    }, after);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [to, after]);
  return <Text style={styles.rewardValue}>{`+${n}`}</Text>;
}

/** A slice of a 0..1 clock, eased: 0 before `from`, 1 after `to`. */
function slice(t: Animated.Value, from: number, to: number, easing: (x: number) => number, out: [number, number], before?: number): Animated.AnimatedInterpolation<number> {
  // The easing sampled into the interpolation, so it runs on the native
  // driver; outside [from, to] it holds its ends - or, given `before`,
  // holds that until the slice begins (a ring that fades *out* must not
  // show at full strength while it waits).
  const steps = 12;
  const inputRange = Array.from({ length: steps + 1 }, (_v, k) => from + ((to - from) * k) / steps);
  const outputRange = inputRange.map((_x, k) => out[0] + (out[1] - out[0]) * easing(k / steps));
  if (before !== undefined && from > 0) {
    inputRange.unshift(0, from - 0.001);
    outputRange.unshift(before, before);
  }
  return t.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
}

const settle = Easing.out(Easing.back(1.5));
const glide = Easing.out(Easing.cubic);

/**
 * One game in the tally, counted in three beats off one clock: its emblem
 * drops into its place in the row - falling a little, growing, a small
 * turn straightening - then a check stamps onto its corner with a ring of
 * the game's colour, and its name rises in underneath.
 */
function TallyTile({ kind, t }: { kind: GameKind; t: Animated.Value }): React.JSX.Element {
  const accent = accentColorForKind(kind);
  return (
    <View style={styles.tile}>
      <View>
        <Animated.View
          style={{
            opacity: slice(t, 0, 0.3, glide, [0, 1]),
            transform: [
              { translateY: slice(t, 0, 0.55, settle, [-22, 0]) },
              { scale: slice(t, 0, 0.55, settle, [0.6, 1]) },
              { rotate: slice(t, 0, 0.55, glide, [-10, 0]).interpolate({ inputRange: [-10, 0], outputRange: ['-10deg', '0deg'] }) },
            ],
          }}
        >
          <GameEmblem kind={kind} size={50} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.checkRing,
            {
              borderColor: accent,
              opacity: slice(t, 0.5, 1, glide, [0.7, 0], 0),
              transform: [{ scale: slice(t, 0.5, 1, glide, [0.4, 1.7]) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.check,
            {
              backgroundColor: accent,
              opacity: slice(t, 0.45, 0.6, glide, [0, 1], 0),
              transform: [{ scale: slice(t, 0.45, 0.8, settle, [0.2, 1], 0.2) }],
            },
          ]}
        >
          <Icon name="check" size={10} color={theme.colors.surfaceHi} />
        </Animated.View>
      </View>
      <Animated.Text
        numberOfLines={2}
        style={[
          styles.tileLabel,
          {
            color: accent,
            opacity: slice(t, 0.35, 0.8, glide, [0, 1], 0),
            transform: [{ translateY: slice(t, 0.35, 0.85, glide, [6, 0]) }],
          },
        ]}
      >
        {gameShortName(kind)}
      </Animated.Text>
    </View>
  );
}

const CREST = 68;

const styles = themedStyles(() => ({
  chapter: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    // Room to breathe before the Continue button below it.
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  chapterKicker: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.accentText },
  actions: { alignSelf: 'stretch' },
  chapterName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginTop: 2 },
  chapterNote: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
  },
  cardShadow: {
    borderRadius: theme.radii.lg,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 340,
  },
  /** The level's own number, as a struck medal - this card belongs to a
   * level rather than to any one game, so it takes the app's ink and ochre
   * rather than borrowing a single game's accent. */
  crest: {
    // Room for the beads round the medal.
    marginTop: 10,
    width: CREST,
    height: CREST,
    borderRadius: CREST / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  crestNumber: {
    // Not the display face: Georgia's old-style figures hang a 3, 4, 5, 7
    // or 9 below the line and lift a 6 or 8 above it, which left some
    // level numbers sitting visibly low in the medal and others not.
    // Lining figures all share one height, so every number sits centred.
    fontFamily: theme.typography.families.figures,
    fontSize: 32,
    fontVariant: ['lining-nums', 'tabular-nums'],
    lineHeight: 38,
    // Avenir's figures rest a little above the middle of their line; this
    // brings their centre onto the medal's.
    transform: [{ translateY: 2 }],
    width: CREST - 12,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  crestNumberLong: { fontSize: 25, lineHeight: 30, transform: [{ translateY: 1.5 }] },
  /** A fine inner ring, so it reads as a struck medal, not a plain disc. */
  crestInner: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: CREST / 2 - 5, borderWidth: 1, borderColor: theme.colors.accent, opacity: 0.45 },
  eyebrow: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accentText,
    textAlign: 'center',
  },
  headline: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  tally: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 6,
    rowGap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  tile: { width: 62, alignItems: 'center' },
  tileLabel: { marginTop: 8, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, textAlign: 'center' },
  bead: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.surface },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  rewardValue: { fontFamily: theme.typography.families.figures, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: 20, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, minWidth: 34 },
  rewardLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.colors.textTertiary },
  cardRule: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.md,
  },
  check: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  checkRing: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  closing: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  pressed: { opacity: 0.85 },
  buttonLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
}));

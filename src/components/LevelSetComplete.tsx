import React, { useEffect, useRef, useState } from 'react';
import { LEVELS_PER_CHAPTER, chapterAt } from '../progression/chapters';
import { toRoman } from '../progression/rank';
import { SET_BONUS } from '../progression/coins';
import { CoinGlyph } from './Coins';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { ConfettiBurst } from './ConfettiBurst';
import { GameEmblem } from './GameEmblem';
import { glide, settle, slice } from './placeMotion';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, GameKind, gameShortName } from '../game/journey';
import { theme, themedStyles } from '../theme';
import { shade, triggerFeedback } from '../game/rendering';
import { MODAL_EXIT_MS, ModalLayer } from './ModalLayer';
import { DialogActions } from './dialog';

export interface LevelSetCompleteProps {
  /** The level number that was just finished. */
  readonly levelNumber: number;
  /** Every game in the set, in the order it was played. */
  readonly kinds: ReadonlyArray<GameKind>;
  /** Move on - to the calming interstitial, then the next level. */
  readonly onContinue: () => void;
}

/** Most of the way through the solve card's exit before this arrives. */
const ARRIVE_AFTER_MS = Math.round(MODAL_EXIT_MS * 0.5);

/** Title, the tally, the closing line, the action. */
const ROW_COUNT = 4;
/** Each game is *counted*, not merely revealed - one at a time, each beat
 * overlapping the last a little so the tally flows rather than ticks. */
const PLACE_STAGGER_MS = 140;
/** The tally starts once the card and its heading have settled. */
const PLACE_DELAY_MS = 240;
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
  const insets = useSafeAreaInsets();
  // It follows a puzzle's own card: arrives once that one has left.
  // A little overlap is fine: it comes in as that one is still fading.
  const { backdrop, card, cardOpacity, hero, rowStyle } = useCardEntrance(ROW_COUNT, { delay: ARRIVE_AFTER_MS });
  const places = useRef(kinds.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // One timing per game, on the native driver; every part of a row reads
    // its own slice of it (see `TallyRow`), so nothing springs or settles
    // separately and the whole count runs smooth.
    Animated.sequence([
      Animated.delay(ARRIVE_AFTER_MS + PLACE_DELAY_MS),
      Animated.stagger(
        PLACE_STAGGER_MS,
        places.map(value => Animated.timing(value, { toValue: 1, duration: PLACE_MS, easing: Easing.linear, useNativeDriver: true })),
      ),
    ]).start();
    // Each game's check felt as it stamps on, one light tap apiece.
    const stamps = places.map((_v, i) => setTimeout(() => triggerFeedback('stamp'), ARRIVE_AFTER_MS + PLACE_DELAY_MS + i * PLACE_STAGGER_MS + PLACE_MS * 0.5));
    return () => stamps.forEach(clearTimeout);
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
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) },
              ],
            },
          ]}
        >
          {/* A page, not a card: the paper over the whole screen, a little
              see-through, the level's medal and its count laid out on it. */}
          <View style={[styles.card, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
            {/* The level's medal: a gold face standing on a deeper gold
                disc, the same way every raised thing in the app stands on
                its edge - two shapes, not a bottom border, which pinched to
                nothing at the sides of a circle. */}
            <Animated.View style={[styles.crestStand, { opacity: hero, transform: [{ scale: hero }] }]}>
              <View style={[styles.crestDisc, styles.crestEdge]} />
              <View style={[styles.crestDisc, styles.crest]}>
              <View pointerEvents="none" style={styles.crestInner} />
              {/* Sized by its digits, never shrunk to fit: iOS measured the
                  fit against the line height and shrank even a short
                  number to the minimum. */}
              <Text style={[styles.crestNumber, String(levelNumber).length >= 3 && styles.crestNumberLong]} numberOfLines={1}>
                {levelNumber}
              </Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.heading, rowStyle(0)]}>
              <Text style={styles.headline}>{`Level ${levelNumber}, done.`}</Text>
              <Text style={styles.subline}>{`${COUNT_WORDS[kinds.length] ?? kinds.length} games, every one finished.`}</Text>
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
              <Text style={styles.rewardLabel}>Level reward</Text>
              <Text style={styles.leader} numberOfLines={1} ellipsizeMode="clip">
                {' . '.repeat(40)}
              </Text>
              <View style={styles.rewardFigure}>
                <CoinGlyph size={15} />
                <RewardCount to={SET_BONUS} after={PLACE_DELAY_MS + ARRIVE_AFTER_MS + kinds.length * PLACE_STAGGER_MS + 300} />
              </View>
            </Animated.View>

            {levelNumber % LEVELS_PER_CHAPTER === 0 ? (
              <Animated.View style={[styles.chapter, rowStyle(2)]}>
                <Text style={styles.chapterKicker}>{`Chapter ${toRoman(levelNumber / LEVELS_PER_CHAPTER)} complete`}</Text>
                <Text style={styles.chapterName}>{chapterAt(levelNumber / LEVELS_PER_CHAPTER).name}</Text>
                <Text style={styles.chapterNote}>Its reward is waiting in your Almanac.</Text>
              </Animated.View>
            ) : (
              <Animated.Text style={[styles.closing, rowStyle(2)]}>
                The next set is ready when you are.
              </Animated.Text>
            )}

            <Animated.View style={[styles.actions, rowStyle(3)]}>
              <DialogActions primary={{ label: 'Continue', onPress: onContinue, onward: true }} />
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
        if (k >= 1 && timer) {
          clearInterval(timer);
          // The level's reward, heard as it lands.
          triggerFeedback('coin');
        }
      }, 30);
    }, after);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [to, after]);
  return <Text style={styles.rewardValue}>{`+${n}`}</Text>;
}


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
          <GameEmblem kind={kind} size={50} raised />
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

const CREST = 96;
/** How far the medal's face stands above its gold edge. */
const CREST_LIP = 5;
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

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
  // At the foot of the page, where the thumb already is.
  actions: { marginTop: theme.spacing.md, alignSelf: 'center', width: '100%', maxWidth: 420 },
  chapterName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginTop: 2 },
  chapterNote: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  /** The page's paper, a touch see-through: the board stays faintly there. */
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: `${theme.colors.background}8C` },
  cardShadow: { width: '100%', shadowColor: theme.colors.shadow, shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 12 },
  card: { alignItems: 'center', paddingTop: CREST / 2 + theme.spacing.lg, paddingHorizontal: theme.spacing.xl, backgroundColor: theme.colors.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, borderTopWidth: 1.5, borderColor: theme.colors.goldRim },
  /** The level's own number, as a struck medal - this card belongs to a
   * level rather than to any one game, so it takes the app's ink and ochre
   * rather than borrowing a single game's accent. */
  crestStand: { position: 'absolute', top: -(CREST / 2) - 6, alignSelf: 'center', width: CREST, height: CREST + CREST_LIP },
  crestDisc: { position: 'absolute', left: 0, width: CREST, height: CREST, borderRadius: CREST / 2 },
  crestEdge: { top: CREST_LIP, backgroundColor: shade(theme.colors.goldRim, 0.62) },
  crest: {
    top: 0,
    borderWidth: 2.5,
    borderColor: theme.colors.goldRim,
    backgroundColor: theme.colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestNumber: {
    // Not the display face: Georgia's old-style figures hang a 3, 4, 5, 7
    // or 9 below the line and lift a 6 or 8 above it, which left some
    // level numbers sitting visibly low in the medal and others not.
    // Lining figures all share one height, so every number sits centred.
    fontFamily: theme.typography.families.figures,
    fontSize: 46,
    fontVariant: ['lining-nums', 'tabular-nums'],
    lineHeight: 54,
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
  crestNumberLong: { fontSize: 34, lineHeight: 42, transform: [{ translateY: 2 }] },
  /** A fine inner ring, so it reads as a struck medal, not a plain disc. */
  crestInner: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: CREST / 2 - 6, borderWidth: 1, borderColor: theme.colors.goldRim, opacity: 0.6 },
  heading: { alignItems: 'center', marginBottom: theme.spacing.lg },
  subline: { marginTop: 6, fontFamily: theme.typography.families.display, fontSize: 19, lineHeight: 26, color: theme.colors.textSecondary, textAlign: 'center' },
  eyebrow: {
    fontSize: theme.typography.sizes.micro + 1,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.colors.gold,
    textAlign: 'center',
  },
  headline: { fontFamily: theme.typography.families.display, fontSize: 36, lineHeight: 42, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  headRule: { width: 36, height: 2, borderRadius: 1, marginTop: 10, backgroundColor: theme.colors.goldRim },
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
  tileLabel: { marginTop: 6, fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, textAlign: 'center' },
  // What the set paid, as a clean row between two fine rules - the same
  // ledger line a solved puzzle's card uses.
  // What the set paid, as an index line: label, dotted leader, figure.
  reward: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: theme.spacing.md,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderStrong,
  },
  rewardFigure: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leader: { flex: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.borderStrong, letterSpacing: 1 },
  rewardValue: { fontFamily: theme.typography.families.figures, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.accentText, minWidth: 44 },
  rewardLabel: { fontSize: theme.typography.sizes.body, color: theme.colors.textSecondary },
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
    maxWidth: 300,
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

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACHIEVEMENTS,
  buildShareMessage,
  computeAptitude,
  getEarnedAchievements,
  getLevelPoint,
  usePlayerProgress,
} from '../progression';
import { getLevelById, getStarThresholds } from '../game/levels';
import {
  accentColorForKind,
  gameDisplayName,
  GameKind,
  gameShortName,
  getDailyEntry,
} from '../game/journey';
import {
  AlmanacBackdrop,
  AptitudeChart,
  DifficultyChip,
  GameEmblem,
  GeometricRule,
  PressableScale,
  TesseraMark,
} from '../components';
import { useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { CoinBalance } from '../components/Coins';

/** A fade/rise that finishes at `endsAt` (a fraction of the shared `mount`
 * driver) - staggering several elements off one Animated.Value instead of
 * timing each separately. */
function riseIn(mount: Animated.Value, endsAt: number) {
  const start = Math.max(0, endsAt - 0.4);
  return {
    opacity: mount.interpolate({
      inputRange: [start, endsAt],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: mount.interpolate({
          inputRange: [start, endsAt],
          outputRange: [14, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
}

export interface HomeScreenProps {
  /** Open a puzzle from the current level batch (any game). */
  onOpen: (target: { kind: GameKind; puzzleId: string }) => void;
  /** Open the Settings screen. */
  onOpenSettings: () => void;
  /** Open the achievements screen. */
  onOpenAchievements: () => void;
}

/** How tall a card gets on a phone with room to spare. Tuned to what the
 * fullest card actually holds rather than to the screen: taller than this
 * and the slack stops reading as composure and starts reading as a card
 * that forgot to fill itself in. Lowered from 436 once the page itself
 * carried the bloom artwork: the card had been padding itself out to fill
 * a screen that now has its own picture to show around it. */
const MAX_CARD_HEIGHT = 400;

/** The page each carousel slot is, in order - the order they are laid out
 * in below, and the order the dots read. */
const PAGES = ['continue', 'daily', 'aptitude', 'progress'] as const;

/**
 * Home - the cover page of a puzzle almanac.
 *
 * Four cards on a horizontal carousel under a fixed masthead, one per
 * page, with nothing scrolling vertically. It used to be a single
 * vertical scroll, which meant the primary action shared the screen with
 * three lesser things and none of them got any room. A card per page is
 * both calmer and more generous: Continue is the whole screen when you
 * open the app, and the rest are a swipe away rather than below the fold.
 *
 * There is no level select - the randomized level-batch system (see
 * `src/progression/batches.ts`) replaces that need entirely.
 */
export function HomeScreen({
  onOpen,
  onOpenSettings,
  onOpenAchievements,
}: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // A slow, endless swell behind the primary action. Deliberately the only
  // looping animation in the app: one quiet sign of life reads as alive,
  // several read as restless. Skipped outright under reduced motion -
  // this is decoration with no state behind it, so unlike the app's other
  // motion there is nothing lost by stopping it.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);
  const { progress, markLevelOpened, dailyStreak, dailyCompletedToday, coins } =
    usePlayerProgress();

  const levelPoint = useMemo(() => getLevelPoint(progress), [progress]);
  const entry = levelPoint.entry;
  const isGravity = entry.kind === 'gravity';

  const gravityLevel = isGravity ? getLevelById(entry.puzzleId) : undefined;
  const par = gravityLevel ? getStarThresholds(gravityLevel).three : 0;
  // The hero card's own progress bar tracks *this batch* (a handful of
  // puzzles, so it actually fills up and resets at a satisfying pace) - the
  // lifetime total across every game lives on the progress card instead
  // (`solved`/`TOTAL_PUZZLE_COUNT`).
  const batchSolved = progress.currentBatch?.completedPuzzleIds.length ?? 0;
  const pct = levelPoint.batchSize ? batchSolved / levelPoint.batchSize : 0;
  const aptitude = useMemo(() => computeAptitude(progress), [progress]);
  // Deliberately `aptitude.solved`, not `getCompletedCount` - the save
  // still holds completions for puzzles that no longer exist (retired
  // games, regenerated pools), and counting those made this card claim
  // more solves than the app has puzzles to solve. See its own comment in
  // `playerProgress.ts`.
  const solved = aptitude.solved;
  const totalStars = aptitude.stars;
  const earned = useMemo(
    () => getEarnedAchievements(progress).length,
    [progress],
  );

  // `Share.share` is RN's own built-in API - no new dependency for a
  // plain-text share, matching how deliberate this app has been about
  // every native addition so far. Fire-and-forget: a dismissed share
  // sheet and a sent one both resolve the same promise with nothing
  // useful for this screen to react to either way.
  const shareProgress = useCallback(() => {
    const message = buildShareMessage({
      dailyStreak,
      totalStars,
      solved,
      totalPuzzles: aptitude.total,
    });
    Share.share({ message }).catch(() => {});
  }, [dailyStreak, totalStars, solved, aptitude.total]);

  const openEntry = (): void => {
    if (gravityLevel) markLevelOpened(gravityLevel.id);
    onOpen({ kind: entry.kind, puzzleId: entry.puzzleId });
  };

  // The Daily is a fixed side quest into the whole pool, independent of the
  // batch system's own resume position - see `getDailyEntry`. Its streak
  // lives on `PlayerProgress.daily` and updates itself the moment
  // `recordCompletion` sees this exact puzzle id solved, from whichever
  // screen plays it.
  const daily = useMemo(() => getDailyEntry(), []);
  const openDaily = (): void =>
    onOpen({ kind: daily.kind, puzzleId: daily.puzzleId });

  // A quiet cascade on every visit to Home (not just first mount - Home
  // remounts fresh each time the player backs out of a puzzle), so the hub
  // never feels like a static screen you're just returning to. The progress
  // fill animates separately so it reads as "counting up to here" rather
  // than popping straight to its resting width.
  const mount = useRef(new Animated.Value(0)).current;
  const trackFill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mount.setValue(0);
    Animated.timing(mount, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mount]);
  useEffect(() => {
    Animated.timing(trackFill, {
      toValue: pct,
      duration: 700,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't a transform - can't use the native driver
    }).start();
  }, [pct, trackFill]);

  const [page, setPage] = useState(0);
  const onCarouselScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      // Guarded so a scroll that lands mid-page (a cancelled drag) cannot
      // set state on every frame - `onMomentumScrollEnd` alone misses a
      // slow drag that never gains momentum, so both fire into this.
      setPage(current =>
        next !== current && next >= 0 && next < PAGES.length ? next : current,
      );
    },
    [width],
  );

  /**
   * One height for all four cards, from the room actually available.
   *
   * Measuring the cards instead does not work and the failure is worth
   * recording: `flex: 1` on each card's middle block sets its flex-basis
   * to 0, so on the first layout pass - before any height exists to
   * distribute - the middle measures as nothing and the card reports a
   * height with its own centre missing. Feeding that back in locks the
   * card too short and the content overlaps. The slack is handled inside
   * the card by the middle block, which holds real content and centres
   * it, so a tall card is composed rather than padded out.
   */
  const cardHeight = Math.max(
    280,
    Math.min(
      height - insets.top - insets.bottom - MASTHEAD_BLOCK - DOTS_BLOCK,
      MAX_CARD_HEIGHT,
    ),
  );
  const chartSize = Math.min(
    width - theme.spacing.lg * 4,
    cardHeight - 196,
    240,
  );

  const accent = accentColorForKind(entry.kind);

  // Where the card lands on screen, for the backdrop to compose around.
  // Only its *position* is measured - its height is still computed above
  // (\`cardHeight\`), for the reason that block records. The carousel is a
  // child of \`stage\`, so the two offsets add.
  const [stageY, setStageY] = useState<number | null>(null);
  const [carouselY, setCarouselY] = useState<number | null>(null);
  const onStageLayout = useCallback(
    (e: LayoutChangeEvent) => setStageY(e.nativeEvent.layout.y),
    [],
  );
  const onCarouselLayout = useCallback(
    (e: LayoutChangeEvent) => setCarouselY(e.nativeEvent.layout.y),
    [],
  );
  const cardRect = useMemo(
    () =>
      stageY === null || carouselY === null
        ? null
        : {
            x: theme.spacing.lg,
            y: stageY + carouselY,
            width: width - theme.spacing.lg * 2,
            height: cardHeight,
          },
    [stageY, carouselY, width, cardHeight],
  );

  return (
    <View style={styles.container}>
      {/* Drawn once the card's position is known - the whole composition
          is built around it (see \`AlmanacBackdrop\`). Fades in with the
          page's own entrance rather than popping in a frame late. */}
      {cardRect && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: mount }]}
          pointerEvents="none"
        >
          <AlmanacBackdrop width={width} height={height} card={cardRect} />
        </Animated.View>
      )}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={onOpenSettings}
        hitSlop={8}
        containerStyle={[
          styles.settingsButton,
          { top: insets.top + theme.spacing.sm },
        ]}
      >
        {/* U+FE0E forces the plain monochrome glyph - without it iOS renders
            a full-colour emoji gear that clashes with the flat paper
            palette (Android already renders plain either way). */}
        <Text style={styles.settingsGlyph}>{'⚙︎'}</Text>
      </PressableScale>

      <Animated.View
        style={[
          styles.masthead,
          { paddingTop: insets.top + theme.spacing.md },
          riseIn(mount, 0.45),
        ]}
      >
        <View style={styles.mastheadRow}>
          <TesseraMark size={34} />
          <Text style={styles.wordmark}>TESSERA</Text>
        </View>
        <GeometricRule variant="masthead" style={styles.rule} />
        <Text style={styles.tagline}>AN ALMANAC OF PUZZLES</Text>
        {/* Loss aversion, the moment it applies: a streak already exists
            and today's Daily is still unplayed, so it is genuinely one
            missed day from resetting to zero (`getDisplayDailyStreak`'s
            own rule). Sits on the masthead, not just the Daily card three
            swipes away, because the player who only ever plays Continue is
            exactly the one who would otherwise never see it.
            `streakSlot` always occupies its full height, shown or not, so
            `MASTHEAD_BLOCK` - the constant the carousel's own height is
            computed from - never has to guess whether this row is present;
            two absolute-positioned attempts before this one drifted into
            either the settings gear or the tessera mark, since both scale
            with content nothing here can predict. */}
        {/* The coin balance shares the reserved row with the streak nudge -
            in flow, side by side, so neither can drift into the wordmark
            or the gear the way absolutely-placed badges here once did. */}
        <View style={styles.streakSlot}>
          <CoinBalance coins={coins} />
          {dailyStreak > 0 && !dailyCompletedToday && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${dailyStreak} day streak. Play today's Daily puzzle before it resets.`}
              onPress={openDaily}
              hitSlop={6}
              containerStyle={styles.streakNudge}
            >
              <Text style={styles.streakNudgeText}>
                {dailyStreak}-DAY STREAK · PLAY DAILY
              </Text>
            </PressableScale>
          )}
        </View>
      </Animated.View>

      {/* Carousel and dots are centred together in whatever is left, so the
          dots sit directly under the card instead of being pinned to the
          bottom of the screen with a field of paper between them. */}
      <Animated.View
        style={[styles.stage, riseIn(mount, 0.7)]}
        onLayout={onStageLayout}
      >
        {/* A plain wrapper to measure: a ScrollView's own \`onLayout\` did not
            report its offset inside the centring stage, which put the whole
            backdrop one centring-gap too high. */}
        <View onLayout={onCarouselLayout}>
          <ScrollView
            style={{ height: cardHeight }}
            horizontal
            contentContainerStyle={styles.carouselContent}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onCarouselScroll}
            onMomentumScrollEnd={onCarouselScroll}
            scrollEventThrottle={32}
            decelerationRate="fast"
          >
            {/* --- Continue ------------------------------------------------ */}
            <View style={[styles.page, { width }]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${
                  levelPoint.allDone ? 'Replay' : 'Continue'
                }: ${entry.name}, ${
                  entry.challenge
                    ? 'the challenge of this set, hard'
                    : entry.difficulty
                }, Level ${levelPoint.levelNumber}, puzzle ${
                  levelPoint.batchPosition
                } of ${levelPoint.batchSize}`}
                onPress={openEntry}
                scaleTo={0.985}
                style={({ pressed }) => [
                  styles.card,
                  { height: cardHeight },
                  pressed && styles.cardPressed,
                ]}
              >
                <>
                  {/* The chip sits beside the eyebrow rather than inside it:
                    the eyebrow is tinted with this game's identity colour,
                    and a difficulty spelled in that same colour would read
                    as part of the game's name instead of as a warning. */}
                  <View style={styles.eyebrowRow}>
                    <Text
                      style={[
                        styles.eyebrow,
                        { color: accentColorForKind(entry.kind) },
                      ]}
                      numberOfLines={1}
                    >
                      LEVEL {levelPoint.levelNumber} ·{' '}
                      {entry.chapter.toUpperCase()}
                    </Text>
                    <DifficultyChip
                      difficulty={entry.difficulty}
                      challenge={entry.challenge}
                      style={styles.heroChip}
                    />
                  </View>
                  {/* The plate's heading rule, in this puzzle's own game
                    colour. Home used to carry that colour in one short line
                    of type and nowhere else, so every card looked the same
                    whichever of the eight games it was about. */}
                  <View
                    style={[styles.headingRule, { backgroundColor: accent }]}
                  />
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {entry.name}
                  </Text>
                  <Text style={styles.heroMeta}>
                    PUZZLE {levelPoint.batchPosition} OF {levelPoint.batchSize}
                    {isGravity ? `      PAR ${par}` : ''}
                  </Text>

                  {/* The middle of every card is a flexible block holding real
                    content, centred. Slack from a tall screen spreads around
                    it instead of pooling into the two hard gaps a
                    `space-between` skeleton produced. */}
                  <View style={styles.wellCentered}>
                    <Text style={styles.sectionLabel}>THIS SET</Text>

                    {/* The games this level is actually made of. The card
                      already said "Puzzle 3 of 4" - a number that says how far
                      along you are but nothing about what is coming. These say
                      what the rest of the set is, named, with a finished one
                      filled and the ones ahead faded: a preview, not a
                      mystery. */}
                    {progress.currentBatch && (
                      <View style={styles.setRow}>
                        {progress.currentBatch.puzzles.map((entryRef, i) => {
                          const completed =
                            progress.currentBatch!.completedPuzzleIds;
                          const done = completed.includes(entryRef.puzzleId);
                          // The one you are about to play reads as live too, not
                          // pending - otherwise a fresh set shows four faded
                          // marks and nothing on this card looks current.
                          const isCurrent = !done && completed.length === i;
                          return (
                            <View
                              key={`${entryRef.puzzleId}-${i}`}
                              style={styles.setItem}
                            >
                              <View
                                style={
                                  done || isCurrent
                                    ? undefined
                                    : styles.setAhead
                                }
                              >
                                <GameEmblem kind={entryRef.kind} size={38} />
                              </View>
                              {/* The set's challenge, underscored. Ruled
                                underlines are already this app's way of marking
                                something out, and a rule under an emblem leaves
                                the emblem itself untouched - the tile still has
                                to read as its own game first. Deliberately
                                *outside* the fade above: a challenge two puzzles
                                away is exactly the one worth seeing coming. */}
                              <View
                                style={[
                                  styles.setChallengeRule,
                                  entryRef.challenge &&
                                    styles.setChallengeRuleOn,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.setName,
                                  !(done || isCurrent) && styles.setAhead,
                                ]}
                                numberOfLines={1}
                              >
                                {gameShortName(entryRef.kind)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.track}>
                      <Animated.View
                        style={[
                          styles.trackFill,
                          {
                            backgroundColor: accent,
                            width: trackFill.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                              extrapolate: 'clamp',
                            }),
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.heroFoot}>
                    <Text style={styles.verb}>
                      {levelPoint.allDone ? 'Replay' : 'Continue'}
                    </Text>
                    <View style={styles.playWrap}>
                      {/* A halo breathing out of the button - the one thing on a
                        resting Home screen that moves, so the page reads as
                        idling rather than frozen. Sits *behind* the button and
                        never intercepts touches. */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.playHalo,
                          {
                            opacity: pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3, 0],
                            }),
                            transform: [
                              {
                                scale: pulse.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.5],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                      <View style={styles.play}>
                        <View style={styles.playTri} />
                      </View>
                    </View>
                  </View>
                </>
              </PressableScale>
            </View>

            {/* --- Daily --------------------------------------------------- */}
            <View style={[styles.page, { width }]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Daily puzzle: ${daily.name}${
                  dailyCompletedToday ? ', already solved today' : ''
                }${dailyStreak > 0 ? `, ${dailyStreak} day streak` : ''}`}
                onPress={openDaily}
                scaleTo={0.985}
                style={({ pressed }) => [
                  styles.card,
                  { height: cardHeight },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHead}>
                  <Text style={styles.eyebrowMuted}>DAILY</Text>
                  <Text
                    style={[
                      styles.badge,
                      dailyCompletedToday ? styles.badgeDone : styles.badgeLive,
                    ]}
                  >
                    {dailyCompletedToday ? 'SOLVED' : 'TODAY'}
                  </Text>
                </View>

                {/* The mark sits *beside* the title, not on its own line. Alone
                  and centred it read as an app icon dropped into the middle
                  of the card; set against the name it is a masthead, and the
                  row stays dense. */}
                <View style={styles.dailyRow}>
                  <GameEmblem kind={daily.kind} size={54} />
                  <View style={styles.dailyText}>
                    <Text style={styles.dailyTitle} numberOfLines={2}>
                      {daily.name}
                    </Text>
                    <Text style={styles.dailyChapter}>
                      {daily.chapter.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.wellCentered}>
                  <Text style={styles.sectionLabel}>STREAK</Text>
                  <View style={styles.streakHead}>
                    <Text style={styles.streakCount}>{dailyStreak}</Text>
                    <Text style={styles.streakUnit}>
                      DAY{dailyStreak === 1 ? '' : 'S'}
                      {'\n'}RUNNING
                    </Text>
                  </View>
                  {/* A week of marks under the count. The number says how long
                    the run is; the marks say how much of a week is still
                    open, which is the part that argues for coming back
                    tomorrow. */}
                  <View style={styles.streakRow}>
                    {Array.from({ length: STREAK_MARKS }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.streakMark,
                          i < Math.min(dailyStreak, STREAK_MARKS) &&
                            styles.streakMarkLit,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.dailyStreakLabel}>
                    {dailyCompletedToday
                      ? 'SOLVED TODAY · COME BACK TOMORROW'
                      : dailyStreak > 0
                      ? "DON'T BREAK YOUR STREAK · PLAY TODAY"
                      : 'A NEW ONE EVERY DAY'}
                  </Text>
                </View>

                <View style={styles.heroFoot}>
                  <Text style={styles.verb}>
                    {dailyCompletedToday ? 'Replay' : 'Play'}
                  </Text>
                  <View style={styles.play}>
                    <View style={styles.playTri} />
                  </View>
                </View>
              </PressableScale>
            </View>

            {/* --- Puzzle IQ ----------------------------------------------- */}
            <View style={[styles.page, { width }]}>
              <View
                style={[styles.card, { height: cardHeight }]}
                accessible
                accessibilityLabel={
                  aptitude.index === null
                    ? `Puzzle IQ: not enough solves yet. ${aptitude.solved} of ${aptitude.total} puzzles solved.`
                    : `Puzzle IQ ${aptitude.index}, from ${
                        aptitude.solved
                      } solves.${
                        aptitude.strongest
                          ? ` Strongest at ${gameDisplayName(
                              aptitude.strongest,
                            )}, weakest at ${gameDisplayName(
                              aptitude.weakest!,
                            )}.`
                          : ''
                      }`
                }
              >
                <View>
                  <View style={styles.cardHead}>
                    <Text style={styles.eyebrowMuted}>PUZZLE IQ</Text>
                    <Text style={styles.iqSolves}>
                      {aptitude.solved} SOLVES
                    </Text>
                  </View>

                  {aptitude.index === null ? (
                    <Text style={styles.iqPending}>
                      Solve a few more puzzles and your score will appear here.
                    </Text>
                  ) : (
                    <View style={styles.iqRow}>
                      <Text style={styles.iqNumber}>{aptitude.index}</Text>
                      <View style={styles.iqSideNote}>
                        <Text style={styles.iqSideValue}>
                          {Math.round(aptitude.precision * 100)}%
                        </Text>
                        {/* Not "clean solves": this is the difficulty-scaled
                          mean from `computeAptitude`, so a player solving
                          hard boards reads higher than one solving easy
                          boards just as cleanly. Naming it after the count
                          it is not would be the more familiar label and the
                          wrong one. */}
                        <Text style={styles.iqSideLabel}>PRECISION</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={[styles.wellCentered, styles.chartWrap]}>
                  <AptitudeChart games={aptitude.games} size={chartSize} />
                </View>

                {/* Two named figures rather than one sentence. The sentence
                  wrapped mid-word at phone width, and a pair of labelled
                  columns is the same shape the Progress card uses for its
                  own two figures - so the carousel keeps one vocabulary. */}
                {aptitude.strongest && aptitude.weakest ? (
                  <View style={styles.figureRow}>
                    <View style={styles.figure}>
                      <Text style={styles.iqFigureLabel}>SHARPEST</Text>
                      <Text style={styles.iqFigureValue} numberOfLines={1}>
                        {gameDisplayName(aptitude.strongest)}
                      </Text>
                    </View>
                    <View style={styles.figureRule} />
                    <View style={styles.figure}>
                      <Text style={styles.iqFigureLabel}>MOST ROOM</Text>
                      <Text style={styles.iqFigureValue} numberOfLines={1}>
                        {gameDisplayName(aptitude.weakest)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.iqFoot}>
                    Play a puzzle in each game to fill the shape out.
                  </Text>
                )}
              </View>
            </View>

            {/* --- Progress ------------------------------------------------ */}
            <View style={[styles.page, { width }]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Achievements: ${earned} of ${ACHIEVEMENTS.length} earned, ${solved} of ${aptitude.total} puzzles solved, ${totalStars} stars`}
                onPress={onOpenAchievements}
                scaleTo={0.985}
                style={({ pressed }) => [
                  styles.card,
                  { height: cardHeight },
                  pressed && styles.cardPressed,
                ]}
              >
                <View>
                  <View style={styles.cardHead}>
                    <Text style={styles.eyebrowMuted}>PROGRESS</Text>
                    {/* Nested inside the card's own `PressableScale` - RN
                      resolves the touch to whichever Pressable is deepest
                      under the finger, so this claims a tap on the glyph
                      itself without ever also opening Achievements. */}
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Share your progress"
                      onPress={shareProgress}
                      hitSlop={10}
                      containerStyle={styles.shareButton}
                    >
                      <Text style={styles.shareGlyph}>{'⬆︎'}</Text>
                    </PressableScale>
                  </View>
                  <Text style={styles.heroTitle}>{solved}</Text>
                  <Text style={styles.heroMeta}>
                    OF {aptitude.total} PUZZLES SOLVED
                  </Text>
                </View>

                {/* Three figures that each mean something different: how much
                  you have played, how well, and how faithfully. Set as
                  ruled columns, the way an almanac sets a table - the track
                  belongs in here with them rather than up against the
                  headline, which left this well with two short lines
                  floating in it. */}
                <View style={styles.wellCentered}>
                  <View style={styles.statsTrack}>
                    <View
                      style={[
                        styles.statsTrackFill,
                        {
                          width: `${
                            aptitude.total > 0
                              ? (solved / aptitude.total) * 100
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.figureRow}>
                    <View style={styles.figure}>
                      <Text style={styles.figureValue}>
                        <Text style={styles.figureStar}>★</Text> {totalStars}
                      </Text>
                      <Text style={styles.figureLabel}>STARS</Text>
                    </View>
                    <View style={styles.figureRule} />
                    <View style={styles.figure}>
                      <Text style={styles.figureValue}>
                        {earned}
                        <Text style={styles.figureOf}>
                          /{ACHIEVEMENTS.length}
                        </Text>
                      </Text>
                      <Text style={styles.figureLabel}>BADGES</Text>
                    </View>
                    <View style={styles.figureRule} />
                    {/* The app has tracked this since `PlayerProgress` v4 and
                      never once shown it. */}
                    <View style={styles.figure}>
                      <Text style={styles.figureValue}>
                        {progress.bestDailyStreak}
                      </Text>
                      <Text style={styles.figureLabel}>BEST RUN</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.heroFoot}>
                  <Text style={styles.verb}>Achievements</Text>
                  <Text style={styles.chevron}>{'›'}</Text>
                </View>
              </PressableScale>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.dots,
          { paddingBottom: insets.bottom + theme.spacing.sm },
          riseIn(mount, 0.9),
        ]}
      >
        {PAGES.map((name, i) => (
          <View
            key={name}
            style={[styles.pageDot, i === page && styles.pageDotCurrent]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/** A week. Long enough that a real streak has somewhere to go, short
 * enough that the marks stay big enough to read. */
const STREAK_MARKS = 7;

/** The streak-nudge row's fixed height, reserved whether or not the nudge
 * itself is showing that day - see `styles.streakSlot`'s own comment. */
const STREAK_SLOT_HEIGHT = 24;

/** What the masthead and the dot row cost the carousel, measured from the
 * styles below rather than guessed - these two numbers are the whole
 * reason the page never needs to scroll, so they have to be right. */
const MASTHEAD_BLOCK =
  theme.spacing.md +
  33 +
  theme.spacing.xs * 2 +
  14 +
  theme.spacing.xs +
  STREAK_SLOT_HEIGHT +
  theme.spacing.lg;
const DOTS_BLOCK = theme.spacing.sm * 2 + 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  settingsButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsGlyph: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },

  masthead: {
    alignItems: 'center',
    // Matches the carousel pages' own inset, so the rule under the
    // wordmark lines up with the card edges below it instead of running
    // out to the bezel.
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  mastheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  /** Always `STREAK_SLOT_HEIGHT` tall, shown or not - two earlier attempts
   * placed the nudge inline with the wordmark or absolutely in a corner,
   * and both drifted into something else on screen (the settings gear, the
   * tessera mark) since each collided with content whose own width isn't
   * fixed. A reserved row in the normal flow has nothing to collide with. */
  streakSlot: {
    height: STREAK_SLOT_HEIGHT,
    marginTop: theme.spacing.xs,
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** In `secondary`, this app's one loud colour for a call to action,
   * rather than `accent` (spoken for by stars and difficulty) or `danger`
   * (failure and hazards only; an unplayed Daily is not a mistake). */
  streakNudge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    backgroundColor: 'rgba(196, 108, 51, 0.14)',
  },
  streakNudgeText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 0.6,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.secondary,
  },
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    lineHeight: 33,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: theme.typography.tracking.wordmark,
    color: theme.colors.textPrimary,
  },
  /** Measured rather than fixed: the mark inside places itself at
   * fractions of the real width, so it keeps its rhythm on any screen. */
  rule: {
    marginVertical: theme.spacing.xs,
  },
  tagline: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    lineHeight: 14,
    letterSpacing: 2,
    color: theme.colors.textTertiary,
  },

  /** One carousel slot. The card inside is centred in it, so the height
   * the cap leaves over becomes even margin rather than a gap at one end. */
  /** The carousel hugs its tallest card rather than filling the screen.
   * Given a height it centres a short card inside a tall box and then the
   * box itself gets centred again, which stranded the Continue card in the
   * lower half of the screen with a field of paper above it. */
  carouselContent: {
    alignItems: 'center',
  },
  page: {
    paddingHorizontal: theme.spacing.lg,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: '#3B1F52',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  /** The well as each card's flexible middle, sized to its content and
   * centred in the card's slack by auto margins. It used to take `middle`'s
   * `flex: 1` itself, which stretched the framed box to fill every spare
   * point of a tall card - a well with bands of bare paper inside it,
   * exactly the manufactured gap this screen is meant never to show. */
  wellCentered: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  /** Rules off the card's heading, in the current game's colour. */
  headingRule: {
    height: 2,
    borderRadius: 1,
    marginTop: theme.spacing.sm,
    width: 44,
  },
  /** Names the middle block, the way an almanac heads a column. Small,
   * tracked, and quiet - it is a signpost, not a heading. */
  sectionLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.4,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.secondary,
    flexShrink: 1,
  },
  heroChip: { marginLeft: 8 },
  eyebrowMuted: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.textTertiary,
  },
  heroTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.display,
    lineHeight: theme.typography.lineHeights.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  heroMeta: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginTop: 10,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.secondary,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verb: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  chevron: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    color: theme.colors.textTertiary,
    marginRight: theme.spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  setItem: {
    alignItems: 'flex-start',
  },
  /** Each game named under its own mark. The marks alone were an
   * identity parade for anyone who had not yet learned them; with the
   * names the row actually answers "what is in this set". */
  setName: {
    fontFamily: theme.typography.families.mono,
    fontSize: 9,
    letterSpacing: 0.3,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  /** Games still to come, held back so the finished ones read as done. */
  setAhead: {
    opacity: 0.35,
  },
  /** Always rendered, only sometimes coloured. Showing it conditionally
   * made the flagged tile taller than its neighbours, which knocked its
   * name out of line with theirs along the whole row. */
  setChallengeRule: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  setChallengeRuleOn: {
    backgroundColor: theme.colors.accent,
  },
  playWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.secondary,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTri: {
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: theme.colors.surfaceHi,
    marginLeft: 5,
  },

  badge: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
  },
  badgeLive: { color: theme.colors.secondary },
  badgeDone: { color: theme.colors.textTertiary },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  dailyText: {
    flex: 1,
  },
  dailyTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    lineHeight: theme.typography.lineHeights.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  dailyChapter: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 6,
  },
  streakHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  streakCount: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.display,
    lineHeight: theme.typography.lineHeights.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  streakUnit: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    lineHeight: 15,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
  },
  streakMark: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    // `borderStrong`, not `surfaceAlt`: these sit on the well's own darker
    // paper, and `surfaceAlt` is close enough to it that an unlit week
    // read as an empty strip rather than as seven waiting slots.
    backgroundColor: theme.colors.borderStrong,
  },
  streakMarkLit: {
    backgroundColor: theme.colors.accent,
  },
  dailyStreakLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.sm,
  },

  iqRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  iqNumber: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.mega,
    lineHeight: theme.typography.lineHeights.mega,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  iqSideNote: {
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  iqSideValue: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.subtitle,
    color: theme.colors.secondary,
  },
  iqSideLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  iqSolves: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.textTertiary,
  },
  iqPending: {
    fontFamily: theme.typography.families.ui,
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iqFoot: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
  iqFigureLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
  },
  iqFigureValue: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginTop: 3,
  },

  shareButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shareGlyph: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statsTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.surfaceAlt,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  statsTrackFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.secondary,
  },

  figureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  figure: {
    flex: 1,
  },
  figureRule: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.borderStrong,
  },
  figureValue: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    lineHeight: theme.typography.lineHeights.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  figureOf: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.textTertiary,
  },
  figureStar: {
    color: theme.colors.accent,
  },
  figureLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },

  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: theme.spacing.md,
  },
  /** Tally marks, not dots. The bars are this app's own signature (the
   * masthead rule, the backdrop's ornaments), and four of them counting
   * off the pages belongs to an almanac in a way a row of circles does
   * not. */
  pageDot: {
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: theme.colors.borderStrong,
  },
  pageDotCurrent: {
    width: 2,
    height: 19,
    backgroundColor: theme.colors.primary,
  },
});

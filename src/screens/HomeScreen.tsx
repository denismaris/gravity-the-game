import { Canvas, Path, RoundedRect } from '@shopify/react-native-skia';
import { Icon } from '../components/Icon';
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACHIEVEMENTS,
  GRAND_COINS,
  GRAND_REWARDS,
  cosmeticById,
  formatDuration,
  isGrandSolved,
  nextGrandReward,
  unclaimedStamps,
  computeAptitude,
  currentChapter,
  getEarnedAchievements,
  getLevelPoint,
  LEVELS_PER_CHAPTER,
  pendingRanks,
  rankOf,
  rankReward,
  PURCHASES_ENABLED,
  SWAP_PRICE,
  rankTitle,
  toRoman,
  unclaimedChapters,
  unclaimedErrands,
  usePlayerProgress,
  giftFor,
  unclaimedSets,
  gamesPlayed,
  INTRO_ORDER,
  nextGameToArrive,
  unlockedGames,
} from '../progression';
import { DailyGiftCard } from '../components/DailyGiftCard';
import { StreakCalendar, WeekStrip } from '../components/StreakCalendar';
import { getLevelById } from '../game/levels';
import {
  accentColorForKind,
  gameDisplayName,
  GameKind,
  gameShortName,
  getDailyEntry,
  getWeeklyGrand,
  dailyKeyOf,
  ROTATION,
} from '../game/journey';
import {
  AlmanacBackdrop,
  DifficultyChip,
  GameEmblem,
  PressableScale,
  TesseraMark,
} from '../components';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { ErrandList } from '../components/ErrandList';
import { RankMedal } from '../components/RankMedal';
import { RankUpCard } from '../components/RankUpCard';
import { XpBar } from '../components/XpBar';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { useSettings } from '../settings';
import { tutorialIdForGame } from '../game/tutorials';

/** A small trophy, drawn rather than typed: a cup on a stem and base,
 * with its two handles - the masthead's way into the leaderboards. */
function TrophyGlyph({ size }: { size: number }): React.JSX.Element {
  const s = size;
  const ink = theme.colors.textSecondary;
  const cup = `M ${s * 0.28} ${s * 0.16} L ${s * 0.72} ${s * 0.16} L ${s * 0.68} ${s * 0.42} C ${s * 0.65} ${s * 0.56} ${s * 0.35} ${s * 0.56} ${s * 0.32} ${s * 0.42} Z`;
  const handles = `M ${s * 0.29} ${s * 0.22} C ${s * 0.12} ${s * 0.22} ${s * 0.12} ${s * 0.42} ${s * 0.33} ${s * 0.44} M ${s * 0.71} ${s * 0.22} C ${s * 0.88} ${s * 0.22} ${s * 0.88} ${s * 0.42} ${s * 0.67} ${s * 0.44}`;
  return (
    <Canvas style={{ width: s, height: s }}>
      <Path path={cup} color={ink} />
      <Path path={handles} color={ink} style="stroke" strokeWidth={s * 0.07} strokeCap="round" />
      <Path path={`M ${s * 0.5} ${s * 0.55} L ${s * 0.5} ${s * 0.72}`} color={ink} style="stroke" strokeWidth={s * 0.09} />
      <Path path={`M ${s * 0.33} ${s * 0.72} L ${s * 0.67} ${s * 0.72} L ${s * 0.7} ${s * 0.84} L ${s * 0.3} ${s * 0.84} Z`} color={ink} />
    </Canvas>
  );
}

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
  /** Open the Almanac - rank, chapters, the road ahead. */
  onOpenJourney: () => void;
  /** Open the shop. */
  onOpenShop: () => void;
  /** Open the ledger - every game's record, and its stamps. */
  onOpenLedger: () => void;
  /** The leaderboards: world, country and city. */
  onOpenLeaderboard: () => void;
  /** Your games: the twelve, collected one by one. */
  onOpenCollection?: () => void;
}


/** How tall a card gets on a phone with room to spare. Tuned to what the
 * fullest card actually holds rather than to the screen: taller than this
 * and the slack stops reading as composure and starts reading as a card
 * that forgot to fill itself in. Lowered from 436 once the page itself
 * carried the bloom artwork: the card had been padding itself out to fill
 * a screen that now has its own picture to show around it. */
const MAX_CARD_HEIGHT = 400;

/** The Villa's window above the card: shown only with room for it. */

/** The page each carousel slot is, in order - the order they are laid out
 * in below, and the order the dots read. */
const PAGES = ['continue', 'today', 'grand', 'you'] as const;

/** The tab Home was last on, kept across its unmounts (see `page`). */
let rememberedPage = 0;
/** What each carousel page is called on its tab. */
/** A small shopping bag, in the ink of the label beside it. */
function ShopBag(): React.JSX.Element {
  return (
    <Canvas style={{ width: 13, height: 14 }}>
      <RoundedRect x={1} y={4.5} width={11} height={8.5} r={2} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 4.2 6.5 L 4.2 4 A 2.3 2.3 0 0 1 8.8 4 L 8.8 6.5" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
    </Canvas>
  );
}

const PAGE_LABELS: Record<(typeof PAGES)[number], string> = { continue: 'Play', today: 'Today', grand: 'Grand', you: 'You' };
const TAB_WIDTH = 66;

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
  onOpenJourney,
  onOpenShop,
  onOpenLedger,
  onOpenCollection,
  onOpenLeaderboard,
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
  const { progress, ready, markLevelOpened, dailyStreak, dailyCompletedToday, coins, collectRanks, swapPuzzle, claimGift } =
    usePlayerProgress();

  // Swapping the puzzle you are stuck on (see the Continue card).
  const [swapNote, setSwapNote] = useState<'done' | 'short' | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (swapTimer.current) clearTimeout(swapTimer.current);
  }, []);
  const swap = (): void => {
    const swapped = swapPuzzle();
    setSwapNote(swapped ? 'done' : 'short');
    triggerFeedback(swapped ? 'targetReached' : 'tap');
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => setSwapNote(null), 1800);
  };

  // The road: rank, the chapter under way, and anything waiting to be
  // collected (a finished errand, a finished chapter's reward).
  const rank = useMemo(() => rankOf(progress), [progress]);
  const chapterNow = useMemo(() => currentChapter(progress), [progress]);
  const todayKey = dailyKeyOf(new Date());
  const errandsWaiting = unclaimedErrands(progress, todayKey);
  const chaptersWaiting = unclaimedChapters(progress).length;
  // A rank reached but not yet celebrated - shown once the save has
  // loaded, so an old save's backlog of ranks lands as one moment.
  const pending = useMemo(() => (ready ? pendingRanks(progress) : []), [ready, progress]);
  // The day's gift comes first, on the first visit of the day; a new
  // player meets it from their second day, once the walkthrough is done.
  const gift = ready && progress.introSeen ? giftFor(progress, todayKey) : null;
  const setsReady = useMemo(() => unclaimedSets(progress).length, [progress]);
  const [rankUp, setRankUp] = useState<{ rank: number; gained: number; coins: number } | null>(null);
  useEffect(() => {
    if (rankUp || gift || pending.length === 0) return;
    setRankUp({ rank: pending[pending.length - 1], gained: pending.length, coins: pending.reduce((sum, n) => sum + rankReward(n), 0) });
  }, [pending, rankUp, gift]);

  const levelPoint = useMemo(() => getLevelPoint(progress), [progress]);
  const entry = levelPoint.entry;
  const isGravity = entry.kind === 'gravity';

  const gravityLevel = isGravity ? getLevelById(entry.puzzleId) : undefined;
  // Games arrive one at a time (see `INTRO_ORDER`): a debut in this set is
  // marked new, the next arrival is teased, and Swap waits until there is
  // a second game to swap to.
  const played = useMemo(() => gamesPlayed(progress), [progress]);
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  const roster = useMemo(() => unlockedGames(progress), [progress]);
  const canSwap = roster.length > 1;
  const debut = !levelPoint.allDone && !played.has(entry.kind);
  const { hasSeenTutorial } = useSettings();
  const lessonFirst = debut && !hasSeenTutorial(tutorialIdForGame(entry.kind));
  const aptitude = useMemo(() => computeAptitude(progress), [progress]);
  // Deliberately `aptitude.solved`, not `getCompletedCount` - the save
  // still holds completions for puzzles that no longer exist (retired
  // games, regenerated pools), and counting those made this card claim
  // more solves than the app has puzzles to solve. See its own comment in
  // `playerProgress.ts`.
  const solved = aptitude.solved;
  const earned = useMemo(
    () => getEarnedAchievements(progress).length,
    [progress],
  );

  const openEntry = (): void => {
    if (gravityLevel) markLevelOpened(gravityLevel.id);
    onOpen({ kind: entry.kind, puzzleId: entry.puzzleId });
  };

  // The Daily is a fixed side quest into the whole pool, independent of the
  // batch system's own resume position - see `getDailyEntry`. Its streak
  // lives on `PlayerProgress.daily` and updates itself the moment
  // `recordCompletion` sees this exact puzzle id solved, from whichever
  // screen plays it.
  // Cheap: answered from a cache, and follows the games still arriving.
  const daily = getDailyEntry();
  const dailyDays = useMemo(() => new Set(progress.dailyDays), [progress.dailyDays]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const openDaily = (): void =>
    onOpen({ kind: daily.kind, puzzleId: daily.puzzleId });

  // The Weekly Grand - one hard board a week, paying coins and, at a few
  // milestones, a cosmetic the shop does not sell.
  const grand = useMemo(() => getWeeklyGrand(new Date(), progress.retired, arriving ? roster : null), [progress.retired, arriving, roster]);
  const grandDone = isGrandSolved(progress, grand.week);
  const grandNext = nextGrandReward(progress);
  const grandNextItem = grandNext ? cosmeticById(grandNext.cosmetic) : undefined;
  const grandsSolved = progress.grandsSolved.length;
  const openGrand = (): void => onOpen({ kind: grand.kind, puzzleId: grand.puzzleId });
  const stampsWaiting = useMemo(() => unclaimedStamps(progress).length, [progress]);

  // A quiet cascade on every visit to Home (not just first mount - Home
  // remounts fresh each time the player backs out of a puzzle), so the hub
  // never feels like a static screen you're just returning to. The progress
  // fill animates separately so it reads as "counting up to here" rather
  // than popping straight to its resting width.
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mount.setValue(0);
    Animated.timing(mount, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mount]);

  // Opens on the tab the player left from: Home unmounts behind every other
  // screen, so a trip to Your games from the You tab used to land on Play.
  const [page, setPage] = useState(rememberedPage);
  useEffect(() => {
    rememberedPage = page;
  }, [page]);
  const carouselRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  // Only where it opens: driven from `page`, a tab tap would jump, not slide.
  const initialOffset = useRef({ x: rememberedPage * width, y: 0 }).current;
  // The carousel's offset, driven natively: the tab highlight slides with
  // the finger frame for frame, with no JavaScript in the loop (the first
  // version set React state from every scroll event and stuttered).
  const scrollX = useRef(new Animated.Value(rememberedPage * width)).current;
  // A page sliding in rises to full size and brightness as it settles; one
  // sliding away eases back - the cards breathe with the swipe instead of
  // moving as flat panels. Native driver, tied to the scroll itself.
  const pageMotion = (i: number) => {
    const range = [(i - 1) * width, i * width, (i + 1) * width];
    return {
      opacity: scrollX.interpolate({ inputRange: range, outputRange: [0.45, 1, 0.45], extrapolate: 'clamp' }),
      transform: [{ scale: scrollX.interpolate({ inputRange: range, outputRange: [0.93, 1, 0.93], extrapolate: 'clamp' }) }],
    };
  };
  const onCarouselNativeScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  const goToPage = useCallback(
    (index: number) => {
      triggerFeedback('uiPage');
      setPage(index);
      carouselRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [width],
  );
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

  // A short phone: the Today page drops its week strip and slims its
  // errands so all three still show (see `ErrandList`'s `dense`).
  const tight = cardHeight < 370;

  const accent = accentColorForKind(entry.kind);

  // Where the card lands on screen, for the backdrop to compose around.
  // Only its *position* is measured - its height is still computed above
  // (\`cardHeight\`), for the reason that block records. The carousel is a
  // child of \`stage\`, so the two offsets add.
  const [stageY, setStageY] = useState<number | null>(null);
  const [carouselY, setCarouselY] = useState<number | null>(null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageY(e.nativeEvent.layout.y);
  }, []);
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

  const iqLabel = `${
    aptitude.index === null
      ? `Puzzle IQ: not enough solves yet. ${aptitude.solved} of ${aptitude.total} puzzles solved.`
      : `Puzzle IQ ${aptitude.index}, from ${aptitude.solved} solves.${
          aptitude.strongest && aptitude.weakest
            ? ` Strongest at ${gameDisplayName(aptitude.strongest)}, weakest at ${gameDisplayName(aptitude.weakest)}.`
            : ''
        }`
  } ${stampsWaiting > 0 ? `${stampsWaiting} ledger stamp${stampsWaiting === 1 ? '' : 's'} to claim. ` : ''}Open the game ledger.`;

  // Pages with something waiting wear a dot above their tally mark, so it
  // is seen before the swipe.
  const waiting: Partial<Record<(typeof PAGES)[number], boolean>> = {
    today: errandsWaiting > 0 || !dailyCompletedToday,
    grand: !grandDone,
    you: chaptersWaiting > 0 || pending.length > 0 || stampsWaiting > 0,
  };

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
        <Icon name="settings" size={20} color={theme.colors.textSecondary} />
      </PressableScale>

      {/* The leaderboards, one tap from anywhere on Home - opposite the
          gear, so the masthead stays symmetrical. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Leaderboards"
        onPress={onOpenLeaderboard}
        hitSlop={8}
        containerStyle={[styles.settingsButton, styles.trophyButton, { top: insets.top + theme.spacing.sm }]}
      >
        <TrophyGlyph size={20} />
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
          <Text style={styles.wordmark}>TESSELLATUM</Text>
        </View>
        <View style={styles.rule}>
          <View style={styles.ruleLine} />
        </View>
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
        {/* The player's purse in one quiet line: coins (the way into the
            shop), Insight, and the Daily streak - plain figures with drawn
            marks, not a row of outlined chips. */}
        <View style={styles.streakSlot}>
          <View style={styles.status}>
            <PressableScale accessibilityRole="button" accessibilityLabel={`Shop. You have ${coins} coins.`} onPress={onOpenShop} hitSlop={8}>
              <View style={styles.statusItem}>
                <ShopBag />
                <CoinBalance coins={coins} />
                {progress.luckyCharges > 0 && <Text style={styles.purseCharm}>{'\u00D72'}</Text>}
                {PURCHASES_ENABLED && (
                  <View style={styles.pursePlus}>
                    <Text style={styles.pursePlusText}>+</Text>
                  </View>
                )}
                {setsReady > 0 && <View style={styles.statusDot} accessibilityLabel="A set bonus is ready in the shop" />}
              </View>
            </PressableScale>
            <View style={styles.statusRule} />
            <PressableScale accessibilityRole="button" accessibilityLabel={`${progress.insights} Insight. Open the shop`} onPress={onOpenShop} hitSlop={8}>
              <View style={styles.statusItem}>
                <Icon name="spark" size={13} color={theme.colors.accent} />
                <Text style={styles.statusText}>{progress.insights}</Text>
              </View>
            </PressableScale>
            {dailyStreak > 0 && (
              <>
                <View style={styles.statusRule} />
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={dailyCompletedToday ? `${dailyStreak} day streak` : `${dailyStreak} day streak. Play today's Daily to keep it.`}
                  onPress={openDaily}
                  hitSlop={8}
                >
                  <View style={styles.statusItem}>
                    <Icon name="sun" size={14} color={dailyCompletedToday ? theme.colors.textSecondary : theme.colors.secondary} weight={1.5} />
                    <Text style={styles.statusText}>{dailyStreak}</Text>
                    {/* Today's Daily still to play: a dot, not a word. */}
                    {!dailyCompletedToday && <View style={styles.statusDot} />}
                  </View>
                </PressableScale>
              </>
            )}
          </View>
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
          <Animated.ScrollView
            ref={carouselRef as never}
            style={{ height: cardHeight }}
            horizontal
            contentOffset={initialOffset}
            contentContainerStyle={styles.carouselContent}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onCarouselNativeScroll}
            onMomentumScrollEnd={onCarouselScroll}
            onScrollEndDrag={onCarouselScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {/* --- Continue ------------------------------------------------ */}
            <View style={[styles.page, { width }]}>
              <Animated.View style={[styles.pageInner, pageMotion(0)]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${
                  levelPoint.allDone ? 'Replay' : 'Continue'
                }: ${entry.name}, ${
                  entry.extreme
                    ? 'an extreme challenge, the hardest kind'
                    : entry.challenge
                      ? 'the challenge of this set, hard'
                      : entry.difficulty
                }${entry.golden && !levelPoint.allDone ? ', golden: triple coins' : ''}, Level ${levelPoint.levelNumber}, puzzle ${
                  levelPoint.batchPosition
                } of ${levelPoint.batchSize}`}
                onPress={openEntry}
                scaleTo={0.985}
                unstable_pressDelay={110}
                style={[styles.card,
                  { height: cardHeight },
                  entry.golden && !levelPoint.allDone && styles.cardGolden]}
              >
                <>
                  <View pointerEvents="none" style={styles.cardKeyline} />
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
                      Level {levelPoint.levelNumber} · {entry.chapter}
                    </Text>
                    {/* A game's first puzzle is always easy: on a debut the
                      "New game" chip says more, and the row stays readable. */}
                    {!debut && (
                      <DifficultyChip
                        difficulty={entry.difficulty}
                        challenge={entry.challenge}
                        extreme={entry.extreme}
                        style={styles.heroChip}
                      />
                    )}
                    {debut && (
                      <View style={[styles.newChip, { backgroundColor: accent }]}>
                        <Text style={styles.newChipText}>New game</Text>
                      </View>
                    )}
                    {entry.golden && !levelPoint.allDone && (
                      <View style={styles.goldenChip}>
                        <CoinGlyph size={10} />
                        <Text style={styles.goldenChipText}>{'Golden \u00D73'}</Text>
                      </View>
                    )}
                  </View>
                  {/* The plate's heading rule, in this puzzle's own game
                    colour. Home used to carry that colour in one short line
                    of type and nowhere else, so every card looked the same
                    whichever of the eight games it was about. */}
                  <View
                    style={[styles.headingRule, { backgroundColor: accent }]}
                  />
                  {/* The name alone: the game it belongs to is already ringed
                    in the set row below, and a second emblem here showed the
                    same game twice. */}
                  <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {entry.name}
                  </Text>
                  {!debut && progress.currentBatch && (
                    <Text style={styles.heroSub}>{`Puzzle ${levelPoint.batchPosition} of ${levelPoint.batchSize} in this set`}</Text>
                  )}
                  {/* Only a debut needs a line here: otherwise the set's own
                      emblems below already say where in it this puzzle is. */}
                  {debut && <Text style={styles.heroMeta}>{`Your first ${entry.chapter} puzzle.${lessonFirst ? ' A short lesson comes first.' : ''}`}</Text>}

                  {/* The middle of every card is a flexible block holding real
                    content, centred. Slack from a tall screen spreads around
                    it instead of pooling into the two hard gaps a
                    `space-between` skeleton produced. */}
                  <View style={styles.wellCentered}>

                    {/* The games this level is actually made of. The card
                      already said "Puzzle 3 of 4" - a number that says how far
                      along you are but nothing about what is coming. These say
                      what the rest of the set is, named, with a finished one
                      filled and the ones ahead faded: a preview, not a
                      mystery. */}
                    {progress.currentBatch && <Text style={styles.setLabel}>This set</Text>}
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
                          const tint = accentColorForKind(entryRef.kind);
                          return (
                            <React.Fragment key={`${entryRef.puzzleId}-${i}`}>
                            {/* The path between one game and the next: dots,
                                filled once the way is walked. */}
                            {i > 0 && (
                              <View style={styles.setPath}>
                                {[0, 1, 2].map(k => (
                                  <View key={k} style={[styles.setPathDot, (done || isCurrent) && styles.setPathDotOn]} />
                                ))}
                              </View>
                            )}
                            <View style={styles.setItem}>
                              <View style={[styles.setRing, isCurrent && { borderColor: tint }, !(done || isCurrent) && styles.setAhead]}>
                                <GameEmblem kind={entryRef.kind} size={44} />
                                {done && (
                                  <View style={[styles.setCheck, { backgroundColor: tint }]}>
                                    <Icon name="check" size={9} color={theme.colors.surfaceHi} />
                                  </View>
                                )}
                              </View>
                              {/* A golden puzzle wears a coin, like a seal on
                                the corner of a page. Outside the fade, like
                                the challenge rule: worth seeing coming. */}
                              {!done && !played.has(entryRef.kind) && (
                                <View style={[styles.setNew, { backgroundColor: accentColorForKind(entryRef.kind) }]} accessibilityLabel="new game">
                                  <Text style={styles.setNewText}>New</Text>
                                </View>
                              )}
                              {entryRef.golden && !done && (
                                <View style={styles.setGolden} accessibilityLabel="golden puzzle">
                                  <CoinGlyph size={13} />
                                </View>
                              )}
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
                            </React.Fragment>
                          );
                        })}
                      </View>
                    )}

                    {/* The next game on its way: a small promise, kept a
                      few puzzles from now. Named only once it lands. */}
                    <View style={styles.cardFoot}>
                      {arriving && (
                        <PressableScale
                          accessibilityRole="button"
                          onPress={onOpenCollection}
                          hitSlop={6}
                          containerStyle={styles.nextWrap}
                          style={styles.next}
                          accessibilityLabel={`Next game: ${gameShortName(arriving.kind)}, after ${arriving.inPuzzles} more ${gameShortName(arriving.gate)} ${arriving.inPuzzles === 1 ? 'puzzle' : 'puzzles'}. ${roster.length} of ${INTRO_ORDER.length} games so far. Open your games`}
                        >
                          {/* The next game, waiting: its emblem, faded, and
                            a bar that fills with every puzzle of the game
                            being learned. Enough of those, and it arrives. */}
                          <View style={styles.nextEmblem}>
                            <GameEmblem kind={arriving.kind} size={26} />
                          </View>
                          <View style={styles.nextBody}>
                            <View style={styles.nextHead}>
                              <Text style={styles.nextTitle} numberOfLines={1}>{`Next: ${gameShortName(arriving.kind)}`}</Text>
                              <Text style={styles.nextCount}>{`${arriving.done}/${arriving.need}`}</Text>
                            </View>
                            <View style={styles.nextTrack}>
                              <View style={[styles.nextFill, { width: `${(arriving.done / arriving.need) * 100}%`, backgroundColor: accentColorForKind(arriving.gate) }]} />
                            </View>
                          </View>
                        </PressableScale>
                      )}
                      {/* Stuck? Swap the next puzzle for another game's - paid
                        for, so it is a choice, not a way round every board.
                        Nested inside the card's own press target: RN gives the
                        touch to the deepest Pressable, so this never also
                        opens the puzzle. */}
                      {!levelPoint.allDone && canSwap && (
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={`Swap this puzzle for another game's, for ${SWAP_PRICE} coins`}
                          onPress={swap}
                          hitSlop={8}
                          containerStyle={styles.swapWrap}
                        >
                          <View style={[styles.swap, arriving && styles.swapBeside]}>
                            {swapNote === 'done' ? (
                              <Icon name="check" size={14} color={theme.colors.success} weight={2.2} />
                            ) : swapNote === 'short' ? (
                              <Text style={[styles.swapText, styles.swapShort]}>{`Need ${SWAP_PRICE}`}</Text>
                            ) : (
                              <>
                                <Icon name="swap" size={14} color={theme.colors.textSecondary} />
                                {!arriving && <Text style={styles.swapText}>Swap game</Text>}
                              </>
                            )}
                            {swapNote === null && (
                              <>
                                <CoinGlyph size={11} />
                                <Text style={styles.swapText}>{SWAP_PRICE}</Text>
                              </>
                            )}
                          </View>
                        </PressableScale>
                      )}
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
              </Animated.View>
            </View>

            {/* --- Today -------------------------------------------------- */}
            {/* The Daily and the day's errands on one page: everything that
              resets at midnight, together. The Daily is the well at the
              top (tap it to play); the errands sit under it. */}
            <View style={[styles.page, { width }]}>
              <Animated.View style={[styles.pageInner, pageMotion(1)]}>
              <View style={[styles.card, { height: cardHeight }]}>
                <View pointerEvents="none" style={styles.cardKeyline} />
                <View style={styles.cardHead}>
                  <Text style={styles.eyebrowMuted}>Today</Text>
                  <Text style={[styles.badge, errandsWaiting > 0 || !dailyCompletedToday ? styles.badgeLive : styles.badgeDone]}>
                    {errandsWaiting > 0 ? `${errandsWaiting} to claim` : dailyCompletedToday ? 'Daily solved' : 'Daily waiting'}
                  </Text>
                </View>
                <View style={[styles.headingRule, { backgroundColor: accentColorForKind(daily.kind) }]} />

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Daily puzzle: ${daily.name}${dailyCompletedToday ? ', already solved today' : ''}${dailyStreak > 0 ? `, ${dailyStreak} day streak` : ''}. ${dailyCompletedToday ? 'Replay' : 'Play'}`}
                  onPress={openDaily}
                  scaleTo={0.98}
                unstable_pressDelay={110}
                  style={[styles.todayDaily, tight && styles.todayDailyTight]}
                >
                  <View style={styles.todayDailyRow}>
                    <View style={[styles.cardEmblem, { borderColor: accentColorForKind(daily.kind) }]}>
                      <GameEmblem kind={daily.kind} size={44} />
                    </View>
                    <View style={styles.dailyText}>
                      <Text style={styles.todayKicker}>The Daily</Text>
                      <Text style={styles.todayTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {daily.name}
                      </Text>
                      <Text style={styles.dailyChapter} numberOfLines={1}>
                        {tight ? (dailyStreak > 0 ? `${daily.chapter} · ${dailyStreak}-day streak` : daily.chapter) : daily.chapter}
                      </Text>
                    </View>
                    {/* Solved: a tick, not a play button - today's is done. */}
                    {dailyCompletedToday ? (
                      <View style={[styles.play, styles.playSmall, styles.playDone]}>
                        <Icon name="check" size={20} color={theme.colors.surfaceHi} weight={2.4} />
                      </View>
                    ) : (
                      <View style={[styles.play, styles.playSmall]}>
                        <View style={[styles.playTri, styles.playTriSmall]} />
                      </View>
                    )}
                  </View>
                  {/* The week of Dailies (tap for the whole calendar), and in
                      one line beside it the streak or today's time. */}
                  {!tight && (
                  <View style={styles.todayStreak}>
                    <WeekStrip days={dailyDays} todayKey={todayKey} onPress={() => setCalendarOpen(true)} />
                    <View style={styles.todayStreakSide}>
                      <Text style={styles.todayStreakCount} numberOfLines={1}>
                        {dailyStreak > 0 ? `${dailyStreak}-day streak` : 'No streak yet'}
                      </Text>
                      <Text style={styles.todayStatus} numberOfLines={1}>
                        {dailyCompletedToday
                          ? progress.dailyTimes[todayKey]
                            ? `Solved in ${formatDuration(progress.dailyTimes[todayKey])}`
                            : 'Solved today'
                          : dailyStreak > 0
                            ? 'Play to keep it'
                            : 'New every day'}
                      </Text>
                    </View>
                  </View>
                  )}
                </PressableScale>

                <View style={[styles.todaySpacer, tight && styles.todaySpacerTight]} />
                {/* On a small phone the three errands may not all fit under
                    the Daily: then they scroll, rather than being cut off. */}
                <ScrollView style={styles.todayErrands} showsVerticalScrollIndicator={false} bounces={false}>
                  <ErrandList compact dense={tight} />
                </ScrollView>
              </View>
              </Animated.View>
            </View>

            {/* --- Weekly Grand -------------------------------------------- */}
            <View style={[styles.page, { width }]}>
              <Animated.View style={[styles.pageInner, pageMotion(2)]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Weekly Grand: ${grand.name}, a ${grand.tier} ${gameDisplayName(grand.kind)} board. ${
                  grandDone ? 'Solved this week.' : `${grand.daysLeft} day${grand.daysLeft === 1 ? '' : 's'} left. Pays ${GRAND_COINS} coins.`
                }${grandNextItem ? ` ${grandNext!.at - grandsSolved} more to win ${grandNextItem.name}.` : ''}`}
                onPress={openGrand}
                scaleTo={0.985}
                unstable_pressDelay={110}
                style={[styles.card, styles.cardGrand, { height: cardHeight }]}
              >
                <View pointerEvents="none" style={styles.cardKeyline} />
                <View style={styles.cardHead}>
                  <Text style={[styles.eyebrowMuted, styles.grandEyebrow]}>Weekly Grand</Text>
                  <Text style={[styles.badge, grandDone ? styles.badgeDone : styles.badgeLive]}>
                    {grandDone ? 'Solved' : grand.daysLeft === 1 ? 'Last day' : `${grand.daysLeft} days left`}
                  </Text>
                </View>
                <View style={[styles.headingRule, styles.grandRule]} />
                <View style={styles.dailyRow}>
                  <View style={[styles.cardEmblem, styles.grandEmblem]}>
                    <GameEmblem kind={grand.kind} size={50} />
                  </View>
                  <View style={styles.dailyText}>
                    <Text style={styles.dailyTitle} numberOfLines={2}>
                      {grand.name}
                    </Text>
                    <Text style={styles.dailyChapter}>{grand.tier === 'hard' ? 'Hard' : 'Medium'} · {gameDisplayName(grand.kind)} · one a week</Text>
                  </View>
                </View>

                <View style={styles.wellCentered}>
                  <View style={styles.grandPays}>
                    <Text style={styles.sectionLabel}>{grandDone ? 'Paid this week' : 'This week pays'}</Text>
                    <View style={styles.grandCoins}>
                      <CoinGlyph size={16} />
                      <Text style={styles.grandCoinsText}>{GRAND_COINS}</Text>
                    </View>
                  </View>
                  {/* The exclusives on offer, in the order they are won -
                    the shelf the Grand is building toward. Won ones sit
                    full, the next one is ringed in gold, the rest wait. */}
                  <View style={styles.grandShelf}>
                    {GRAND_REWARDS.map(reward => {
                      const item = cosmeticById(reward.cosmetic);
                      const won = grandsSolved >= reward.at;
                      const next = grandNext?.cosmetic === reward.cosmetic;
                      return (
                        <View key={reward.cosmetic} style={styles.grandPrize}>
                          <View style={[styles.grandPlate, next && styles.grandPlateNext, !won && !next && styles.setAhead]}>
                            {item && <CosmeticPreview item={item} size={36} />}
                            {won && (
                              <View style={styles.grandTick}>
                                <Icon name="check" size={11} color={theme.colors.surfaceHi} weight={2.6} />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.grandPrizeAt, won && styles.grandPrizeWon]}>
                            {won ? 'Won' : `${reward.at} ${reward.at === 1 ? 'Grand' : 'Grands'}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.dailyStreakLabel}>
                    {grandNextItem
                      ? `${grandNext!.at - grandsSolved} more Grand${grandNext!.at - grandsSolved === 1 ? '' : 's'} for ${grandNextItem.name}`
                      : 'Every prize won'}
                  </Text>
                </View>

                <View style={styles.heroFoot}>
                  <Text style={styles.verb}>{grandDone ? 'Replay' : 'Play'}</Text>
                  <View style={styles.play}>
                    <View style={styles.playTri} />
                  </View>
                </View>
              </PressableScale>
              </Animated.View>
            </View>

            {/* --- You ---------------------------------------------------- */}
            {/* Rank, chapter and the record on one page - what used to be
              three (Rank, Puzzle IQ, Progress). Each figure opens where its
              detail lives: the almanac, the ledger, the achievements. */}
            <View style={[styles.page, { width }]}>
              <Animated.View style={[styles.pageInner, pageMotion(3)]}>
              <View style={[styles.card, { height: cardHeight }]}>
                <View pointerEvents="none" style={styles.cardKeyline} />
                <View style={styles.cardHead}>
                  <Text style={styles.eyebrowMuted}>You</Text>
                  <View style={styles.youHeadRight}>
                    {chaptersWaiting > 0 || pending.length > 0 ? (
                      <Text style={[styles.badge, styles.badgeLive]}>Reward waiting</Text>
                    ) : stampsWaiting > 0 ? (
                      <Text style={[styles.badge, styles.badgeLive]}>Stamp waiting</Text>
                    ) : (
                      <Text style={[styles.badge, styles.badgeDone]}>Rank {toRoman(rank.number)}</Text>
                    )}
                  </View>
                </View>
                <View style={[styles.headingRule, { backgroundColor: theme.colors.accent }]} />

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Rank ${rank.number}, ${rank.title}. ${rank.to - rank.xp} experience to the next rank. Chapter ${chapterNow.chapter.number}, ${chapterNow.chapter.name}. Open your almanac.`}
                  onPress={onOpenJourney}
                  scaleTo={0.98}
                unstable_pressDelay={110}
                  style={[styles.youRank]}
                >
                  <View style={styles.rankRow}>
                    <RankMedal rank={rank.number} size={Math.min(72, cardHeight * 0.19)} />
                    <View style={styles.rankText}>
                      <Text style={styles.rankTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {rank.title}
                      </Text>
                      <Text style={styles.rankMeta}>
                        {(rank.to - rank.xp).toLocaleString('en-US')} XP to {rankTitle(rank.number + 1)}
                      </Text>
                      <XpBar share={rank.share} style={styles.rankBar} />
                    </View>
                  </View>
                  {/* The chapter, in one quiet line - its track lives in the
                      almanac, which this card opens. */}
                  <View style={styles.youChapter}>
                    <Text style={styles.sectionLabel} numberOfLines={1}>{`Chapter ${toRoman(chapterNow.chapter.number)} · ${chapterNow.chapter.name}`}</Text>
                    <Text style={styles.youChapterLeft}>{`${LEVELS_PER_CHAPTER - chapterNow.levelsDone} to go`}</Text>
                  </View>
                </PressableScale>

                {/* Every game in the order they arrive: the ones you have
                    met in colour, the rest waiting faded. The collection
                    filling up, seen at a glance - and the door to it. A
                    short phone keeps the plain Games door instead. */}
                {!tight && (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Your games: ${roster.length} of ${INTRO_ORDER.length}, ${solved} puzzles solved. Open your games`}
                    onPress={onOpenCollection}
                    scaleTo={0.98}
                    unstable_pressDelay={110}
                    containerStyle={styles.wellCentered}
                  >
                    <View style={styles.shelfHead}>
                      <Text style={styles.setLabel}>Your games</Text>
                      <Text style={styles.shelfCount}>{`${roster.length} of ${INTRO_ORDER.length} · ${solved} solved`}</Text>
                    </View>
                    <View style={styles.shelf}>
                      {INTRO_ORDER.map(kind => (
                        <View key={kind} style={[styles.shelfSlot, !roster.includes(kind) && styles.shelfAhead]}>
                          <GameEmblem kind={kind} size={30} />
                        </View>
                      ))}
                    </View>
                  </PressableScale>
                )}

                {/* Where the rest lives: doors with one line each of where
                    it stands. */}
                <View style={styles.youLinks}>
                  {[
                    ...(tight ? [{ label: 'Games', note: `${roster.length} of ${ROTATION.length} · ${solved} solved`, a11y: 'Open your games', onPress: onOpenCollection, dot: false }] : []),
                    { label: 'Badges', note: `${earned} of ${ACHIEVEMENTS.length}`, a11y: 'Open achievements', onPress: onOpenAchievements, dot: false },
                    { label: 'Ledger', note: stampsWaiting > 0 ? `${stampsWaiting} to claim` : aptitude.index !== null ? `Puzzle IQ ${aptitude.index}` : 'Stamps and records', a11y: `Open the ledger. ${iqLabel}`, onPress: onOpenLedger, dot: stampsWaiting > 0 },
                    { label: 'Leaderboards', note: 'Top times', a11y: 'Open the leaderboards', onPress: onOpenLeaderboard, dot: false },
                  ].map(link => (
                    <PressableScale key={link.label} accessibilityRole="button" accessibilityLabel={`${link.a11y}. ${link.note}`} onPress={link.onPress} scaleTo={0.97} containerStyle={[styles.youLinkWrap, !tight && styles.youLinkThird]} style={[styles.youLink, !tight && styles.youLinkSnug]}>
                      <View style={styles.youLinkHead}>
                        <Text style={styles.youLinkText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {link.label}
                        </Text>
                        {link.dot && <View style={styles.youLinkDot} />}
                      </View>
                      <Text style={styles.youLinkNote} numberOfLines={1}>
                        {link.note}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
              </Animated.View>
            </View>
          </Animated.ScrollView>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.dots,
          { paddingBottom: insets.bottom + theme.spacing.sm },
          riseIn(mount, 0.9),
        ]}
      >
        {/* Named tabs, not bare marks: a player sees at once that Home
            has four pages, and can tap straight to one. */}
        <View style={styles.tabs}>
          {/* The highlight: one pill sliding under the labels with the
              swipe itself. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabPill,
              {
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [0, Math.max(1, width * (PAGES.length - 1))],
                      outputRange: [0, TAB_WIDTH * (PAGES.length - 1)],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
          {PAGES.map((name, i) => {
            const near = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected: i === page }}
                accessibilityLabel={`${PAGE_LABELS[name]}${waiting[name] && i !== page ? ', something waiting' : ''}`}
                onPress={() => goToPage(i)}
                hitSlop={4}
                style={styles.tab}
              >
                <Text style={styles.tabText}>{PAGE_LABELS[name]}</Text>
                {/* The light label over the pill, faded in by the same
                    native offset, so the colour change glides too. */}
                <Animated.Text style={[styles.tabText, styles.tabTextOn, { opacity: near }]}>{PAGE_LABELS[name]}</Animated.Text>
                {waiting[name] && i !== page && <View style={styles.tabBadge} />}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
      {gift && (
        <DailyGiftCard
          gift={gift}
          onCollect={() => {
            if (claimGift()) triggerFeedback('coin');
          }}
        />
      )}
      {calendarOpen && <StreakCalendar days={dailyDays} todayKey={todayKey} streak={dailyStreak} best={progress.bestDailyStreak} onClose={() => setCalendarOpen(false)} />}
      {rankUp && (
        <RankUpCard
          rank={rankUp.rank}
          ranksGained={rankUp.gained}
          coins={rankUp.coins}
          onDone={() => {
            collectRanks();
            setRankUp(null);
          }}
        />
      )}
    </View>
  );
}


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
  STREAK_SLOT_HEIGHT +
  theme.spacing.lg;
const DOTS_BLOCK = theme.spacing.sm * 2 + 8;

const styles = themedStyles(() => ({
  trophyButton: { right: undefined, left: theme.spacing.lg },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.colors.borderStrong },
  pursePlus: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.goldFill, alignItems: 'center', justifyContent: 'center' },
  pursePlusText: { color: theme.colors.onGold, fontSize: 13, lineHeight: 15, fontWeight: theme.typography.weights.bold },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 14, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  statusRule: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: theme.colors.borderStrong },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  streakNudgeDone: { borderColor: theme.colors.border },
  streakNudgeTextDone: { color: theme.colors.textSecondary },
  todayDaily: {
    marginTop: theme.spacing.md,
  },
  todayDailyRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  todayKicker: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  todayTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  playDone: { backgroundColor: theme.colors.success },
  playDoneGlyph: { color: theme.colors.surfaceHi, fontSize: 18, fontWeight: theme.typography.weights.bold },
  playSmall: { width: 42, height: 42, borderRadius: 21 },
  playTriSmall: { borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 12, marginLeft: 4 },
  todayStreak: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  todayStreakSide: { alignItems: 'flex-end', gap: 1 },
  todayErrands: { flexGrow: 0, flexShrink: 1 },
  todayStreakCount: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  todayStatus: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  todaySpacer: { flex: 1, minHeight: theme.spacing.sm },
  todaySpacerTight: { minHeight: 4 },
  todayDailyTight: { marginTop: theme.spacing.sm },
  youHeadRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  youRank: { marginTop: theme.spacing.sm },
  youLinkSnug: { paddingHorizontal: 10 },
  youLinkThird: { width: '30%', flexBasis: 'auto' },
  shelfHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  shelfCount: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  shelfSlot: { width: '16.66%', alignItems: 'center' },
  shelfAhead: { opacity: 0.22 },
  cardEmblem: { padding: 3, borderRadius: 16, borderWidth: 2 },
  grandEmblem: { borderColor: theme.colors.goldRim },
  grandRule: { backgroundColor: theme.colors.gold },
  youChapter: { marginTop: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm },
  youChapterLeft: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  youFigures: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' },
  youValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  youLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 'auto' },
  youLinkWrap: { width: '48.5%', flexGrow: 1 },
  youLink: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: theme.colors.background, gap: 2 },
  youLinkHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  youLinkText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  youLinkNote: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  youLinkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  pursePatron: { width: 9, height: 9, borderRadius: 2, marginRight: 6, transform: [{ rotate: '45deg' }], backgroundColor: theme.colors.gold, borderWidth: 1.5, borderColor: theme.colors.goldRim },
  purseDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 4, backgroundColor: theme.colors.secondary },
  purse: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 4, paddingVertical: 3, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.goldRim, backgroundColor: theme.colors.surface },
  purseCharm: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.colors.accent,
    color: theme.colors.surfaceHi,
    fontFamily: theme.typography.families.mono,
    fontSize: 9.5,
    fontWeight: theme.typography.weights.bold,
  },
  swapWrap: { alignSelf: 'center' },
  swapBeside: { justifyContent: 'center', alignSelf: 'stretch', gap: 4, paddingHorizontal: 12, borderRadius: 14 },
  swap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border },
  swapText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  swapShort: { color: theme.colors.danger },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  rankText: { flex: 1 },
  rankTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  rankMeta: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  rankBar: { marginTop: theme.spacing.sm },
  chapterTicks: { flexDirection: 'row', gap: 4, marginTop: theme.spacing.sm, alignSelf: 'stretch' },
  chapterTick: { flex: 1, height: 10, borderRadius: 3, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chapterTickDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chapterTickNow: { borderColor: theme.colors.accent, borderWidth: 2 },
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
  streakNudge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.secondary },
  streakNudgeText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  // TESSELLATUM is eleven letters: a size and tracking that leave clear
  // room for the trophy and the gear on either side at phone width.
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    color: theme.colors.textPrimary,
  },
  /** Measured rather than fixed: the mark inside places itself at
   * fractions of the real width, so it keeps its rhythm on any screen. */
  rule: { marginVertical: theme.spacing.xs, height: 14, alignItems: 'center', justifyContent: 'center' },

  /** One carousel slot. The card inside is centred in it, so the height
   * the cap leaves over becomes even margin rather than a gap at one end. */
  /** The carousel hugs its tallest card rather than filling the screen.
   * Given a height it centres a short card inside a tall box and then the
   * box itself gets centred again, which stranded the Continue card in the
   * lower half of the screen with a field of paper above it. */
  carouselContent: {
    alignItems: 'center',
  },
  pageInner: { alignSelf: 'stretch' },
  page: {
    paddingHorizontal: theme.spacing.lg,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
  // The set sits on the card itself - no box inside the box; a box in a
  // card in a page read as generated, not designed.
  wellCentered: {
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
  cardGrand: {
    borderColor: theme.colors.goldRim,
    borderWidth: 1.5,
  },
  grandEyebrow: { color: theme.colors.gold },
  grandPays: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grandCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grandCoinsText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  grandShelf: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  grandPrize: { alignItems: 'center', gap: 5 },
  grandPlate: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grandPlateNext: { borderColor: theme.colors.goldRim, borderWidth: 2, backgroundColor: theme.colors.surfaceHi },
  grandTick: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.success,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grandTickText: { color: theme.colors.surfaceHi, fontSize: 9, fontWeight: theme.typography.weights.bold },
  grandPrizeAt: { fontSize: theme.typography.sizes.micro, color: theme.colors.textTertiary },
  grandPrizeWon: { color: theme.colors.success },
  sectionLabel: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary, marginBottom: 6 },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary, flexShrink: 1 },
  heroChip: { marginLeft: 8 },
  eyebrowMuted: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  heroTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.display,
    lineHeight: theme.typography.lineHeights.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  heroMeta: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, marginTop: 8 },
  heroSub: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, marginTop: 2 },
  /** A fine printed rule just inside every card's edge - a plate's border,
   * not a box: nothing sits inside it but the card's own content. */
  cardKeyline: { position: 'absolute', top: 6, left: 6, right: 6, bottom: 6, borderRadius: 19, borderWidth: 1, borderColor: theme.colors.border, opacity: 0.8 },
  setLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.textTertiary, textAlign: 'center', marginBottom: theme.spacing.sm },
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  setItem: {
    alignItems: 'center',
  },
  /** Every game sits in the same ring; only the one up next shows it, in
   * its own colour - so the row never shifts as the set moves on. */
  setRing: { padding: 3, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  setCheck: { position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.surface },
  setPath: { flexDirection: 'row', gap: 3, marginTop: 26, marginHorizontal: 4 },
  setPathDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.borderStrong },
  setPathDotOn: { backgroundColor: theme.colors.textTertiary },
  /** Each game named under its own mark. The marks alone were an
   * identity parade for anyone who had not yet learned them; with the
   * names the row actually answers "what is in this set". */
  setName: { fontSize: theme.typography.sizes.micro, color: theme.colors.textTertiary, marginTop: 4 },
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
  cardGolden: {
    borderColor: theme.colors.goldRim,
    borderWidth: 1.5,
  },
  goldenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.goldFill,
  },
  goldenChipText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.onGold,
  },
  setNew: {
    position: 'absolute',
    top: -7,
    left: -6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 5,
    zIndex: 2,
  },
  setNewText: { fontSize: 7, fontWeight: theme.typography.weights.bold, letterSpacing: 0.8, color: theme.colors.surfaceHi },
  // The next game and the swap share one row, so the card's foot (Continue
  // and its play button) never gets pushed off the bottom.
  cardFoot: { flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch', gap: 8, marginTop: theme.spacing.sm },
  nextWrap: { flex: 1 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: theme.colors.background },
  nextEmblem: { opacity: 0.55 },
  nextBody: { flex: 1, gap: 4 },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nextTitle: { flex: 1, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  nextCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  nextTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: theme.colors.border },
  nextFill: { height: 4, borderRadius: 2 },
  newChip: { marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: theme.radii.pill },
  newChipText: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 0.4, color: theme.colors.surfaceHi },
  setGolden: {
    position: 'absolute',
    top: -4,
    left: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
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

  badge: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold },
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
  dailyChapter: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, marginTop: 2 },
  dailyStreakLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, marginTop: theme.spacing.sm, textAlign: 'center' },


  figure: {
    flex: 1,
  },
  figureRule: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.borderStrong,
  },
  figureOf: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.textTertiary,
  },
  figureStar: {
    color: theme.colors.accentText,
  },
  figureLabel: { fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary, marginTop: 2 },

  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tab: { width: TAB_WIDTH, height: 30, alignItems: 'center', justifyContent: 'center' },
  tabPill: { position: 'absolute', top: 3, left: 3, width: TAB_WIDTH, height: 30, borderRadius: 15, backgroundColor: theme.colors.primary },
  tabText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  tabTextOn: { position: 'absolute', color: theme.colors.surfaceHi },
  tabBadge: { position: 'absolute', top: 4, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  shopTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 8, marginRight: 2, borderRightWidth: 1, borderRightColor: theme.colors.goldRim },
  shopTagText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  insightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  insightGlyph: { fontSize: 12, color: theme.colors.accent },
  insightChipText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },
}));

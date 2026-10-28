import { Canvas, Path, RoundedRect } from '@shopify/react-native-skia';
import { Icon } from '../components/Icon';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
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
  SET_BONUS,
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
  ROTATION,
  nextDayStart,
} from '../game/journey';
import {
  AlmanacBackdrop,
  DifficultyChip,
  GameEmblem,
  PressableScale,
  PressDepth,
  sunkKey,
  TesseraMark,
} from '../components';
import { isReducedMotion, readableOn, shade, triggerFeedback } from '../game/rendering';
import { motion, nightTone, theme, themedStyles } from '../theme';
import { useEquipped } from '../progression/PlayerProgressProvider';
import { useToday } from '../components/useToday';
import { CoinBalance, CoinGlyph, FIGURE_SCALE } from '../components/Coins';
import { ErrandList } from '../components/ErrandList';
import { RankMedal } from '../components/RankMedal';
import { RankUpCard } from '../components/RankUpCard';
import { XpBar } from '../components/XpBar';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { useSettings } from '../settings';
import { tutorialIdForGame } from '../game/tutorials';
import { curve } from '../theme/motion';
import { FixedTextCap, Text, MAX_TEXT_SCALE } from '../components/Text';;
import { glide, settle, slice } from '../components/placeMotion';
import { hasSavedBoard } from '../progression/boardSaves';
import { GameEmblemGlyph, emblemLip, mix } from '../components/GameEmblem';
import { StarRow } from '../components/StarRow';
import { GameArrival } from '../components/GameArrival';
import { arrivalsLoaded, markArrivalSeen, newlyArrived, whenArrivalsLoaded } from '../progression/gameArrivals';

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

/**
 * Home's first arrival in a run of the app: its pieces are placed, the way
 * the games are placed on the level card (`placeMotion`), each a slice of
 * one clock from 0 to 1. A piece drops `dy` into place, grows from
 * `scale` with a small give, and straightens from a `turn` in degrees.
 */
function placed(t: Animated.Value, from: number, to: number, o: { dy?: number; scale?: number; turn?: number } = {}) {
  const transform: Array<Record<string, Animated.AnimatedInterpolation<number | string>>> = [];
  if (o.dy) transform.push({ translateY: slice(t, from, to, glide, [o.dy, 0]) });
  if (o.scale) transform.push({ scale: slice(t, from, to, settle, [o.scale, 1]) });
  if (o.turn) transform.push({ rotate: slice(t, from, to, settle, [0, 1]).interpolate({ inputRange: [0, 1], outputRange: [`${o.turn}deg`, '0deg'] }) });
  return { opacity: slice(t, from, from + (to - from) * 0.45, glide, [0, 1]), transform };
}

/** How long the first arrival takes, start to the tabs settling. */
const PLACE_MS = 1150;
/** It waits this long into the launch's hand-off, so the first pieces land
 * as the tile lifts rather than under it. */
const PLACE_DELAY_MS = 260;
/** Whether Home has already made its first arrival in this run: every later
 * visit (back from a game) gets the quiet cascade instead. */
let placedOnce = false;

/**
 * Home's first arrival, held while the launch plays over it. A release
 * rather than a prop: telling Home through its props re-rendered the
 * whole screen in the very frame its pieces began to move.
 */
let entranceHeld = false;
const entranceWaiters = new Set<() => void>();
export function holdHomeEntrance(): void {
  entranceHeld = true;
}
export function releaseHomeEntrance(): void {
  entranceHeld = false;
  entranceWaiters.forEach(waiter => waiter());
  entranceWaiters.clear();
}
function whenEntranceReleased(start: () => void): () => void {
  if (!entranceHeld) {
    start();
    return () => {};
  }
  entranceWaiters.add(start);
  return () => {
    entranceWaiters.delete(start);
  };
}

export interface HomeScreenProps {
  /** Called once Home has drawn its first frame. */
  onDrawn?: () => void;
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
/** Where Home's card sat last time, at that screen size (see `cardRect`). */
let lastCardSpot: { width: number; height: number; stageY: number; carouselY: number } | null = null;
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
function HomeScreenImpl({
  onDrawn,
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
  // Moves on at midnight with the app open: the Daily and errands turn over.
  const todayKey = useToday();
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
  // Left half played: the card says so, and the board opens as it was.
  const resuming = hasSavedBoard(entry.puzzleId);
  const isGravity = entry.kind === 'gravity';

  const gravityLevel = isGravity ? getLevelById(entry.puzzleId) : undefined;
  // Games arrive one at a time (see `INTRO_ORDER`): a debut in this set is
  // marked new, the next arrival is teased, and Swap waits until there is
  // a second game to swap to.
  const played = useMemo(() => gamesPlayed(progress), [progress]);
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  const roster = useMemo(() => unlockedGames(progress), [progress]);
  const canSwap = roster.length > 1;
  // A game that has arrived since Home last looked: greeted once, after
  // Home has settled in, with its own reveal.
  const [arrival, setArrival] = useState<GameKind | null>(null);
  const [arrivalsReady, setArrivalsReady] = useState(arrivalsLoaded);
  useEffect(() => whenArrivalsLoaded(() => setArrivalsReady(true)), []);
  useEffect(() => {
    // Only once the saved progress and what was already greeted are both
    // read back: Home can mount under the launch before either, and a
    // half-loaded roster made a game long played look newly arrived.
    if (!ready || !arrivalsReady) return;
    const kind = newlyArrived(roster, played);
    if (!kind) return;
    const timer = setTimeout(() => setArrival(kind), placing ? 1500 : 600);
    return () => clearTimeout(timer);
    // On mount, once loaded, and whenever the roster grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.length, ready, arrivalsReady]);
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
  const grand = useMemo(() => getWeeklyGrand(new Date(), progress.retired, arriving ? roster : null),
    // `todayKey`: a new day can start a new week.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.retired, arriving, roster, todayKey]);
  const grandDone = isGrandSolved(progress, grand.week);
  const grandNext = nextGrandReward(progress);
  const grandNextItem = grandNext ? cosmeticById(grandNext.cosmetic) : undefined;
  const grandsSolved = progress.grandsSolved.length;
  const openGrand = (): void => onOpen({ kind: grand.kind, puzzleId: grand.puzzleId });
  const stampsWaiting = useMemo(() => unclaimedStamps(progress).length, [progress]);

  // The progress fill animates separately, so it reads as "counting up to
  // here" rather than popping straight to its resting width.
  // The first visit of the run places Home piece by piece. Every later
  // visit arrives whole, carried in by the screen transition alone: a
  // second cascade inside it (backdrop, header, card and tabs each fading
  // in on their own beat) read as the page assembling itself, broken.
  const [placing] = useState(() => !placedOnce && !isReducedMotion());
  const mount = useRef(new Animated.Value(placing ? 0 : 1)).current;
  const entered = useRef(false);
  useEffect(() => {
    // Two frames: one to lay out, one to draw what the layout placed.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => onDrawn?.());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Built once: native-driven interpolations, not remade every render.
  const place = useMemo(
    () => ({
      backdrop: slice(mount, 0.02, 0.34, glide, [0, 1]),
      rule: { opacity: slice(mount, 0.24, 0.34, glide, [0, 1]), transform: [{ scaleX: slice(mount, 0.24, 0.5, glide, [0, 1]) }] },
      gear: placed(mount, 0.14, 0.44, { scale: 0.7 }),
      trophy: placed(mount, 0.1, 0.4, { scale: 0.7 }),
      mark: placed(mount, 0, 0.34, { dy: -14, scale: 0.55, turn: -14 }),
      name: placed(mount, 0.08, 0.4, { dy: 8 }),
      shop: placed(mount, 0.22, 0.5, { dy: 6, scale: 0.8 }),
      streak: placed(mount, 0.28, 0.56, { dy: 6, scale: 0.8 }),
      card: placed(mount, 0.24, 0.72, { dy: 26, scale: 0.94 }),
      tabs: placed(mount, 0.52, 0.94, { dy: 18 }),
    }),
    [mount],
  );
  useEffect(
    () =>
      whenEntranceReleased(() => {
        if (entered.current) return;
        entered.current = true;
        if (!placing) return;
        placedOnce = true;
        mount.setValue(0);
        Animated.timing(mount, { toValue: 1, duration: PLACE_MS, delay: PLACE_DELAY_MS, easing: curve.linear, useNativeDriver: true }).start();
      }),
    [mount, placing],
  );

  // Opens on the tab the player left from: Home unmounts behind every other
  // screen, so a trip to Your games from the You tab used to land on Play.
  const [page, setPage] = useState(rememberedPage);
  useEffect(() => {
    rememberedPage = page;
  }, [page]);
  // The page in view is built with Home; the three beside it just after
  // Home has arrived (or the moment a swipe starts), so coming back to
  // Home builds one page under its fade instead of four.
  const [pagesReady, setPagesReady] = useState(false);
  useEffect(() => {
    // After the flowers have grown in: built under their spring, the pages
    // cost it a frame or two.
    const timer = setTimeout(() => setPagesReady(true), placing ? PLACE_DELAY_MS + PLACE_MS : 2000);
    return () => clearTimeout(timer);
  }, [placing]);
  const showPage = (i: number): boolean => pagesReady || i === page;
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
  // Remembered from the last visit at this size: coming back, the
  // backdrop is built with Home in its first draw, rather than a beat
  // later once the card has been measured again (its canvases arriving
  // late held up the way in).
  const remembered = lastCardSpot && lastCardSpot.width === width && lastCardSpot.height === height ? lastCardSpot : null;
  const [stageY, setStageY] = useState<number | null>(remembered?.stageY ?? null);
  const [carouselY, setCarouselY] = useState<number | null>(remembered?.carouselY ?? null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    setStageY(e.nativeEvent.layout.y);
  }, []);
  const onCarouselLayout = useCallback(
    (e: LayoutChangeEvent) => setCarouselY(e.nativeEvent.layout.y),
    [],
  );
  useEffect(() => {
    if (stageY !== null && carouselY !== null) lastCardSpot = { width, height, stageY, carouselY };
  }, [stageY, carouselY, width, height]);
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

  // Pages with something to *act on* wear a dot, so it is seen before the
  // swipe - and only then. A dot that was up nearly all day (any unplayed
  // Daily, any unplayed Grand) stopped meaning anything. So: coins to
  // claim, a streak the Daily is holding up, a Daily in its last hours,
  // and a Grand on its last day.
  const now = new Date();
  const hoursLeftToday = (nextDayStart(now) - now.getTime()) / 3600000;
  const waiting: Partial<Record<(typeof PAGES)[number], boolean>> = {
    today: errandsWaiting > 0 || (!dailyCompletedToday && (dailyStreak > 0 || hoursLeftToday < 4)),
    grand: !grandDone && grand.daysLeft <= 1,
    you: chaptersWaiting > 0 || pending.length > 0 || stampsWaiting > 0,
  };

  return (
    // Home is a fixed composition (a masthead, cards of one height paged
    // sideways, a tab bar): its words keep to the usual cap even with
    // Larger Text on, which would only push them out of their cards.
    <FixedTextCap.Provider value={MAX_TEXT_SCALE}>
    <View style={styles.container}>
      {/* Drawn once the card's position is known - the whole composition
          is built around it (see \`AlmanacBackdrop\`). Fades in with the
          page's own entrance rather than popping in a frame late. */}
      {cardRect && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: placing ? place.backdrop : mount }]}
          pointerEvents="none"
        >
          <AlmanacBackdrop width={width} height={height} card={cardRect} gentle={!placing} />
        </Animated.View>
      )}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={onOpenSettings}
        hitSlop={8}
        containerStyle={
          [styles.settingsButton, { top: insets.top + theme.spacing.sm }, placing && place.gear] as never
        }
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
        containerStyle={[styles.settingsButton, styles.trophyButton, { top: insets.top + theme.spacing.sm }, placing && place.trophy] as never}
      >
        <TrophyGlyph size={20} />
      </PressableScale>

      <Animated.View
        style={[
          styles.masthead,
          { paddingTop: insets.top + theme.spacing.md },
        ]}
      >
        <View style={styles.mastheadRow}>
          {/* First the mark, dropped into the header the way the launch
              tile has just lifted out of the middle; then the name. */}
          <Animated.View style={placing && place.mark}>
            <TesseraMark size={34} />
          </Animated.View>
          <Animated.View style={placing && place.name}>
            <Text style={styles.wordmark}>TESSELLATUM</Text>
          </Animated.View>
        </View>
        <View style={styles.rule}>
          <Animated.View style={[styles.ruleLine, placing && place.rule]} />
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
            {/* Two keys, nothing more: the shop with what you have to spend
                in it, and the streak. (Insight lives on the play screens,
                where it is used.) */}
            <Animated.View style={placing && place.shop}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Shop. You have ${coins} coins.`}
              onPress={onOpenShop}
              hitSlop={8}
              scaleTo={1}
              holdMs={motion.beat.pressHold}
              style={({ pressed }) => [styles.statusKey, pressed && sunkKey(2.5)]}
            >
              <View style={[styles.statusWell, styles.statusWellGold]}>
                <ShopBag />
              </View>
              <CoinBalance coins={coins} track="home" delay={450} figure={styles.statusText} />
              {progress.luckyCharges > 0 && <Text style={styles.purseCharm}>{'\u00D72'}</Text>}
              {PURCHASES_ENABLED && (
                <View style={styles.pursePlus}>
                  <Text style={styles.pursePlusText}>+</Text>
                </View>
              )}
              {setsReady > 0 && <View style={[styles.statusDot, styles.statusBadge]} accessibilityLabel="A set bonus is ready in the shop" />}
            </PressableScale>
            </Animated.View>
            <Animated.View style={placing && place.streak}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={dailyCompletedToday ? `${dailyStreak} day streak` : `${dailyStreak} day streak. Play today's Daily to ${dailyStreak > 0 ? 'keep it' : 'start one'}.`}
              onPress={openDaily}
              hitSlop={8}
              scaleTo={1}
              holdMs={motion.beat.pressHold}
              style={({ pressed }) => [styles.statusKey, pressed && sunkKey(2.5)]}
            >
              <View style={[styles.statusWell, !dailyCompletedToday && styles.statusWellWarm]}>
                <Icon name="sun" size={14} color={dailyCompletedToday ? theme.colors.textSecondary : theme.colors.secondary} weight={1.6} />
              </View>
              <Text style={styles.statusText} maxFontSizeMultiplier={FIGURE_SCALE}>
                {dailyStreak}
                <Text style={styles.statusUnit}>{dailyStreak === 1 ? ' day' : ' days'}</Text>
              </Text>
              {/* Today's Daily still to play: a dot on the key's corner,
                  not in its line, so the sun and the count sit centred. */}
              {!dailyCompletedToday && <View style={[styles.statusDot, styles.statusBadge]} />}
            </PressableScale>
            </Animated.View>
          </View>
        </View>
      </Animated.View>

      {/* Carousel and dots are centred together in whatever is left, so the
          dots sit directly under the card instead of being pinned to the
          bottom of the screen with a field of paper between them. */}
      <Animated.View
        style={[styles.stage, placing && place.card]}
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
            onScrollBeginDrag={() => setPagesReady(true)}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {/* --- Continue ------------------------------------------------ */}
            <View style={[styles.page, { width }]}>
              {showPage(0) && (
              <Animated.View style={[styles.pageInner, pageMotion(0)]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${
                  levelPoint.allDone ? 'Replay' : resuming ? 'Resume, half played' : 'Continue'
                }: ${gameDisplayName(entry.kind)}, ${
                  entry.extreme
                    ? 'an extreme challenge, the hardest kind'
                    : entry.challenge
                      ? 'the challenge of this set, hard'
                      : entry.difficulty
                }${entry.golden && !levelPoint.allDone ? ', golden: triple coins' : ''}, Level ${levelPoint.levelNumber}, puzzle ${
                  levelPoint.batchPosition
                } of ${levelPoint.batchSize}`}
                onPress={openEntry}
                scaleTo={1}
                unstable_pressDelay={110}
                holdMs={motion.beat.cardPressHold}
                style={[styles.card,
                  { height: cardHeight },
                  entry.golden && !levelPoint.allDone && styles.cardGolden]}
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
                      Level {levelPoint.levelNumber}
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
                    {!levelPoint.allDone && canSwap && (
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={`Swap this puzzle for another game's, for ${SWAP_PRICE} coins`}
                        onPress={swap}
                        hitSlop={8}
                        containerStyle={styles.swapCorner}
                        style={({ pressed }) => [styles.swap, pressed && sunkKey(3)]}
                      >
                        {swapNote === 'done' ? (
                          <Icon name="check" size={14} color={theme.colors.success} weight={2.2} />
                        ) : swapNote === 'short' ? (
                          <Text style={[styles.swapText, styles.swapShort]}>{`Need ${SWAP_PRICE}`}</Text>
                        ) : (
                          <>
                            <Icon name="swap" size={13} color={theme.colors.textSecondary} />
                            <CoinGlyph size={11} />
                            <Text style={styles.swapText}>{SWAP_PRICE}</Text>
                          </>
                        )}
                      </PressableScale>
                    )}
                  </View>
                  {/* The game itself, as the game screen's own header names
                    it: boards carry no made-up titles of their own. */}
                  <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {gameDisplayName(entry.kind)}
                  </Text>
                  {/* A debut's "New game" chip already says it is new: a line
                      here only when there is a lesson first, worth knowing. */}
                  {debut && lessonFirst && <Text style={styles.heroMeta}>Starts with a short lesson.</Text>}

                  {/* The middle of every card is a flexible block holding real
                    content, centred. Slack from a tall screen spreads around
                    it instead of pooling into the two hard gaps a
                    `space-between` skeleton produced. */}
                  <View style={styles.playWell}>

                    {/* The games this level is actually made of. The card
                      already said "Puzzle 3 of 4" - a number that says how far
                      along you are but nothing about what is coming. These say
                      what the rest of the set is, named, with a finished one
                      filled and the ones ahead faded: a preview, not a
                      mystery. */}
                    {/* A set of four sits in one row; six and eight in two
                        equal rows, a little smaller and without names - the
                        emblems say which game, and the card keeps its size. */}
                    {progress.currentBatch && (
                    <View style={[styles.setTray, { backgroundColor: mix(theme.colors.surface, accent, 0.045), borderColor: mix(theme.colors.border, accent, 0.1) }]}>
                    <View style={styles.setTrayBody}>
                      <SetRoute puzzles={progress.currentBatch.puzzles} completed={progress.currentBatch.completedPuzzleIds} played={played} debut={debut} ground={mix(theme.colors.surface, accent, 0.045)} results={progress.levels} />
                    </View>
                    {/* The tray's foot: how far through the set, and what
                      finishing it pays - where the route is leading. */}
                    <View style={styles.setTrayFoot}>
                      <Text style={styles.setTrayCount} maxFontSizeMultiplier={1.2}>
                        {`${progress.currentBatch.completedPuzzleIds.length} of ${progress.currentBatch.puzzles.length} done`}
                      </Text>
                      <View style={styles.setTrayPrize}>
                        <Text style={styles.setTrayCount} maxFontSizeMultiplier={1.2}>Set bonus</Text>
                        <CoinGlyph size={12} />
                        <Text style={styles.setTrayPrizeText} maxFontSizeMultiplier={1.2}>{`+${SET_BONUS}`}</Text>
                      </View>
                    </View>
                    </View>
                    )}

                  </View>

                  {/* The foot: what the set is leading to, and the way in.
                    With no game still to come, the verb takes the room. */}
                  <View style={styles.heroFoot}>
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
                    {!arriving && (
                      <Text style={styles.verb}>{levelPoint.allDone ? 'Replay' : resuming ? 'Resume' : 'Continue'}</Text>
                    )}
                    <PlayDisc />
                  </View>
                </>
              </PressableScale>
              </Animated.View>
              )}
            </View>

            {/* --- Today -------------------------------------------------- */}
            {/* The Daily and the day's errands on one page: everything that
              resets at midnight, together. The Daily is the well at the
              top (tap it to play); the errands sit under it. */}
            <View style={[styles.page, { width }]}>
              {showPage(1) && (
              <Animated.View style={[styles.pageInner, pageMotion(1)]}>
              <View style={[styles.card, { height: cardHeight }]}>
                <View pointerEvents="none" style={styles.cardKeyline} />
                <View style={styles.cardHead}>
                  <Text style={[styles.eyebrowMuted, { color: accentColorForKind(daily.kind) }]}>Today</Text>
                  <Text style={[styles.badge, errandsWaiting > 0 || !dailyCompletedToday ? styles.badgeLive : styles.badgeDone]}>
                    {errandsWaiting > 0 ? `${errandsWaiting} to claim` : dailyCompletedToday ? 'Daily solved' : 'Daily waiting'}
                  </Text>
                </View>
                <View style={[styles.headingRule, { backgroundColor: accentColorForKind(daily.kind) }]} />

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Daily puzzle: ${daily.name}${dailyCompletedToday ? ', already solved today' : ''}${dailyStreak > 0 ? `, ${dailyStreak} day streak` : ''}. ${dailyCompletedToday ? 'Replay' : 'Play'}`}
                  onPress={openDaily}
                  scaleTo={1}
                unstable_pressDelay={110}
                holdMs={motion.beat.cardPressHold}
                  style={[styles.todayDaily, tight && styles.todayDailyTight]}
                >
                  <View style={styles.todayDailyRow}>
                    <View style={[styles.cardEmblem, { borderColor: accentColorForKind(daily.kind) }]}>
                      <GameEmblem kind={daily.kind} size={44} raised />
                    </View>
                    <View style={styles.dailyText}>
                      <Text style={[styles.todayKicker, { color: accentColorForKind(daily.kind) }]}>The Daily</Text>
                      <Text style={styles.todayTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {daily.name}
                      </Text>
                      <Text style={styles.dailyChapter} numberOfLines={1}>
                        {tight ? (dailyStreak > 0 ? `${daily.chapter} · ${dailyStreak}-day streak` : daily.chapter) : daily.chapter}
                      </Text>
                    </View>
                    {/* Solved: a tick, not a play button - today's is done. */}
                    {dailyCompletedToday ? (
                      <PlayDisc small done />
                    ) : (
                      <PlayDisc small />
                    )}
                  </View>
                  {/* The week of Dailies (tap for the whole calendar), and in
                      one line beside it the streak or today's time. */}
                  {!tight && (
                  <View style={styles.todayStreak}>
                    <WeekStrip days={dailyDays} todayKey={todayKey} onPress={() => setCalendarOpen(true)} />
                    <View style={styles.todayStreakSide}>
                      <Text style={styles.todayStreakCount} numberOfLines={1}>
                        {dailyStreak > 0 ? `${dailyStreak}-day streak` : dailyCompletedToday ? 'Streak started' : 'Start a streak'}
                      </Text>
                      <Text style={styles.todayStatus} numberOfLines={1}>
                        {dailyCompletedToday
                          ? progress.dailyTimes[todayKey]
                            ? `Solved in ${formatDuration(progress.dailyTimes[todayKey])}`
                            : 'Solved today'
                          : dailyStreak > 0
                            ? 'Play to keep it'
                            : 'Solve today’s Daily'}
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
              )}
            </View>

            {/* --- Weekly Grand -------------------------------------------- */}
            <View style={[styles.page, { width }]}>
              {showPage(2) && (
              <Animated.View style={[styles.pageInner, pageMotion(2)]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Weekly Grand: ${grand.name}, a ${grand.tier} ${gameDisplayName(grand.kind)} board. ${
                  grandDone ? 'Solved this week.' : `${grand.daysLeft} day${grand.daysLeft === 1 ? '' : 's'} left. Pays ${GRAND_COINS} coins.`
                }${grandNextItem ? ` ${grandNext!.at - grandsSolved} more to win ${grandNextItem.name}.` : ''}`}
                onPress={openGrand}
                scaleTo={1}
                unstable_pressDelay={110}
                holdMs={motion.beat.cardPressHold}
                style={[styles.card, styles.cardGrand, { height: cardHeight }]}
              >
                <View pointerEvents="none" style={[styles.cardKeyline, styles.cardKeylineGold]} />
                <View style={styles.cardHead}>
                  <Text style={[styles.eyebrowMuted, styles.grandEyebrow]}>Weekly Grand</Text>
                  <Text style={[styles.badge, grandDone ? styles.badgeDone : styles.badgeLive]}>
                    {grandDone ? 'Solved' : grand.daysLeft === 1 ? 'Last day' : `${grand.daysLeft} days left`}
                  </Text>
                </View>
                <View style={[styles.headingRule, styles.grandRule]} />
                <View style={styles.dailyRow}>
                  <View style={[styles.cardEmblem, styles.grandEmblem]}>
                    <GameEmblem kind={grand.kind} size={50} raised />
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
                          {/* Named, and under the one being played for, how
                              far off it is - said where it is pointed at. */}
                          {item && (
                            <Text style={[styles.grandPrizeName, !won && !next && styles.grandPrizeNameAhead]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                              {item.name}
                            </Text>
                          )}
                          <Text style={[styles.grandPrizeAt, won && styles.grandPrizeWon, next && styles.grandPrizeNext]}>
                            {won ? 'Won' : next ? `${reward.at - grandsSolved} more` : `${reward.at} ${reward.at === 1 ? 'Grand' : 'Grands'}`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {!grandNextItem && <Text style={styles.dailyStreakLabel}>Every prize won</Text>}
                </View>

                <View style={styles.heroFoot}>
                  <Text style={styles.verb}>{grandDone ? 'Replay' : 'Play'}</Text>
                  <PlayDisc />
                </View>
              </PressableScale>
              </Animated.View>
              )}
            </View>

            {/* --- You ---------------------------------------------------- */}
            {/* Rank, chapter and the record on one page - what used to be
              three (Rank, Puzzle IQ, Progress). Each figure opens where its
              detail lives: the almanac, the ledger, the achievements. */}
            <View style={[styles.page, { width }]}>
              {showPage(3) && (
              <Animated.View style={[styles.pageInner, pageMotion(3)]}>
              <View style={[styles.card, { height: cardHeight }]}>
                <View pointerEvents="none" style={styles.cardKeyline} />
                <View style={styles.cardHead}>
                  <Text style={[styles.eyebrowMuted, { color: theme.colors.accentText }]}>You</Text>
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
                holdMs={motion.beat.pressHold}
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
                    holdMs={motion.beat.pressHold}
                    containerStyle={styles.wellCentered}
                  >
                    <View style={styles.shelfHead}>
                      <Text style={styles.setLabel}>Your games</Text>
                      <Text style={styles.shelfCount}>{`${roster.length} of ${INTRO_ORDER.length} · ${solved} solved`}</Text>
                    </View>
                    <EmblemShelf kinds={INTRO_ORDER} held={roster} />
                  </PressableScale>
                )}

                {/* Where the rest lives: a figure each, set large, over a
                    small label - read at a glance, and never cut short. */}
                <View style={styles.youLinks}>
                  {[
                    ...(tight ? [{ label: 'Games', value: `${roster.length}/${ROTATION.length}`, a11y: `Open your games. ${roster.length} of ${ROTATION.length}, ${solved} solved`, onPress: onOpenCollection, dot: false }] : []),
                    { label: 'Badges', value: `${earned}/${ACHIEVEMENTS.length}`, a11y: `Open achievements. ${earned} of ${ACHIEVEMENTS.length}`, onPress: onOpenAchievements, dot: false },
                    // Stamps waiting never change the tile (a different
                    // label shrank to fit and set it apart from the other
                    // two): they wear a count on its corner instead.
                    { label: 'Puzzle IQ', value: aptitude.index !== null ? `${aptitude.index}` : '\u2013', a11y: `Open the ledger. ${stampsWaiting > 0 ? `${stampsWaiting} stamp${stampsWaiting === 1 ? '' : 's'} to claim. ` : ''}${iqLabel}`, onPress: onOpenLedger, dot: false, badge: stampsWaiting },
                    { label: 'Top times', value: null, a11y: 'Open the leaderboards', onPress: onOpenLeaderboard, dot: false },
                  ].map(link => (
                    <PressableScale key={link.label} accessibilityRole="button" accessibilityLabel={link.a11y} onPress={link.onPress} scaleTo={1} holdMs={motion.beat.pressHold} containerStyle={[styles.youLinkWrap, !tight && styles.youLinkThird]} style={({ pressed }) => [styles.youLink, pressed && sunkKey(3)]}>
                      <View style={styles.youLinkHead}>
                        {link.value !== null ? (
                          <Text style={styles.youLinkValue} numberOfLines={1}>
                            {link.value}
                          </Text>
                        ) : (
                          <View style={styles.youLinkGlyph}>
                            <TrophyGlyph size={22} />
                          </View>
                        )}
                        {link.dot && <View style={styles.youLinkDot} />}
                      </View>
                      {(link.badge ?? 0) > 0 && (
                        <View style={styles.youLinkBadge} accessibilityElementsHidden importantForAccessibility="no">
                          <Text style={styles.youLinkBadgeText} maxFontSizeMultiplier={FIGURE_SCALE}>{link.badge}</Text>
                        </View>
                      )}
                      <Text style={styles.youLinkLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        {link.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
              </Animated.View>
              )}
            </View>
          </Animated.ScrollView>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.dots,
          { paddingBottom: insets.bottom + theme.spacing.sm },
          placing && place.tabs,
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
                <Text style={styles.tabText} maxFontSizeMultiplier={MAX_TEXT_SCALE}>{PAGE_LABELS[name]}</Text>
                {/* The light label over the pill, faded in by the same
                    native offset, so the colour change glides too. */}
                <Animated.Text maxFontSizeMultiplier={MAX_TEXT_SCALE} style={[styles.tabText, styles.tabTextOn, { opacity: near }]}>{PAGE_LABELS[name]}</Animated.Text>
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
      {arrival && (
        <GameArrival
          kind={arrival}
          onPlay={() => {
            markArrivalSeen(arrival);
            setArrival(null);
            // Its first board is what comes next when it heads the set.
            if (entry.kind === arrival) openEntry();
          }}
          onLater={() => {
            markArrivalSeen(arrival);
            setArrival(null);
          }}
        />
      )}
    </View>
    </FixedTextCap.Provider>
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

/** How far a play disc's lip shows below it. */
const PLAY_LIP = 4;

/** The flowers' tone exactly as the page art draws it (toned toward the
 * ground by night) - so the play buttons always match the garden worn. */
function useBloomTone(): string {
  const garden = useEquipped('garden');
  return nightTone(garden.colors[0] ?? theme.colors.secondary);
}

/** A play button: a disc in the garden's colour, standing on its lip. A
 * solved one is a green tick instead. */
function PlayDisc({ small = false, done = false }: { small?: boolean; done?: boolean }): React.JSX.Element {
  const bloom = useBloomTone();
  const face = done ? theme.colors.success : bloom;
  // Pressing the card presses the disc: its face sinks onto its lip.
  const depth = useContext(PressDepth);
  const sink = depth ? { transform: [{ translateY: depth.interpolate({ inputRange: [0, 1], outputRange: [0, PLAY_LIP - 0.5] }) }] } : null;
  return (
    <View style={styles.playStand}>
      <View style={[styles.play, small && styles.playSmall, styles.playLip, { backgroundColor: shade(face, 0.68) }]} />
      <Animated.View style={[styles.play, small && styles.playSmall, { backgroundColor: face }, sink]}>
        {done ? <Icon name="check" size={20} color="#FFFBF3" weight={2.4} /> : <View style={[styles.playTri, small && styles.playTriSmall]} />}
      </Animated.View>
    </View>
  );
}

/**
 * Every game, six to a row, the ones not yet held faded: drawn in one
 * canvas. Twelve separate emblems were twelve GPU surfaces, and on Android
 * each is recomposed on every frame of any motion on the page.
 */
function EmblemShelf({ kinds, held }: { kinds: ReadonlyArray<GameKind>; held: ReadonlyArray<GameKind> }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const size = 30;
  const perRow = 6;
  const rowH = size + emblemLip(size);
  const rows = Math.ceil(kinds.length / perRow);
  const height = rows * rowH + (rows - 1) * 10;
  const cell = width / perRow;
  return (
    <View style={{ height }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          {kinds.map((kind, i) => (
            <GameEmblemGlyph key={kind} kind={kind} size={size} raised x={(i % perRow) * cell + (cell - size) / 2} y={Math.floor(i / perRow) * (rowH + 10)} opacity={held.includes(kind) ? 1 : 0.22} />
          ))}
        </Canvas>
      )}
    </View>
  );
}

/** The set's route, laid out as a path: how many tiles a row holds, their size. */
const ROUTE_TILE = 42;
/** Two rows (six or eight games) a little smaller, so the card keeps its height. */
const ROUTE_TILE_SMALL = 32;
/** Under each slot: its name (or stars), and the gap between rows. */
const ROUTE_LABEL_H = 18;
const ROUTE_ROW_GAP = 8;

/**
 * The games this level is made of, in order, spread across the tray.
 * Finished games stand in full colour with a seal and their stars; the
 * one you are on now is a size up, ringed in its colour and named. The
 * ones ahead lie flat and quiet, numbered. Four sit in one row; six and
 * eight in two even rows.
 */
function SetRoute({
  puzzles,
  completed,
  played,
  debut,
  ground,
  results,
}: {
  puzzles: ReadonlyArray<{ kind: GameKind; puzzleId: string; golden?: boolean; challenge?: boolean }>;
  completed: ReadonlyArray<string>;
  played: ReadonlySet<GameKind>;
  debut: boolean;
  /** The tray's colour: each slot is pressed into it, a shade deeper. */
  ground: string;
  /** Best result per puzzle: a finished one shows its stars. */
  results: Readonly<Record<string, { stars: number } | undefined>>;
}): React.JSX.Element {
  const perRow = puzzles.length <= 4 ? puzzles.length : Math.ceil(puzzles.length / 2);
  const tile = puzzles.length > perRow ? ROUTE_TILE_SMALL : ROUTE_TILE;
  const nowSize = tile + 4;
  const slot = nowSize + (puzzles.length > perRow ? 10 : 12);
  const well = mix(ground, theme.colors.textPrimary, 0.05);
  const wellEdge = mix(ground, theme.colors.textPrimary, 0.13);
  const rows: Array<typeof puzzles> = [];
  for (let at = 0; at < puzzles.length; at += perRow) rows.push(puzzles.slice(at, at + perRow));
  const now = completed.length;
  // The slots and emblems are drawn in one canvas under the labels and
  // badges: eight emblems were eight GPU surfaces, and on Android every
  // one is recomposed on each frame of any motion on the page. Placed
  // exactly where the rows' even spacing puts each slot.
  const [width, setWidth] = useState(0);
  const rowH = slot + ROUTE_LABEL_H;
  const height = rows.length * rowH + (rows.length - 1) * ROUTE_ROW_GAP;
  return (
    <View style={styles.route} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Canvas style={[StyleSheet.absoluteFill, { height }]} pointerEvents="none">
          {rows.map((row, r) => {
            const space = (width - row.length * slot) / (row.length + 1);
            return row.map((item, k) => {
              const i = r * perRow + k;
              const done = completed.includes(item.puzzleId);
              const current = !done && i === now;
              const x = space * (k + 1) + slot * k;
              const y = r * (rowH + ROUTE_ROW_GAP);
              const size = current ? nowSize : tile;
              const lip = done || current ? emblemLip(size) : 0;
              const radius = slot * 0.3;
              return (
                <React.Fragment key={`${item.puzzleId}-${i}`}>
                  {/* Every game has its own slot pressed into the tray: a
                    shade deeper, its top edge deeper still, so it reads as
                    cut in. The one you are on is ringed in its colour. */}
                  {current ? (
                    <>
                      <RoundedRect x={x} y={y} width={slot} height={slot} r={radius} color={theme.colors.surfaceHi} />
                      <RoundedRect x={x + 1} y={y + 1} width={slot - 2} height={slot - 2} r={radius - 1} color={accentColorForKind(item.kind)} style="stroke" strokeWidth={2} />
                    </>
                  ) : (
                    <>
                      <RoundedRect x={x} y={y} width={slot} height={slot} r={radius} color={wellEdge} />
                      <RoundedRect x={x} y={y + 2} width={slot} height={slot - 2} r={radius} color={well} />
                    </>
                  )}
                  {/* Placed, or lying flat in its slot still to come. */}
                  <GameEmblemGlyph kind={item.kind} size={size} raised={done || current} x={x + (slot - size) / 2} y={y + (slot - size - lip) / 2 - (current ? 2 : 0)} opacity={done || current ? 1 : 0.6} />
                </React.Fragment>
              );
            });
          })}
        </Canvas>
      )}
      {rows.map((row, r) => {
        const start = r * perRow;
        return (
          <View key={r} style={[styles.routeRow, r > 0 && styles.routeRowNext]}>
            {row.map((item, k) => {
              const i = start + k;
              const done = completed.includes(item.puzzleId);
              const current = !done && i === now;
              const tint = accentColorForKind(item.kind);
              const fresh = !done && !played.has(item.kind) && puzzles.findIndex(other => other.kind === item.kind) === i && !(current && debut);
              return (
                <View key={`${item.puzzleId}-${i}`} style={[styles.routeStop, { width: slot }]}>
                  <View style={[styles.routeSlot, { width: slot, height: slot }]}>
                    {done && (
                      <View style={[styles.setCheck, styles.routeSeal, { backgroundColor: tint }]}>
                        <Icon name="check" size={9} color={theme.colors.surfaceHi} />
                      </View>
                    )}
                    {fresh && (
                      <View style={[styles.setNew, styles.routeNew, { backgroundColor: tint }]} accessibilityLabel="new game">
                        <Text style={styles.setNewText}>New</Text>
                      </View>
                    )}
                    {item.golden && !done && (
                      <View style={styles.routeGolden} accessibilityLabel="golden puzzle">
                        <CoinGlyph size={13} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.routeLabel, { width: slot + 16 }, current && [styles.routeLabelNow, { color: readableOn(tint, theme.colors.surface, theme.colors.textPrimary) }], !current && item.challenge && styles.routeLabelHard]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.2}
                  >
                    {done && (results[item.puzzleId]?.stars ?? 0) > 0 ? '' : item.challenge && !current ? 'Hard' : gameShortName(item.kind)}
                  </Text>
                  {/* A finished game shows how it went: its stars, small,
                    where its number was. */}
                  {done && (results[item.puzzleId]?.stars ?? 0) > 0 && (
                    <View style={[styles.routeStars, { width: slot + 16 }]} pointerEvents="none">
                      <StarRow earned={results[item.puzzleId]!.stars} size={9} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  route: { alignSelf: 'stretch' },
  /** Spread across the tray's whole width, each game in an even share. */
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly' },
  routeRowNext: { marginTop: ROUTE_ROW_GAP },
  routeStop: { alignItems: 'center' },
  routeStars: { position: 'absolute', bottom: 0, height: 15, alignItems: 'center', justifyContent: 'center' },
  routeSlot: { alignItems: 'center', justifyContent: 'center' },
  routeSeal: { right: 2, bottom: 4 },
  routeNew: { top: -2, left: -2 },
  routeGolden: { position: 'absolute', top: 0, right: 0 },
  routeLabel: { marginTop: 3, height: 15, textAlign: 'center', fontFamily: theme.typography.families.ui, fontSize: 11, lineHeight: 15, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  routeLabelNow: { fontWeight: theme.typography.weights.bold },
  routeLabelHard: { color: theme.colors.accent, fontWeight: theme.typography.weights.bold },
  playWell: { flex: 1, justifyContent: 'center', paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  setTray: { alignSelf: 'stretch', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  setTrayBody: { alignItems: 'center', paddingTop: theme.spacing.sm + 4, paddingBottom: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.xs },
  setTrayFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingTop: 2, paddingBottom: 10 },
  setTrayCount: { fontSize: 12, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  setTrayPrize: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  setTrayPrizeText: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: 13, fontWeight: theme.typography.weights.bold, color: theme.colors.gold },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  verb: { flex: 1, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  trophyButton: { right: undefined, left: theme.spacing.lg },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.colors.borderStrong },
  pursePlus: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.goldFill, alignItems: 'center', justifyContent: 'center' },
  pursePlusText: { color: theme.colors.onGold, fontSize: 13, lineHeight: 15, fontWeight: theme.typography.weights.bold },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /** A small key on its lip, like every pressable on Home. */
  statusKey: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 36,
    minWidth: 96,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderBottomWidth: 2.5,
    borderColor: theme.colors.border,
    borderBottomColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceHi,
  },
  /** The key's icon in its own round well, so both keys open the same way. */
  statusWell: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  statusWellGold: { backgroundColor: `${theme.colors.gold}40` },
  statusWellWarm: { backgroundColor: `${theme.colors.secondary}2E` },
  statusUnit: { fontFamily: theme.typography.families.ui, fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.medium, color: theme.colors.textTertiary },
  // The same setting as the coin count beside it, so the two figures share a line.
  statusText: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: 15, lineHeight: 19, paddingTop: 3, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  statusBadge: { position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: theme.colors.background },
  streakNudgeDone: { borderColor: theme.colors.border },
  streakNudgeTextDone: { color: theme.colors.textSecondary },
  todayDaily: {
    marginTop: theme.spacing.md,
  },
  todayDailyRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  todayKicker: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.3, textTransform: 'uppercase', color: theme.colors.secondary },
  todayTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, marginTop: 2 },
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
  youLinkThird: { width: '30%', flexBasis: 'auto' },
  shelfHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  shelfCount: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  cardEmblem: { padding: 4, borderRadius: 16, borderWidth: 2 },
  grandEmblem: { borderColor: theme.colors.goldRim },
  grandRule: { backgroundColor: theme.colors.gold },
  youChapter: { marginTop: theme.spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm },
  youChapterLeft: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  youFigures: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' },
  youValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  youLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 'auto' },
  youLinkWrap: { width: '48.5%', flexGrow: 1 },
  youLink: { paddingTop: 10, paddingBottom: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: theme.colors.background, borderWidth: 1, borderBottomWidth: 3, borderColor: theme.colors.border, borderBottomColor: theme.colors.borderStrong, alignItems: 'center', gap: 3 },
  youLinkHead: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26 },
  youLinkValue: { fontFamily: theme.typography.families.figures, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: 22, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  youLinkGlyph: { height: 26, justifyContent: 'center' },
  youLinkLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.textTertiary },
  youLinkBadge: { position: 'absolute', top: -7, right: -7, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.goldFill, borderWidth: 2, borderColor: theme.colors.surface },
  youLinkBadgeText: { fontFamily: theme.typography.families.figures, fontSize: 11, lineHeight: 13, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold },
  youLinkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  pursePatron: { width: 9, height: 9, borderRadius: 2, marginRight: 6, transform: [{ rotate: '45deg' }], backgroundColor: theme.colors.gold, borderWidth: 1.5, borderColor: theme.colors.goldRim },
  purseDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 4, backgroundColor: theme.colors.secondary },
  purse: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 4, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.goldRim, backgroundColor: theme.colors.surface },
  purseCharm: {
    paddingHorizontal: 4,
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
  swapCorner: { marginLeft: 'auto' },
  swapBeside: { justifyContent: 'center', alignSelf: 'stretch', gap: 4, paddingHorizontal: 12, borderRadius: 14 },
  // A key standing on its lip, like the cards: something to press.
  swap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderBottomWidth: 3, borderColor: theme.colors.border, borderBottomColor: theme.colors.borderStrong, backgroundColor: theme.colors.surfaceHi },
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
    // A ledge along the bottom: the card stands on the page as a thick
    // printed board does - depth by its edge, not by a gradient.
    borderBottomWidth: 4,
    borderBottomColor: theme.colors.borderStrong,
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
  /** The Grand's card in one gold family: a fine gold edge, its ledge a
   * deeper gold (its shadow side), and a gold keyline inside. */
  cardGrand: {
    borderColor: theme.colors.goldRim,
    borderWidth: 1,
    borderBottomWidth: 4,
    borderBottomColor: shade(theme.colors.goldRim, 0.68),
  },
  cardKeylineGold: { borderColor: theme.colors.goldRim, opacity: 0.45 },
  grandEyebrow: { color: theme.colors.gold },
  grandPays: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grandCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grandCoinsText: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  grandShelf: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  grandPrize: { alignItems: 'center', gap: 2, width: 66 },
  grandPrizeName: { marginTop: 4, maxWidth: 66, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  grandPrizeNameAhead: { color: theme.colors.textTertiary },
  grandPrizeNext: { color: theme.colors.accentText, fontWeight: theme.typography.weights.bold },
  grandPlate: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: theme.colors.border,
    borderBottomColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grandPlateNext: { borderColor: theme.colors.goldRim, borderWidth: 2, borderBottomWidth: 3, borderBottomColor: shade(theme.colors.goldRim, 0.68), backgroundColor: theme.colors.surfaceHi },
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
  sectionLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.textTertiary, marginBottom: 6 },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Every card's header: small spaced capitals in the card's own colour,
   * the status opposite in the same hand - one header for all four. */
  eyebrow: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, letterSpacing: 1.3, textTransform: 'uppercase', color: theme.colors.secondary, flexShrink: 1 },
  heroChip: { marginLeft: 8 },
  eyebrowMuted: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, letterSpacing: 1.3, textTransform: 'uppercase', color: theme.colors.textSecondary },
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
  setRing: { padding: 4, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  setCheck: { position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.surface },
  setPath: { flexDirection: 'row', gap: 3, marginTop: 26, marginHorizontal: 4 },
  setPathSmall: { marginTop: 20, marginHorizontal: 4 },
  setRowNext: { marginTop: 6 },
  setPathDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.borderStrong },
  setPathDotOn: { backgroundColor: theme.colors.textTertiary },
  /** Each game named under its own mark. The marks alone were an
   * identity parade for anyone who had not yet learned them; with the
   * names the row actually answers "what is in this set". */
  setName: { fontSize: theme.typography.sizes.micro, color: theme.colors.textTertiary, marginTop: 4 },
  /** Games still to come, held back so the finished ones read as done. */
  setNameHidden: { opacity: 0 },
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
  next: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: theme.colors.background },
  nextEmblem: { opacity: 0.55 },
  nextBody: { flex: 1, gap: 4 },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nextTitle: { flex: 1, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  nextCount: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  nextTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: theme.colors.border },
  nextFill: { height: 4, borderRadius: 2 },
  newChip: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radii.pill },
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
  /** The disc's lip: the same disc, darker, showing below it - the play
   * button stands on the card the way the card stands on the page. */
  playLip: { position: 'absolute', top: PLAY_LIP },
  playStand: { paddingBottom: PLAY_LIP },
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
    // Light in both schemes: the disc is the flowers' own tone, which by
    // night is a deep one.
    borderLeftColor: '#FFFBF3',
    marginLeft: 4,
  },

  badge: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, letterSpacing: 1, textTransform: 'uppercase' },
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
  figureLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, marginTop: 2 },

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
    padding: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  insightGlyph: { fontSize: 12, color: theme.colors.accent },
  insightChipText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },
}));

/** Memoized: Home re-renders for its own state and its progress, not for
 * every change in the app around it. */
export const HomeScreen = React.memo(HomeScreenImpl);

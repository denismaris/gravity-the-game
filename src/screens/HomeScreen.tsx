import { Canvas, Path, RoundedRect } from '@shopify/react-native-skia';
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
  Share,
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
  buildShareMessage,
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
  buildDailyShare,
  giftFor,
  unclaimedSets,
  gamesPlayed,
  INTRO_ORDER,
  INTRO_SOLVES,
  nextGameToArrive,
  unlockedGames,
} from '../progression';
import { DailyGiftCard } from '../components/DailyGiftCard';
import { getLevelById } from '../game/levels';
import {
  accentColorForKind,
  gameDisplayName,
  GameKind,
  gameShortName,
  getDailyEntry,
  getWeeklyGrand,
  dailyKeyOf,
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

/** A fade/rise that finishes at `endsAt` (a fraction of the shared `mount`
 * driver) - staggering several elements off one Animated.Value instead of
 * timing each separately. */
/** "GOOD EVENING · WED 30 SEP" - the date line under the wordmark. */
function dateLine(now: Date): string {
  const h = now.getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const day = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return `${greeting} · ${day}`;
}

/** The moon's phase, 0 (new) to 1 (the next new), from a known new moon. */
function moonPhase(now: Date): number {
  const synodic = 29.530588853;
  const days = (now.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return (((days / synodic) % 1) + 1) % 1;
}

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

/** A small moon: a lit disc with the shadowed part laid over it. */
function MoonDisc({ phase, size }: { phase: number; size: number }): React.JSX.Element {
  // How much is lit, and from which side (waxing: right).
  const lit = 1 - Math.abs(phase - 0.5) * 2;
  const shadowShift = (phase < 0.5 ? -1 : 1) * size * lit;
  return (
    <View style={[styles.moon, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.moonShadow, { width: size, height: size, borderRadius: size / 2, transform: [{ translateX: shadowShift }] }]} />
    </View>
  );
}

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
  const { progress, ready, markLevelOpened, dailyStreak, dailyCompletedToday, coins, collectRanks, swapPuzzle, claimGift, levelStars } =
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
  // The hero card's own progress bar tracks *this batch* (a handful of
  // puzzles, so it actually fills up and resets at a satisfying pace) - the
  // lifetime total across every game lives on the progress card instead
  // (`solved`/`TOTAL_PUZZLE_COUNT`).
  const batchSolved = progress.currentBatch?.completedPuzzleIds.length ?? 0;
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
  const shareDaily = (): void => {
    const message = buildDailyShare({
      dayKey: todayKey,
      game: gameDisplayName(daily.kind),
      stars: levelStars(daily.puzzleId),
      ms: progress.dailyTimes[todayKey] ?? null,
      streak: dailyStreak,
    });
    Share.share({ message }).catch(() => {});
  };
  const openDaily = (): void =>
    onOpen({ kind: daily.kind, puzzleId: daily.puzzleId });

  // The Weekly Grand - one hard board a week, paying coins and, at a few
  // milestones, a cosmetic the shop does not sell.
  const grand = useMemo(() => getWeeklyGrand(new Date(), progress.retired), [progress.retired]);
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
      useNativeDriver: true, // a scaleX from the left edge, so it runs on the UI thread
    }).start();
  }, [pct, trackFill]);

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
        <Text style={styles.settingsGlyph}>{'⚙︎'}</Text>
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
        {/* The almanac's own date line: a greeting, the day, and the
            moon - it is an almanac, after all. */}
        <View style={styles.dateLine}>
          <MoonDisc phase={moonPhase(new Date())} size={10} />
          <Text style={styles.tagline}>{dateLine(new Date())}</Text>
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
        <View style={styles.streakSlot}>
          <PressableScale accessibilityRole="button" accessibilityLabel={`Shop. You have ${coins} coins.`} onPress={onOpenShop} hitSlop={8}>
            <View style={styles.purse}>
              {/* Says what it is: the way into the shop, not just a number. */}
              <View style={styles.shopTag}>
                <ShopBag />
                <Text style={styles.shopTagText}>Shop</Text>
              </View>
              {progress.patron && <View style={styles.pursePatron} accessible accessibilityLabel="Patron" />}
              <CoinBalance coins={coins} />
              {progress.luckyCharges > 0 && <Text style={styles.purseCharm}>{'\u00D72'}</Text>}
              {PURCHASES_ENABLED && (
                <View style={styles.pursePlus}>
                  <Text style={styles.pursePlusText}>+</Text>
                </View>
              )}
              {setsReady > 0 && <View style={styles.purseDot} accessibilityLabel="A set bonus is ready in the shop" />}
            </View>
          </PressableScale>
          <View style={styles.insightChip} accessible accessibilityLabel={`${progress.insights} Insight`}>
            <Text style={styles.insightGlyph}>{'\u2726'}</Text>
            <Text style={styles.insightChipText}>{progress.insights}</Text>
          </View>
          {dailyStreak > 0 && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={dailyCompletedToday ? `${dailyStreak} day streak` : `${dailyStreak} day streak. Play today's Daily to keep it.`}
              onPress={openDaily}
              hitSlop={6}
              containerStyle={[styles.streakNudge, dailyCompletedToday && styles.streakNudgeDone]}
            >
              <Text style={[styles.streakNudgeText, dailyCompletedToday && styles.streakNudgeTextDone]}>
                {dailyCompletedToday ? `\u2600\uFE0E ${dailyStreak}-day streak` : `${dailyStreak}-day streak · play today`}
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
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {entry.name}
                  </Text>
                  <Text style={styles.heroMeta}>
                    {debut
                      ? `Your first ${entry.chapter} puzzle.${lessonFirst ? ' A short lesson comes first.' : ''}`
                      : `Puzzle ${levelPoint.batchPosition} of ${levelPoint.batchSize} in this set`}
                  </Text>

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
                              {/* A golden puzzle wears a coin, like a seal on
                                the corner of a page. Outside the fade, like
                                the challenge rule: worth seeing coming. */}
                              {!done && !played.has(entryRef.kind) && (
                                <View style={[styles.setNew, { backgroundColor: accentColorForKind(entryRef.kind) }]} accessibilityLabel="new game">
                                  <Text style={styles.setNewText}>NEW</Text>
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
                            width: '100%', transformOrigin: 'left', transform: [{ scaleX: trackFill.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }],
                          },
                        ]}
                      />
                    </View>
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
                            being learned. Ten of those, and it arrives. */}
                          <View style={styles.nextEmblem}>
                            <GameEmblem kind={arriving.kind} size={26} />
                          </View>
                          <View style={styles.nextBody}>
                            <View style={styles.nextHead}>
                              <Text style={styles.nextTitle} numberOfLines={1}>{`Next: ${gameShortName(arriving.kind)}`}</Text>
                              <Text style={styles.nextCount}>{`${arriving.done}/${INTRO_SOLVES}`}</Text>
                            </View>
                            <View style={styles.nextTrack}>
                              <View style={[styles.nextFill, { width: `${(arriving.done / INTRO_SOLVES) * 100}%`, backgroundColor: accentColorForKind(arriving.gate) }]} />
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
                          <View style={styles.swap}>
                            <Text style={[styles.swapText, swapNote === 'short' && styles.swapShort]}>
                              {swapNote === 'short' ? `You need ${SWAP_PRICE} coins` : swapNote === 'done' ? 'Swapped \u2713\uFE0E' : '\u21C4\uFE0E  Swap game'}
                            </Text>
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
            </View>

            {/* --- Today -------------------------------------------------- */}
            {/* The Daily and the day's errands on one page: everything that
              resets at midnight, together. The Daily is the well at the
              top (tap it to play); the errands sit under it. */}
            <View style={[styles.page, { width }]}>
              <View style={[styles.card, { height: cardHeight }]}>
                <View style={styles.cardHead}>
                  <Text style={styles.eyebrowMuted}>Today</Text>
                  <Text style={[styles.badge, errandsWaiting > 0 || !dailyCompletedToday ? styles.badgeLive : styles.badgeDone]}>
                    {errandsWaiting > 0 ? `${errandsWaiting} to claim` : dailyCompletedToday ? 'Daily solved' : 'Daily waiting'}
                  </Text>
                </View>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Daily puzzle: ${daily.name}${dailyCompletedToday ? ', already solved today' : ''}${dailyStreak > 0 ? `, ${dailyStreak} day streak` : ''}. ${dailyCompletedToday ? 'Replay' : 'Play'}`}
                  onPress={openDaily}
                  scaleTo={0.98}
                unstable_pressDelay={110}
                  style={[styles.todayDaily]}
                >
                  <View style={styles.todayDailyRow}>
                    <GameEmblem kind={daily.kind} size={46} />
                    <View style={styles.dailyText}>
                      <Text style={styles.todayKicker}>The Daily</Text>
                      <Text style={styles.todayTitle} numberOfLines={1}>
                        {daily.name}
                      </Text>
                      <Text style={styles.dailyChapter} numberOfLines={1}>
                        {daily.chapter}
                      </Text>
                    </View>
                    {/* Solved: a tick, not a play button - today's is done. */}
                    {dailyCompletedToday ? (
                      <View style={[styles.play, styles.playSmall, styles.playDone]}>
                        <Text style={styles.playDoneGlyph}>{'\u2713\uFE0E'}</Text>
                      </View>
                    ) : (
                      <View style={[styles.play, styles.playSmall]}>
                        <View style={[styles.playTri, styles.playTriSmall]} />
                      </View>
                    )}
                  </View>
                  <View style={styles.todayStreak}>
                    <View style={[styles.streakRow, styles.todayMarks]}>
                      {Array.from({ length: STREAK_MARKS }, (_, i) => (
                        <View key={i} style={[styles.streakMark, i < Math.min(dailyStreak, STREAK_MARKS) && styles.streakMarkLit]} />
                      ))}
                    </View>
                    <Text style={styles.todayStreakCount}>{dailyStreak > 0 ? `${dailyStreak}-day streak` : 'No streak yet'}</Text>
                  </View>
                  <View style={styles.todayStatusRow}>
                  <Text style={[styles.todayStatus, styles.todayStatusText]} numberOfLines={1}>
                    {dailyCompletedToday
                      ? progress.dailyTimes[todayKey]
                        ? `Solved in ${formatDuration(progress.dailyTimes[todayKey])}. A new one tomorrow.`
                        : 'Solved. A new one tomorrow.'
                      : dailyStreak > 0
                        ? 'Play today to keep your streak.'
                        : 'A new puzzle every day.'}
                  </Text>
                  {dailyCompletedToday && (
                    <PressableScale accessibilityRole="button" accessibilityLabel="Share today's Daily result" onPress={shareDaily} hitSlop={10} containerStyle={styles.shareButton}>
                      <Text style={styles.shareGlyph}>{'⬆︎'}</Text>
                    </PressableScale>
                  )}
                  </View>
                </PressableScale>

                <View style={styles.todaySpacer} />
                <ErrandList compact />
              </View>
            </View>

            {/* --- Weekly Grand -------------------------------------------- */}
            <View style={[styles.page, { width }]}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Weekly Grand: ${grand.name}, a hard ${gameDisplayName(grand.kind)} board. ${
                  grandDone ? 'Solved this week.' : `${grand.daysLeft} day${grand.daysLeft === 1 ? '' : 's'} left. Pays ${GRAND_COINS} coins.`
                }${grandNextItem ? ` ${grandNext!.at - grandsSolved} more to win ${grandNextItem.name}.` : ''}`}
                onPress={openGrand}
                scaleTo={0.985}
                unstable_pressDelay={110}
                style={[styles.card, styles.cardGrand, { height: cardHeight }]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.eyebrowMuted, styles.grandEyebrow]}>Weekly Grand</Text>
                  <Text style={[styles.badge, grandDone ? styles.badgeDone : styles.badgeLive]}>
                    {grandDone ? 'Solved' : grand.daysLeft === 1 ? 'Last day' : `${grand.daysLeft} days left`}
                  </Text>
                </View>
                <View style={styles.dailyRow}>
                  <GameEmblem kind={grand.kind} size={54} />
                  <View style={styles.dailyText}>
                    <Text style={styles.dailyTitle} numberOfLines={2}>
                      {grand.name}
                    </Text>
                    <Text style={styles.dailyChapter}>Hard · {gameDisplayName(grand.kind)} · one a week</Text>
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
                                <Text style={styles.grandTickText}>{'\u2713\uFE0E'}</Text>
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
            </View>

            {/* --- You ---------------------------------------------------- */}
            {/* Rank, chapter and the record on one page - what used to be
              three (Rank, Puzzle IQ, Progress). Each figure opens where its
              detail lives: the almanac, the ledger, the achievements. */}
            <View style={[styles.page, { width }]}>
              <View style={[styles.card, { height: cardHeight }]}>
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
                    <PressableScale accessibilityRole="button" accessibilityLabel="Share your progress" onPress={shareProgress} hitSlop={10} containerStyle={styles.shareButton}>
                      <Text style={styles.shareGlyph}>{'⬆︎'}</Text>
                    </PressableScale>
                  </View>
                </View>

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
                  <View style={styles.youChapter}>
                    <View style={styles.youChapterHead}>
                      <Text style={styles.sectionLabel} numberOfLines={1}>{`Chapter ${toRoman(chapterNow.chapter.number)} · ${chapterNow.chapter.name}`}</Text>
                      <Text style={styles.youChapterLeft}>{`${LEVELS_PER_CHAPTER - chapterNow.levelsDone} to go`}</Text>
                    </View>
                    <View style={styles.chapterTicks}>
                      {Array.from({ length: LEVELS_PER_CHAPTER }, (_v, i) => (
                        <View key={i} style={[styles.chapterTick, styles.youTick, i < chapterNow.levelsDone && styles.chapterTickDone, i === chapterNow.levelsDone && styles.chapterTickNow]} />
                      ))}
                    </View>
                  </View>
                </PressableScale>

                {/* The record: four figures, each a door to its detail. */}
                <View style={styles.youFigures}>
                  <PressableScale accessibilityRole="button" accessibilityLabel={`${totalStars} stars, ${solved} of ${aptitude.total} puzzles solved. Open achievements`} onPress={onOpenAchievements} containerStyle={styles.figure}>
                    <Text style={styles.youValue}>{totalStars}</Text>
                    <Text style={styles.figureLabel}>
                      <Text style={styles.figureStar}>★</Text> Stars
                    </Text>
                  </PressableScale>
                  <View style={styles.figureRule} />
                  <PressableScale accessibilityRole="button" accessibilityLabel={`${solved} of ${aptitude.total} puzzles solved. Open achievements`} onPress={onOpenAchievements} containerStyle={styles.figure}>
                    <Text style={styles.youValue}>{solved}</Text>
                    <Text style={styles.figureLabel}>Solved</Text>
                  </PressableScale>
                  <View style={styles.figureRule} />
                  <PressableScale accessibilityRole="button" accessibilityLabel={`${earned} of ${ACHIEVEMENTS.length} badges. Open achievements`} onPress={onOpenAchievements} containerStyle={styles.figure}>
                    <Text style={styles.youValue}>
                      {earned}
                      <Text style={styles.figureOf}>/{ACHIEVEMENTS.length}</Text>
                    </Text>
                    <Text style={styles.figureLabel}>Badges</Text>
                  </PressableScale>
                  <View style={styles.figureRule} />
                  <PressableScale accessibilityRole="button" accessibilityLabel={iqLabel} onPress={onOpenLedger} containerStyle={styles.figure}>
                    <Text style={styles.youValue}>{aptitude.index ?? '-'}</Text>
                    <Text style={styles.figureLabel}>Puzzle IQ</Text>
                  </PressableScale>
                </View>

                <View style={styles.youLinks}>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Open your games" onPress={onOpenCollection} containerStyle={styles.youLinkWrap} style={[styles.youLink]}>
                    <Text style={styles.youLinkText}>Games</Text>
                  </PressableScale>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Open the ledger" onPress={onOpenLedger} containerStyle={styles.youLinkWrap} style={[styles.youLink]}>
                    <Text style={styles.youLinkText}>Ledger</Text>
                    {stampsWaiting > 0 && <View style={styles.youLinkDot} />}
                  </PressableScale>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Open achievements" onPress={onOpenAchievements} containerStyle={styles.youLinkWrap} style={[styles.youLink]}>
                    <Text style={styles.youLinkText}>Badges</Text>
                  </PressableScale>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Open the leaderboards" onPress={onOpenLeaderboard} containerStyle={styles.youLinkWrap} style={[styles.youLink]}>
                    <Text style={styles.youLinkText}>Ranks</Text>
                  </PressableScale>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Open your almanac" onPress={onOpenJourney} containerStyle={styles.youLinkWrap} style={[styles.youLink]}>
                    <Text style={styles.youLinkText}>Almanac</Text>
                    {chaptersWaiting > 0 && <View style={styles.youLinkDot} />}
                  </PressableScale>
                </View>
              </View>
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

const styles = themedStyles(() => ({
  trophyButton: { right: undefined, left: theme.spacing.lg },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth * 2, backgroundColor: theme.colors.borderStrong },
  pursePlus: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.goldFill, alignItems: 'center', justifyContent: 'center' },
  pursePlusText: { color: theme.colors.onGold, fontSize: 13, lineHeight: 15, fontWeight: theme.typography.weights.bold },
  streakNudgeDone: { borderColor: theme.colors.border },
  streakNudgeTextDone: { color: theme.colors.textSecondary },
  todayDaily: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  todayDailyRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  todayKicker: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  todayTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  playDone: { backgroundColor: theme.colors.success },
  playDoneGlyph: { color: theme.colors.surfaceHi, fontSize: 18, fontWeight: theme.typography.weights.bold },
  playSmall: { width: 42, height: 42, borderRadius: 21 },
  playTriSmall: { borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 12, marginLeft: 4 },
  todayStreak: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  todayMarks: { flex: 1 },
  todayStreakCount: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  todayStatusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 6 },
  todayStatusText: { flex: 1, marginTop: 0 },
  todayStatus: { marginTop: 6, fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  todaySpacer: { flex: 1, minHeight: theme.spacing.md },
  youHeadRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  youRank: { marginTop: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  youChapter: { marginTop: theme.spacing.md },
  youChapterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm },
  youChapterLeft: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  youTick: { height: 7 },
  youFigures: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' },
  youValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  youLinks: { flexDirection: 'row', gap: 6 },
  youLinkWrap: { flex: 1 },
  youLink: { alignItems: 'center', paddingVertical: 10, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  youLinkText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
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
  tagline: { fontSize: theme.typography.sizes.caption, lineHeight: 16, color: theme.colors.textTertiary },

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
    marginTop: 8,
  },
  heroMeta: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, marginTop: 8 },
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
    gap: theme.spacing.sm,
  },
  setItem: {
    alignItems: 'flex-start',
  },
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
    fontFamily: theme.typography.families.mono,
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
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
  cardFoot: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 12, rowGap: 6, marginTop: theme.spacing.sm },
  nextWrap: { alignSelf: 'stretch', flexBasis: '100%' },
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
  streakRow: {
    flexDirection: 'row',
    gap: 6,
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
  dailyStreakLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, marginTop: theme.spacing.sm, textAlign: 'center' },


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
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moon: { backgroundColor: theme.colors.accent, overflow: 'hidden' },
  moonShadow: { position: 'absolute', backgroundColor: theme.colors.background },
}));

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getLevelById, getStarThresholds } from '../game/levels';
import { StarThresholds } from '../game/levels/level';
import { dailyKeyOf, getDailyEntry, puzzleKindOf } from '../game/journey';
import { computeStars, LevelResult, StarRating } from '../game/scoring';
import { getWorldForLevel } from '../game/worlds';
import { createDefaultBackend, StorageBackend } from '../storage';
import { BatchPuzzleRef, generateBatch, isBatchComplete, markPuzzleCompleted, nextInBatch, replaceInBatch } from './batches';
import { GameKind } from '../game/journey';
import {
  emptyProgress,
  getDisplayDailyStreak,
  getLevelResult,
  getLevelStars,
  getTotalStars,
  isDailyCompleted,
  isLevelCompleted,
  PlayerProgress,
  recordCompletion as recordCompletionPure,
  recordDaily,
  setCursor as setCursorPure,
} from './playerProgress';
import { clearProgress, loadProgress, saveProgress } from './playerProgressStore';
import { GOLDEN_MULTIPLIER, cleanRunMultiplier, coinsForSolve } from './coins';
import { setColorOverrides } from '../theme';
import { skinOverrides } from './shop';
import { advanceErrands, claimErrand as claimErrandPure } from './errands';
import { chaptersFinished, claimChapter as claimChapterPure } from './chapters';
import { recordGrand } from './grand';
import { claimStamp as claimStampPure } from './ledger';
import { collectRanks as collectRanksPure } from './rank';
import {
  Cosmetic,
  CosmeticSlot,
  DEFAULT_EQUIPPED,
  SWAP_PRICE,
  buyCosmetic as buyCosmeticPure,
  buyLuckyCharm as buyLuckyCharmPure,
  buyStreakFreeze as buyStreakFreezePure,
  reinstateGame as reinstateGamePure,
  retireGame as retireGamePure,
  cosmeticById,
  equipCosmetic as equipCosmeticPure,
  equipped as equippedPure,
} from './shop';

/**
 * Part B's extension point for a future ad system - fires exactly once,
 * the instant a batch is completed, before the next level's batch is
 * generated. Intentionally a no-op today: no ad SDK, no reward logic, no
 * UI exists yet, only this call site for a future implementation to hang
 * off. Called from `recordCompletion` itself (not from inside the pure
 * mutation it applies) specifically so a future real implementation - which
 * will have actual side effects (firing an ad request) - runs exactly once
 * per real batch completion, never re-invoked by the pending-mutation
 * replay a pure `ProgressMutation` can be subject to (see `applyMutation`'s
 * own comment).
 */
function onBatchComplete(): void {
  // Intentionally empty - see the ads+ad-free-time spec (part B).
}

/**
 * Guarantees `progress.currentBatch` is never null - generating level 1's
 * batch (or whichever level `currentLevel` already backfilled to) the
 * first time it's missing. Used in two places: the provider's own
 * synchronous initial state (`useState(emptyProgress)` on its own would
 * render with `currentBatch: null` for the brief window before the async
 * `loadProgress()` below resolves - the same "render against a safe
 * default before the real load resolves" tolerance this app already had
 * for Journey position, just now needing an explicit batch instead of a
 * stateless lookup into a static array) and the real load's own
 * resolution, so a save from before this feature shipped picks one up too.
 */
function ensureBatch(progress: PlayerProgress): PlayerProgress {
  if (progress.currentBatch) return progress;
  return { ...progress, currentBatch: generateBatch(progress.currentLevel, progress, null) };
}

/**
 * Outcome of recording a single completion - handed back to the UI so the
 * completion screen can show "this run" alongside the persisted best.
 */
export interface CompletionOutcome {
  /** Stars earned on this particular solve. */
  readonly runStars: StarRating;
  /** Gravity moves used on this particular solve. */
  readonly runMoves: number;
  /** The merged best-ever result for the level after this solve. */
  readonly best: LevelResult;
  /** True iff this exact solve was the one that completed the current
   * level's batch (its last remaining puzzle) - the screen's own cue to
   * route "Next" through the calming interstitial before opening the new
   * level's first puzzle, rather than jumping straight there the way a
   * mid-batch "Next" still does. */
  readonly batchCompleted: boolean;
  /** Coins this solve paid out (0 for a replay that earned no new star). */
  readonly coinsEarned: number;
  /** The chapter this solve finished (its last level set), if any - its
   * reward is waiting in the Almanac. */
  readonly chapterFinished: number | null;
  /** The lucky charm doubled this solve's coins. */
  readonly charmed: boolean;
  /** This was a golden puzzle, solved for the first time. */
  readonly golden: boolean;
  /** The clean-run count after this solve, and the multiplier it paid. */
  readonly cleanRun: number;
  readonly comboMultiplier: number;
  /** This was the Weekly Grand, solved for the first time - and the
   * exclusive it won, if it reached a milestone. */
  readonly grand: boolean;
  readonly grandCosmetic: string | null;
}

/** The bonuses on the latest solve, for the solved card to show. */
export interface SolveBonus {
  readonly charmed: boolean;
  readonly golden: boolean;
  readonly cleanRun: number;
  readonly comboMultiplier: number;
  readonly grand: boolean;
  readonly grandCosmetic: string | null;
}

interface PlayerProgressContextValue {
  /** Latest known progress. Starts empty; replaced once storage has loaded. */
  readonly progress: PlayerProgress;
  /** False until the initial load from storage has finished. */
  readonly ready: boolean;
  /** Record a solve. Pure merge + fire-and-forget persist. Safe to call
   * repeatedly (replays); the player can never lose stars or a better time. */
  recordCompletion(levelId: string, moves: number, options?: { maxStars?: StarRating }): CompletionOutcome;
  /** Remember the level the player just opened, so the app can resume here.
   * `worldId` is optional - it is looked up from the level when omitted. */
  markLevelOpened(levelId: string, worldId?: string): void;
  /** Wipes every star and completion, in memory and on disk. Irreversible -
   * the Settings screen is expected to confirm with the player first. */
  resetProgress(): void;
  /** The coin balance. */
  readonly coins: number;
  /** Takes `amount` coins if the player has them. Returns whether it did -
   * a caller spends *before* applying what it bought, so a refused spend
   * leaves the board untouched. */
  spendCoins(amount: number): boolean;
  levelResult(levelId: string): LevelResult | undefined;
  levelStars(levelId: string): 0 | StarRating;
  isCompleted(levelId: string): boolean;
  readonly totalStars: number;
  /** Claims today's errand `index`; returns the coins it paid, or null. */
  claimErrand(index: number): number | null;
  /** Claims a finished chapter's reward; returns whether it did. */
  claimChapter(number: number): boolean;
  /** Claims an earned ledger stamp; returns whether it did. */
  claimStamp(kind: GameKind, step: number): boolean;
  /** Marks the first-launch walkthrough seen. */
  markIntroSeen(): void;
  /** Pays out every rank reached but not yet celebrated. */
  collectRanks(): { ranks: number[]; coins: number };
  /** Buys a cosmetic (and puts it on); returns whether it did. */
  buyCosmetic(id: string): boolean;
  equipCosmetic(id: string): void;
  buyStreakFreeze(): boolean;
  /** Retires a game from the player's level sets (replacing any of its
   * unfinished puzzles in the current set); returns whether it did. */
  retireGame(kind: GameKind): boolean;
  /** Brings a retired game back - free. */
  reinstateGame(kind: GameKind): void;
  buyLuckyCharm(): boolean;
  /** Swaps the current set's next puzzle for another game's; returns the
   * new puzzle, or null if it could not (no coins, nothing to swap). */
  swapPuzzle(): BatchPuzzleRef | null;
  /** Whether the latest solve's coins were doubled by the lucky charm -
   * for the solved card to say so. */
  readonly lastCharmed: boolean;
  /** Every bonus on the latest solve. */
  readonly lastBonus: SolveBonus | null;
  /** Consecutive days (including today, if already solved) the Daily
   * puzzle has been completed. Zero once a day is missed. */
  readonly dailyStreak: number;
  /** Whether today's Daily has already been solved this run. */
  readonly dailyCompletedToday: boolean;
}

const PlayerProgressContext = createContext<PlayerProgressContextValue | null>(null);

/**
 * Star thresholds for every non-Gravity game, whose puzzles have no
 * authored `StarThresholds` of their own (`getLevelById` only knows Gravity
 * levels). They pass a *hint count* through the `moves` slot instead of a
 * move count, scored on a fixed tier: 0 hints -> 3 stars, 1 hint -> 2,
 * 2+ hints -> 1. See `recordCompletion` below for why that count is shifted
 * up by one before it reaches `computeStars`.
 */
const HINT_STAR_THRESHOLDS: StarThresholds = { three: 1, two: 2 };

/** A pure `PlayerProgress` update, replayable in order once the real loaded
 * data is available - see the `pendingRef` note in the provider below. */
type ProgressMutation = (progress: PlayerProgress) => PlayerProgress;

export interface PlayerProgressProviderProps {
  children: React.ReactNode;
  /** Injectable for tests; defaults to AsyncStorage (memory fallback). */
  backend?: StorageBackend;
}

/**
 * Loads player progress from storage once on mount, keeps it in React state
 * as the in-session source of truth, and writes through to storage on every
 * change. All scoring maths lives in the pure `playerProgress` / `scoring`
 * modules - this component is just the React + persistence wiring.
 */
export function PlayerProgressProvider({
  children,
  backend,
}: PlayerProgressProviderProps): React.JSX.Element {
  const backendRef = useRef<StorageBackend>(backend ?? createDefaultBackend());
  const [progress, setProgress] = useState<PlayerProgress>(() => ensureBatch(emptyProgress()));
  const [ready, setReady] = useState(false);
  const [lastCharmed, setLastCharmed] = useState(false);
  const [lastBonus, setLastBonus] = useState<SolveBonus | null>(null);

  // Latest progress, readable synchronously from `recordCompletion` without
  // routing side effects through a setState updater.
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // `ready` (state) drives the public API; this ref mirrors it so
  // `applyMutation` can make a synchronous decision without waiting on a
  // re-render (the same reason `progressRef` mirrors `progress`).
  const readyRef = useRef(false);
  // Mutations applied before the initial `loadProgress()` resolves. A write
  // that happens in that window can't be saved yet - `progressRef.current`
  // is still `emptyProgress()`, so saving now would overwrite whatever is
  // actually on disk with a write based on an empty base, and letting the
  // load's own resolution simply overwrite `progress` afterwards would
  // instead silently discard the write in memory. Replaying every pending
  // mutation on top of the real loaded data once it arrives (below) avoids
  // both: a fast tap right after a cold launch, before storage has finished
  // reading, can neither be lost nor wipe real progress already on disk.
  const pendingRef = useRef<ProgressMutation[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadProgress(backendRef.current).then(loaded => {
      if (cancelled) return;

      // A fresh install, or any save from before the v5 migration, loads
      // with `currentBatch: null` (see that migration's own comment in
      // `playerProgressStore.ts`) - `ensureBatch` backfills it here, before
      // any pending mutation queued during this same load race gets a
      // chance to run (below).
      const withBatch = ensureBatch(loaded);

      const pending = pendingRef.current;
      pendingRef.current = [];
      readyRef.current = true;

      const resolved = pending.reduce((p, mutate) => mutate(p), withBatch);
      progressRef.current = resolved;
      setProgress(resolved);
      setReady(true);
      if (pending.length > 0 || withBatch !== loaded) saveProgress(backendRef.current, resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Applies a pure mutation to the current progress, updates in-memory state
  // immediately either way, and persists it - or, before the initial load
  // has resolved, defers persisting and queues the same mutation to replay
  // once it does (see `pendingRef`). Shared by every mutating action so
  // there is exactly one place that has to get this race right.
  const applyMutation = useCallback((mutate: ProgressMutation): PlayerProgress => {
    const current = progressRef.current;
    const next = mutate(current);
    if (next === current) return current;

    progressRef.current = next;
    setProgress(next);
    if (readyRef.current) {
      saveProgress(backendRef.current, next);
    } else {
      pendingRef.current.push(mutate);
    }
    return next;
  }, []);

  const recordCompletion = useCallback((levelId: string, moves: number, options?: { maxStars?: StarRating }): CompletionOutcome => {
    const maxStars = options?.maxStars ?? 3;
    const level = getLevelById(levelId);
    const thresholds = level ? getStarThresholds(level) : HINT_STAR_THRESHOLDS;

    // `computeStars` treats a move count under 1 as a defensive, degenerate
    // input (a Gravity level can never actually be solved in zero moves).
    // A non-Gravity game's hint count legitimately *is* zero on a flawless
    // solve, so it is shifted up one tier here before scoring - 0 hints
    // scores as tier 1 against `HINT_STAR_THRESHOLDS`, 1 hint as tier 2, and
    // so on. Gravity's own `moves` is untouched.
    const scored = level ? moves : moves + 1;
    const isDaily = levelId === getDailyEntry().puzzleId;
    const todayKey = dailyKeyOf(new Date());
    const levelBefore = progressRef.current.currentLevel;

    // Worked out inside the mutation, from exactly the progress it applies
    // to, so a solve recorded before the save has loaded (and replayed onto
    // it) is still paid against the real save, not the placeholder.
    let coinsEarned = 0;
    let charmed = false;
    let golden = false;
    let cleanRun = 0;
    let comboMultiplier = 1;
    let grand = false;
    let grandCosmetic: string | null = null;
    const next = applyMutation(current => {
      const previousStars = getLevelStars(current, levelId);
      const firstDailyToday = isDaily && !isDailyCompleted(current, todayKey);
      let result = recordCompletionPure(current, levelId, scored, thresholds, maxStars);
      // Any completion - Gravity or any other game alike - also extends the
      // Daily streak when it happens to be today's Daily entry. No screen
      // needs to know it opened the Daily card for this to work: every
      // completion already funnels through here by puzzle id.
      if (isDaily) result = recordDaily(result, todayKey);

      // Batch progression: mark this puzzle completed within the current
      // batch (a no-op via `markPuzzleCompleted` if `levelId` isn't actually
      // one of its puzzles - e.g. the Daily puzzle landing outside today's
      // batch), then roll over to the next level's batch the instant the
      // current one is fully solved. `result` (not `current`) is what the
      // new batch's own "avoid re-serving a completed puzzle" logic reads,
      // so it correctly excludes the puzzle just completed right now, not
      // just whatever was already completed before this call.
      // Golden: read off the set before it is marked done (or replaced).
      golden = previousStars === 0 && (current.currentBatch?.puzzles.some(p => p.puzzleId === levelId && p.golden) ?? false);
      let setCompleted = false;
      if (result.currentBatch) {
        const updatedBatch = markPuzzleCompleted(result.currentBatch, levelId);
        setCompleted = isBatchComplete(updatedBatch);
        result = setCompleted
          ? { ...result, currentLevel: result.currentLevel + 1, currentBatch: generateBatch(result.currentLevel + 1, result, updatedBatch) }
          : { ...result, currentBatch: updatedBatch };
      }

      coinsEarned = coinsForSolve({ previousStars, bestStars: getLevelStars(result, levelId) || 1, firstDailyToday, setCompleted });
      // The clean-run combo: a first solve without a hint extends it and is
      // paid by it; a hint resets it. Replays leave it be, so it cannot be
      // built up on boards already solved.
      const clean = level ? maxStars === 3 : moves === 0;
      if (previousStars === 0) {
        cleanRun = clean ? current.cleanRun + 1 : 0;
        comboMultiplier = cleanRunMultiplier(cleanRun);
        result = { ...result, cleanRun };
      } else {
        cleanRun = current.cleanRun;
      }
      if (golden) coinsEarned *= GOLDEN_MULTIPLIER;
      coinsEarned = Math.round(coinsEarned * comboMultiplier);
      // The lucky charm: a paying solve pays double, and uses a charge.
      charmed = coinsEarned > 0 && result.luckyCharges > 0;
      if (charmed) {
        coinsEarned *= 2;
        result = { ...result, luckyCharges: result.luckyCharges - 1 };
      }
      if (coinsEarned > 0) result = { ...result, coins: result.coins + coinsEarned };
      // The Weekly Grand pays on top, unmultiplied.
      const grandPaid = recordGrand(result, levelId, new Date());
      if (grandPaid) {
        grand = true;
        grandCosmetic = grandPaid.cosmetic;
        coinsEarned += grandPaid.progress.coins - result.coins;
        result = grandPaid.progress;
      }

      // Today's errands move along with every solve.
      const found = puzzleKindOf(levelId);
      if (found) {
        result = advanceErrands(result, todayKey, {
          kind: found.kind,
          stars: Math.min(computeStars(scored, thresholds), maxStars),
          clean,
          difficulty: found.difficulty,
          isDaily,
          setCompleted,
        });
      }
      return result;
    });

    // Fired from here, not from inside the mutation above - see
    // `onBatchComplete`'s own comment for why.
    const batchCompleted = next.currentLevel > levelBefore;
    if (batchCompleted) onBatchComplete();
    const chaptersBefore = Math.floor((levelBefore - 1) / 10);
    const chapterFinished = batchCompleted && chaptersFinished(next) > chaptersBefore ? chaptersFinished(next) : null;

    return {
      runStars: Math.min(computeStars(scored, thresholds), maxStars) as StarRating,
      // The real, unshifted count - Gravity moves or hints used - is what
      // the completion screens actually show the player.
      runMoves: moves,
      best: getLevelResult(next, levelId)!,
      batchCompleted,
      coinsEarned,
      chapterFinished,
      charmed,
      golden,
      cleanRun,
      comboMultiplier,
      grand,
      grandCosmetic,
    };
  }, [applyMutation]);

  // Recorded after the fact, outside the updater, for the solved card.
  const recordAndMark = useCallback(
    (levelId: string, moves: number, options?: { maxStars?: StarRating }): CompletionOutcome => {
      const outcome = recordCompletion(levelId, moves, options);
      setLastCharmed(outcome.charmed);
      setLastBonus({
        charmed: outcome.charmed,
        golden: outcome.golden,
        cleanRun: outcome.cleanRun,
        comboMultiplier: outcome.comboMultiplier,
        grand: outcome.grand,
        grandCosmetic: outcome.grandCosmetic,
      });
      return outcome;
    },
    [recordCompletion],
  );

  const retireGame = useCallback(
    (kind: GameKind): boolean => {
      let done = false;
      applyMutation(current => {
        const retired = retireGamePure(current, kind);
        if (!retired) return current;
        done = true;
        const batch = retired.currentBatch;
        if (!batch) return retired;
        const stale = batch.puzzles.filter(p => p.kind === kind).map(p => p.puzzleId);
        return stale.length > 0 ? { ...retired, currentBatch: replaceInBatch(batch, stale, retired) } : retired;
      });
      return done;
    },
    [applyMutation],
  );
  const reinstateGame = useCallback(
    (kind: GameKind): void => {
      applyMutation(current => reinstateGamePure(current, kind));
    },
    [applyMutation],
  );
  const buyLuckyCharm = useCallback((): boolean => {
    let done = false;
    applyMutation(current => {
      const next = buyLuckyCharmPure(current);
      done = next !== null;
      return next ?? current;
    });
    return done;
  }, [applyMutation]);
  const swapPuzzle = useCallback((): BatchPuzzleRef | null => {
    let swapped: BatchPuzzleRef | null = null;
    applyMutation(current => {
      const batch = current.currentBatch;
      const target = batch ? nextInBatch(batch) : null;
      if (!batch || !target || current.coins < SWAP_PRICE) return current;
      const replaced = replaceInBatch(batch, [target.puzzleId], current);
      const slot = batch.puzzles.findIndex(p => p.puzzleId === target.puzzleId);
      if (replaced.puzzles[slot].puzzleId === target.puzzleId) return current;
      swapped = replaced.puzzles[slot];
      return { ...current, coins: current.coins - SWAP_PRICE, currentBatch: replaced };
    });
    return swapped;
  }, [applyMutation]);

  const claimErrand = useCallback(
    (index: number): number | null => {
      const todayKey = dailyKeyOf(new Date());
      const before = progressRef.current.coins;
      const next = applyMutation(current => claimErrandPure(current, todayKey, index) ?? current);
      return next.coins > before ? next.coins - before : null;
    },
    [applyMutation],
  );
  const claimChapter = useCallback(
    (number: number): boolean => {
      let done = false;
      applyMutation(current => {
        const next = claimChapterPure(current, number);
        done = next !== null;
        return next ?? current;
      });
      return done;
    },
    [applyMutation],
  );
  const claimStamp = useCallback(
    (kind: GameKind, step: number): boolean => {
      let done = false;
      applyMutation(current => {
        const next = claimStampPure(current, kind, step);
        done = next !== null;
        return next ?? current;
      });
      return done;
    },
    [applyMutation],
  );
  const markIntroSeen = useCallback(() => {
    applyMutation(current => (current.introSeen ? current : { ...current, introSeen: true }));
  }, [applyMutation]);
  const collectRanks = useCallback((): { ranks: number[]; coins: number } => {
    let out = { ranks: [] as number[], coins: 0 };
    applyMutation(current => {
      const collected = collectRanksPure(current);
      out = { ranks: collected.ranks, coins: collected.coins };
      return collected.progress;
    });
    return out;
  }, [applyMutation]);
  const buyCosmetic = useCallback(
    (id: string): boolean => {
      let done = false;
      applyMutation(current => {
        const next = buyCosmeticPure(current, id);
        done = next !== null;
        return next ?? current;
      });
      return done;
    },
    [applyMutation],
  );
  const equipCosmetic = useCallback(
    (id: string): void => {
      applyMutation(current => equipCosmeticPure(current, id));
    },
    [applyMutation],
  );
  const buyStreakFreeze = useCallback((): boolean => {
    let done = false;
    applyMutation(current => {
      const next = buyStreakFreezePure(current);
      done = next !== null;
      return next ?? current;
    });
    return done;
  }, [applyMutation]);

  const markLevelOpened = useCallback((levelId: string, worldId?: string): void => {
    const resolvedWorldId = worldId ?? getWorldForLevel(levelId)?.id;
    if (!resolvedWorldId) return;

    applyMutation(current => setCursorPure(current, resolvedWorldId, levelId));
  }, [applyMutation]);

  // Bypasses `applyMutation`'s replay queue on purpose: a reset is only ever
  // triggered from Settings, well after the initial load has resolved (the
  // screen couldn't render the current progress to reset otherwise), and it
  // should win outright rather than be treated as one more mutation to
  // reconcile with whatever `loadProgress` returns.
  const spendCoins = useCallback(
    (amount: number): boolean => {
      if (progressRef.current.coins < amount) return false;
      // Re-checked inside the mutation: if it is replayed onto a freshly
      // loaded save that turns out to hold less, it charges nothing rather
      // than going negative.
      applyMutation(current => (current.coins >= amount ? { ...current, coins: current.coins - amount } : current));
      return true;
    },
    [applyMutation],
  );

  const resetProgress = useCallback((): void => {
    const fresh = emptyProgress();
    progressRef.current = fresh;
    pendingRef.current = [];
    setProgress(fresh);
    clearProgress(backendRef.current);
  }, []);

  // Worn game skins repaint their game's palette tokens. Applied during
  // render (idempotent), so the next screen to draw a board already sees
  // them.
  const repaints = useMemo(() => skinOverrides(progress), [progress]);
  setColorOverrides(repaints.light, repaints.dark);

  const value = useMemo<PlayerProgressContextValue>(
    () => ({
      progress,
      ready,
      recordCompletion: recordAndMark,
      markLevelOpened,
      resetProgress,
      coins: progress.coins,
      spendCoins,
      claimErrand,
      claimChapter,
      claimStamp,
      markIntroSeen,
      collectRanks,
      buyCosmetic,
      equipCosmetic,
      buyStreakFreeze,
      retireGame,
      reinstateGame,
      buyLuckyCharm,
      swapPuzzle,
      lastCharmed,
      lastBonus,
      levelResult: (levelId: string) => getLevelResult(progress, levelId),
      levelStars: (levelId: string) => getLevelStars(progress, levelId),
      isCompleted: (levelId: string) => isLevelCompleted(progress, levelId),
      totalStars: getTotalStars(progress),
      dailyStreak: getDisplayDailyStreak(progress, dailyKeyOf(new Date())),
      dailyCompletedToday: isDailyCompleted(progress, dailyKeyOf(new Date())),
    }),
    [progress, ready, recordAndMark, markLevelOpened, resetProgress, spendCoins, claimErrand, claimChapter, claimStamp, markIntroSeen, collectRanks, buyCosmetic, equipCosmetic, buyStreakFreeze, retireGame, reinstateGame, buyLuckyCharm, swapPuzzle, lastCharmed, lastBonus],
  );

  return (
    <PlayerProgressContext.Provider value={value}>{children}</PlayerProgressContext.Provider>
  );
}

/** Access player progress. Throws if used outside `PlayerProgressProvider`. */
export function usePlayerProgress(): PlayerProgressContextValue {
  const value = useContext(PlayerProgressContext);
  if (!value) {
    throw new Error('usePlayerProgress must be used within a PlayerProgressProvider');
  }
  return value;
}

/**
 * The cosmetic worn in `slot` - for anything that draws one (the solve
 * confetti, the break's marble, the Bridges chart). Falls back to the
 * slot's default outside a provider, so a component that shows a cosmetic
 * never needs one just to render.
 */
export function useEquipped(slot: CosmeticSlot): Cosmetic {
  const value = useContext(PlayerProgressContext);
  return value ? equippedPure(value.progress, slot) : cosmeticById(DEFAULT_EQUIPPED[slot])!;
}

/** Whether the latest solve's coins were doubled by the lucky charm -
 * false outside a provider. */
export function useLastCharmed(): boolean {
  return useContext(PlayerProgressContext)?.lastCharmed ?? false;
}

/** Every bonus on the latest solve - null outside a provider. */
export function useLastBonus(): SolveBonus | null {
  return useContext(PlayerProgressContext)?.lastBonus ?? null;
}

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
import { dailyKeyOf, getDailyEntry } from '../game/journey';
import { computeStars, LevelResult, StarRating } from '../game/scoring';
import { getWorldForLevel } from '../game/worlds';
import { createDefaultBackend, StorageBackend } from '../storage';
import { generateBatch, isBatchComplete, markPuzzleCompleted } from './batches';
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
}

interface PlayerProgressContextValue {
  /** Latest known progress. Starts empty; replaced once storage has loaded. */
  readonly progress: PlayerProgress;
  /** False until the initial load from storage has finished. */
  readonly ready: boolean;
  /** Record a solve. Pure merge + fire-and-forget persist. Safe to call
   * repeatedly (replays); the player can never lose stars or a better time. */
  recordCompletion(levelId: string, moves: number): CompletionOutcome;
  /** Remember the level the player just opened, so the app can resume here.
   * `worldId` is optional - it is looked up from the level when omitted. */
  markLevelOpened(levelId: string, worldId?: string): void;
  /** Wipes every star and completion, in memory and on disk. Irreversible -
   * the Settings screen is expected to confirm with the player first. */
  resetProgress(): void;
  levelResult(levelId: string): LevelResult | undefined;
  levelStars(levelId: string): 0 | StarRating;
  isCompleted(levelId: string): boolean;
  readonly totalStars: number;
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

  const recordCompletion = useCallback((levelId: string, moves: number): CompletionOutcome => {
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

    const next = applyMutation(current => {
      let result = recordCompletionPure(current, levelId, scored, thresholds);
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
      if (result.currentBatch) {
        const updatedBatch = markPuzzleCompleted(result.currentBatch, levelId);
        result = isBatchComplete(updatedBatch)
          ? { ...result, currentLevel: result.currentLevel + 1, currentBatch: generateBatch(result.currentLevel + 1, result, updatedBatch) }
          : { ...result, currentBatch: updatedBatch };
      }
      return result;
    });

    // Fired from here, not from inside the mutation above - see
    // `onBatchComplete`'s own comment for why.
    const batchCompleted = next.currentLevel > levelBefore;
    if (batchCompleted) onBatchComplete();

    return {
      runStars: computeStars(scored, thresholds),
      // The real, unshifted count - Gravity moves or hints used - is what
      // the completion screens actually show the player.
      runMoves: moves,
      best: getLevelResult(next, levelId)!,
      batchCompleted,
    };
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
  const resetProgress = useCallback((): void => {
    const fresh = emptyProgress();
    progressRef.current = fresh;
    pendingRef.current = [];
    setProgress(fresh);
    clearProgress(backendRef.current);
  }, []);

  const value = useMemo<PlayerProgressContextValue>(
    () => ({
      progress,
      ready,
      recordCompletion,
      markLevelOpened,
      resetProgress,
      levelResult: (levelId: string) => getLevelResult(progress, levelId),
      levelStars: (levelId: string) => getLevelStars(progress, levelId),
      isCompleted: (levelId: string) => isLevelCompleted(progress, levelId),
      totalStars: getTotalStars(progress),
      dailyStreak: getDisplayDailyStreak(progress, dailyKeyOf(new Date())),
      dailyCompletedToday: isDailyCompleted(progress, dailyKeyOf(new Date())),
    }),
    [progress, ready, recordCompletion, markLevelOpened, resetProgress],
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

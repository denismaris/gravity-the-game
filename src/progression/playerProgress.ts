import { StarThresholds } from '../game/levels/level';
import {
  computeStars,
  LevelResult,
  mergeLevelResult,
  StarRating,
} from '../game/scoring';
import { BatchState } from './batches';
import { STARTING_COINS, STARTING_INSIGHTS } from './coins';
import type { ErrandLog } from './errands';
import { EMPTY_GIFT, GiftLog } from './gift';
import type { CosmeticSlot } from './shop';
import type { GameKind } from '../game/journey';

/** Where the player last was, so the app can resume there. */
export interface ProgressCursor {
  readonly worldId: string;
  readonly levelId: string;
}

/**
 * The Daily puzzle's streak bookkeeping. `lastCompletedKey` is the
 * `dailyKeyOf` (UTC `YYYY-MM-DD`) of the last day the Daily was solved, or
 * `null` if it never has been - that is the only state needed to derive
 * both "is today already done" and "does today extend the streak".
 */
export interface DailyStatus {
  readonly streak: number;
  readonly lastCompletedKey: string | null;
}

export const EMPTY_DAILY: DailyStatus = { streak: 0, lastCompletedKey: null };

/**
 * Everything the game remembers about a player between sessions.
 *
 * Kept deliberately small and flat:
 *  - `version` - schema version, so a shape change can migrate or safely
 *    discard old data.
 *  - `levels` - map of level id -> best `LevelResult`. A level id absent from
 *    this map has never been completed. This is the single source of truth
 *    for stars and completion; unlocked levels / unlocked worlds / total
 *    stars are all *derived* from it (see `worldProgress.ts`), never stored,
 *    so they can never drift.
 *  - `cursor` - the last world+level the player opened (a resume hint only).
 *  - `daily` - the Daily puzzle's streak state (see `DailyStatus`).
 *  - `bestDailyStreak` - the highest `daily.streak` ever reached. Tracked
 *    separately because `daily.streak` itself is *not* a permanent record -
 *    `recordDaily` resets it to 1 the day after a miss - so a streak-based
 *    achievement ("reach a 7-day streak") needs its own monotonically
 *    non-decreasing field to stay earned once it's earned.
 *  - `currentLevel` - the randomized level-batch progression's own cursor
 *    (v5). Starts at 1; advances by one each time `currentBatch` is fully
 *    completed.
 *  - `currentBatch` - the in-progress batch's fixed composition and
 *    per-puzzle completion state (see `./batches.ts`). `null` only before
 *    the very first batch has been generated (immediately backfilled by
 *    `PlayerProgressProvider` on load) - a batch, once generated, is never
 *    regenerated or reshuffled mid-way, only ever completed and replaced by
 *    the next level's batch. Deliberately *not* re-derivable from `levels`
 *    the way unlocks/totals are - which specific puzzles belong to the
 *    current batch is a real decision made once, at generation time, not a
 *    pure function of completion history.
 *  - `adFreeTimeRemainingMs` - a placeholder for a future ad-free-time
 *    reward system. `null` means "unused / no effect on current behaviour"
 *    - there is no ad system yet, so nothing reads this field for any
 *    decision today. Deliberately not `Infinity`: `JSON.stringify(Infinity)`
 *    silently serializes to `"null"`, which would round-trip back as the
 *    number `0` through `JSON.parse` on naive numeric parsing - using the
 *    real `null` sentinel throughout avoids ever depending on that
 *    footgun. See `onBatchComplete` in `PlayerProgressProvider.tsx` for the
 *    (currently no-op) extension point a future ad system would hang off.
 *
 * This module is pure - it never talks to storage (see `playerProgressStore`).
 */
export interface PlayerProgress {
  readonly version: 5;
  readonly levels: Readonly<Record<string, LevelResult>>;
  readonly cursor: ProgressCursor | null;
  readonly daily: DailyStatus;
  readonly bestDailyStreak: number;
  readonly currentLevel: number;
  readonly currentBatch: BatchState | null;
  readonly adFreeTimeRemainingMs: number | null;
  /** The coin balance - see `coins.ts`. Added without a version bump, the
   * same way `challenge` was: a save without it is read as holding
   * `STARTING_COINS`. */
  readonly coins: number;
  /** Today's errands and how far along each is (see `errands.ts`); null
   * until the first solve of a day. Every field from here down was added
   * without a version bump - a save without one reads as its default. */
  readonly errands: ErrandLog | null;
  /** Errands claimed, ever - part of the rank's experience. */
  readonly errandsClaimed: number;
  /** The highest rank already celebrated and paid (see `rank.ts`). */
  readonly rankRewarded: number;
  /** Chapters whose reward has been claimed (see `chapters.ts`). */
  readonly chaptersClaimed: ReadonlyArray<number>;
  /** Shop items bought or won (free defaults are never listed). */
  readonly owned: ReadonlyArray<string>;
  /** The item worn in each cosmetic slot. */
  readonly equipped: Readonly<Partial<Record<CosmeticSlot, string>>>;
  /** Streak freezes held - each covers one missed Daily. */
  readonly streakFreezes: number;
  /** Games the player has retired from their level sets (at most three). */
  readonly retired: ReadonlyArray<GameKind>;
  /** Solves left on the lucky charm - each pays double coins. */
  readonly luckyCharges: number;
  /** Insight charges held - the superpower that reveals the next move. */
  readonly insights: number;
  /** Consecutive solves without a hint - the clean-run combo. */
  readonly cleanRun: number;
  /** Weeks (see `journey/weekly.ts`) whose Grand has been solved. */
  readonly grandsSolved: ReadonlyArray<number>;
  /** Ledger stamps paid out, as `kind:step`. */
  readonly stampsClaimed: ReadonlyArray<string>;
  /** The first-launch walkthrough has been seen (or skipped). */
  readonly introSeen: boolean;
  /** A shop item the player is saving up for - Home's purse shows how
   * close they are. */
  readonly shopGoal: string | null;
  /** Puzzles solved on `dayKey` (UTC) - Home's blossom opens with it. */
  readonly today: { readonly dayKey: string; readonly solves: number };
  /** How long each Daily took (ms), by day - the Daily Duel's record. */
  readonly dailyTimes: Readonly<Record<string, number>>;
  /** The daily gift's week (see `gift.ts`). */
  readonly gift: GiftLog;
  /** Shop sets whose completion bonus has been paid (see `shop.ts`). */
  readonly setsClaimed: ReadonlyArray<string>;
  /** Bought the Patron pass (see `store.ts`). */
  readonly patron: boolean;
  /** When bought ad-free time runs out (epoch ms), or null. See `shop.ts`. */
  readonly adFreeUntil: number | null;
  /** Tiles held for the Villa (see `villa.ts`) - earned by solving, spent
   * only on building. */
  readonly tesserae: number;
  /** Villa pieces built, in the order they were built. */
  readonly villa: ReadonlyArray<string>;
}

export const PLAYER_PROGRESS_VERSION = 5 as const;

export function emptyProgress(): PlayerProgress {
  return {
    version: PLAYER_PROGRESS_VERSION,
    levels: {},
    cursor: null,
    daily: EMPTY_DAILY,
    bestDailyStreak: 0,
    currentLevel: 1,
    currentBatch: null,
    adFreeTimeRemainingMs: null,
    coins: STARTING_COINS,
    errands: null,
    errandsClaimed: 0,
    rankRewarded: 1,
    chaptersClaimed: [],
    owned: [],
    equipped: {},
    streakFreezes: 0,
    retired: [],
    luckyCharges: 0,
    insights: STARTING_INSIGHTS,
    tesserae: 0,
    villa: [],
    cleanRun: 0,
    grandsSolved: [],
    stampsClaimed: [],
    introSeen: false,
    shopGoal: null,
    today: { dayKey: '', solves: 0 },
    dailyTimes: {},
    gift: EMPTY_GIFT,
    setsClaimed: [],
    patron: false,
    adFreeUntil: null,
  };
}

/** The player's best result for a level, or `undefined` if never completed. */
export function getLevelResult(
  progress: PlayerProgress,
  levelId: string,
): LevelResult | undefined {
  return progress.levels[levelId];
}

export function isLevelCompleted(progress: PlayerProgress, levelId: string): boolean {
  return progress.levels[levelId] !== undefined;
}

/** Stars earned on a level (0 if never completed). */
export function getLevelStars(progress: PlayerProgress, levelId: string): 0 | StarRating {
  return progress.levels[levelId]?.stars ?? 0;
}

/** Sum of best stars across every completed level (the game-wide total). */
export function getTotalStars(progress: PlayerProgress): number {
  let total = 0;
  for (const key of Object.keys(progress.levels)) {
    total += progress.levels[key].stars;
  }
  return total;
}

/**
 * How many entries the save holds - **not** how many of the app's current
 * puzzles have been solved, and the two genuinely differ.
 *
 * `levels` is keyed by puzzle id and nothing ever prunes it, so a save
 * that predates a retired game or a regenerated pool still carries those
 * ids. That is deliberate (a puzzle that comes back should come back
 * solved) but it means this count can exceed the number of puzzles that
 * actually exist. Anything shown to the player as "X of Y solved" wants
 * `computeAptitude`'s own `solved`/`total` instead, which only counts ids
 * still present in a pool.
 */
export function getCompletedCount(progress: PlayerProgress): number {
  return Object.keys(progress.levels).length;
}

/**
 * Records a completion of `levelId` in `moves` gravity moves, given that
 * level's `thresholds`. Returns a new `PlayerProgress`; the existing result
 * (if any) is merged so the player can never lose stars or a better move
 * count by replaying and doing worse. Pure.
 */
export function recordCompletion(
  progress: PlayerProgress,
  levelId: string,
  moves: number,
  thresholds: StarThresholds,
  /** A ceiling on this solve's stars - Gravity passes 2 when a hint was
   * used, since following hints plays the optimal moves and would
   * otherwise earn a free three. The move count itself is kept honest. */
  maxStars: StarRating = 3,
): PlayerProgress {
  const stars = Math.min(computeStars(moves, thresholds), maxStars) as StarRating;
  const merged = mergeLevelResult(progress.levels[levelId], { stars, moves });

  return {
    ...progress,
    version: PLAYER_PROGRESS_VERSION,
    levels: { ...progress.levels, [levelId]: merged },
  };
}

/** Updates the resume cursor. Pure - returns a new `PlayerProgress`. */
export function setCursor(
  progress: PlayerProgress,
  worldId: string,
  levelId: string,
): PlayerProgress {
  if (progress.cursor?.worldId === worldId && progress.cursor?.levelId === levelId) {
    return progress;
  }
  return { ...progress, cursor: { worldId, levelId } };
}

/** `todayKey`'s calendar day minus one, as the same `YYYY-MM-DD` (UTC) shape. */
function dayBefore(todayKey: string): string {
  const d = new Date(`${todayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isDailyCompleted(progress: PlayerProgress, todayKey: string): boolean {
  return progress.daily.lastCompletedKey === todayKey;
}

/** Whole days from `fromKey` to `toKey` (both `YYYY-MM-DD`, UTC). */
function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  return Math.round((to - from) / 86400000);
}

/** Daily puzzles missed since the last one solved, as of `todayKey` (not
 * counting today itself, which can still be played). */
export function missedDailies(progress: PlayerProgress, todayKey: string): number {
  const last = progress.daily.lastCompletedKey;
  if (last === null) return 0;
  return Math.max(0, daysBetween(last, todayKey) - 1);
}

/**
 * Records today's Daily as solved. Idempotent - completing the same day's
 * Daily again (a replay) leaves the streak untouched. The streak extends by
 * one when yesterday was the last completed day; days missed in between
 * are covered by streak freezes if enough are held (each spent covers one
 * day); otherwise it restarts at one. Pure.
 */
export function recordDaily(progress: PlayerProgress, todayKey: string): PlayerProgress {
  if (isDailyCompleted(progress, todayKey)) return progress;

  const missed = missedDailies(progress, todayKey);
  const continues = progress.daily.lastCompletedKey !== null && progress.daily.streak > 0 && missed <= progress.streakFreezes;
  const streak = continues ? progress.daily.streak + 1 : 1;

  return {
    ...progress,
    daily: { streak, lastCompletedKey: todayKey },
    bestDailyStreak: Math.max(progress.bestDailyStreak, streak),
    streakFreezes: continues ? progress.streakFreezes - missed : progress.streakFreezes,
  };
}

/**
 * The streak to *show* right now, as of `todayKey`. The stored `daily.streak`
 * is only ever touched by `recordDaily`, so a player who stops playing would
 * otherwise carry a stale streak number forever; this reads as broken (0)
 * once a full calendar day has passed with the Daily unplayed, while still
 * showing the live count on the day it was earned and the day after (not
 * yet played today, but the chain isn't broken yet either).
 */
export function getDisplayDailyStreak(progress: PlayerProgress, todayKey: string): number {
  const last = progress.daily.lastCompletedKey;
  if (last === null) return 0;
  if (last === todayKey || last === dayBefore(todayKey)) return progress.daily.streak;
  // Days missed but covered by freezes: still alive, until today is played.
  return missedDailies(progress, todayKey) <= progress.streakFreezes ? progress.daily.streak : 0;
}

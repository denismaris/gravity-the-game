import { StarThresholds } from '../game/levels/level';
import {
  computeStars,
  LevelResult,
  mergeLevelResult,
  StarRating,
} from '../game/scoring';

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
 *
 * This module is pure - it never talks to storage (see `playerProgressStore`).
 */
export interface PlayerProgress {
  readonly version: 4;
  readonly levels: Readonly<Record<string, LevelResult>>;
  readonly cursor: ProgressCursor | null;
  readonly daily: DailyStatus;
  readonly bestDailyStreak: number;
}

export const PLAYER_PROGRESS_VERSION = 4 as const;

export function emptyProgress(): PlayerProgress {
  return {
    version: PLAYER_PROGRESS_VERSION,
    levels: {},
    cursor: null,
    daily: EMPTY_DAILY,
    bestDailyStreak: 0,
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
): PlayerProgress {
  const stars = computeStars(moves, thresholds);
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

/**
 * Records today's Daily as solved. Idempotent - completing the same day's
 * Daily again (a replay) leaves the streak untouched. The streak extends by
 * one when yesterday was the last completed day, and restarts at one
 * otherwise (a fresh start, or a missed day breaking the chain). Pure.
 */
export function recordDaily(progress: PlayerProgress, todayKey: string): PlayerProgress {
  if (isDailyCompleted(progress, todayKey)) return progress;

  const continuesStreak = progress.daily.lastCompletedKey === dayBefore(todayKey);
  const streak = continuesStreak ? progress.daily.streak + 1 : 1;

  return {
    ...progress,
    daily: { streak, lastCompletedKey: todayKey },
    bestDailyStreak: Math.max(progress.bestDailyStreak, streak),
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
  return 0;
}

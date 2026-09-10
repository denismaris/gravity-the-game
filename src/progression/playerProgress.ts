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
 *
 * This module is pure - it never talks to storage (see `playerProgressStore`).
 */
export interface PlayerProgress {
  readonly version: 2;
  readonly levels: Readonly<Record<string, LevelResult>>;
  readonly cursor: ProgressCursor | null;
}

export const PLAYER_PROGRESS_VERSION = 2 as const;

export function emptyProgress(): PlayerProgress {
  return { version: PLAYER_PROGRESS_VERSION, levels: {}, cursor: null };
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

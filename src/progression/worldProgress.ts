import { getStarThresholds, getLevelById } from '../game/levels';
import { puzzleDisplayInfo } from '../game/journey';
import { StarRating } from '../game/scoring';
import { getLevelPositionInWorld, WorldDefinition, WORLDS } from '../game/worlds';
import { BatchPuzzleRef, nextInBatch } from './batches';
import {
  getLevelStars,
  isLevelCompleted,
  PlayerProgress,
} from './playerProgress';

/**
 * Derived world / level progression.
 *
 * Nothing here is stored. Unlock state, per-world summaries and the "current"
 * world/level are all computed from `PlayerProgress.levels` (completions) plus
 * the static `WORLDS` data, every time they are asked for. That keeps a
 * single source of truth - you can never end up with a level that is
 * "unlocked" in storage but locked by the rules, or vice versa.
 *
 * Rules:
 *  - World 1 is always unlocked. World N (N > 1) unlocks once *every* level in
 *    world N-1 is completed.
 *  - The first level of an unlocked world is always unlocked. Every later
 *    level unlocks once the level immediately before it in the same world is
 *    completed.
 *
 * The app has no level-select/browse screen (deliberately - see
 * `src/progression/batches.ts`'s own comment), so nothing currently calls
 * `getWorldSummary`, `getAllWorldSummaries`, `isWorldUnlocked`,
 * `isLevelUnlocked`, `isWorldComplete` (outside achievements) or
 * `getUnlockedWorlds` - only `getLevelPoint` below is live. They are kept,
 * not deleted: they are exactly the derived per-world/per-level unlock
 * data a future level-select or map view would need, already correct and
 * already covered by `worldProgress.test.ts`.
 */

/** Whether every level in `world` has been completed. */
export function isWorldComplete(progress: PlayerProgress, world: WorldDefinition): boolean {
  return world.levelIds.every(id => isLevelCompleted(progress, id));
}

export function isWorldUnlocked(progress: PlayerProgress, world: WorldDefinition): boolean {
  if (world.order <= 1) return true;
  const previous = WORLDS.find(w => w.order === world.order - 1);
  // A gap in world ordering shouldn't lock everything after it forever.
  if (!previous) return true;
  return isWorldComplete(progress, previous);
}

export function isLevelUnlocked(
  progress: PlayerProgress,
  world: WorldDefinition,
  levelId: string,
): boolean {
  const position = getLevelPositionInWorld(world, levelId); // 1-based; 0 if absent
  if (position === 0) return false;
  if (!isWorldUnlocked(progress, world)) return false;
  if (position === 1) return true;

  const previousLevelId = world.levelIds[position - 2];
  return isLevelCompleted(progress, previousLevelId);
}

export interface WorldLevelSummary {
  readonly levelId: string;
  /** 1-based position within the world. */
  readonly position: number;
  readonly name: string;
  readonly unlocked: boolean;
  readonly completed: boolean;
  /** Best stars earned, 0 if never completed. */
  readonly stars: 0 | StarRating;
  /** 3-star / 2-star move thresholds, for showing the target on locked-in levels. */
  readonly starThresholds: { readonly two: number; readonly three: number };
}

export interface WorldSummary {
  readonly worldId: string;
  readonly name: string;
  readonly order: number;
  readonly unlocked: boolean;
  readonly completed: boolean;
  readonly levels: ReadonlyArray<WorldLevelSummary>;
  readonly totalLevels: number;
  readonly completedLevels: number;
  /** Stars earned across this world only. */
  readonly starsEarned: number;
  /** Maximum stars obtainable in this world (3 per level). */
  readonly starsPossible: number;
}

/** Full display model for one world: every level with its unlock/star state. */
export function getWorldSummary(
  progress: PlayerProgress,
  world: WorldDefinition,
): WorldSummary {
  const worldUnlocked = isWorldUnlocked(progress, world);

  const levels: WorldLevelSummary[] = world.levelIds.map((levelId, index) => {
    const level = getLevelById(levelId);
    const completed = isLevelCompleted(progress, levelId);
    const position = index + 1;
    const unlocked =
      worldUnlocked && (position === 1 || isLevelCompleted(progress, world.levelIds[index - 1]));

    return {
      levelId,
      position,
      name: level?.name ?? levelId,
      unlocked,
      completed,
      stars: getLevelStars(progress, levelId),
      starThresholds: level ? getStarThresholds(level) : { two: 0, three: 0 },
    };
  });

  const completedLevels = levels.filter(l => l.completed).length;
  const starsEarned = levels.reduce((sum, l) => sum + l.stars, 0);

  return {
    worldId: world.id,
    name: world.name,
    order: world.order,
    unlocked: worldUnlocked,
    completed: completedLevels === levels.length,
    levels,
    totalLevels: levels.length,
    completedLevels,
    starsEarned,
    starsPossible: levels.length * 3,
  };
}

/** Display model for every world, in map order. */
export function getAllWorldSummaries(progress: PlayerProgress): ReadonlyArray<WorldSummary> {
  return WORLDS.map(world => getWorldSummary(progress, world));
}

export function getUnlockedWorlds(progress: PlayerProgress): ReadonlyArray<WorldDefinition> {
  return WORLDS.filter(world => isWorldUnlocked(progress, world));
}

export interface LevelPointEntry extends BatchPuzzleRef {
  readonly name: string;
  readonly chapter: string;
}

export interface LevelPoint {
  /** "Level N" - the randomized batch this point is inside of. */
  readonly levelNumber: number;
  /** The puzzle the player should play now, from the current batch. */
  readonly entry: LevelPointEntry;
  /** 1-based position of `entry` within its own batch. */
  readonly batchPosition: number;
  /** Total puzzles in the current batch. */
  readonly batchSize: number;
  /** True once every puzzle in the batch is completed - `entry` is then
   * the batch's last puzzle, for replay, while
   * `PlayerProgressProvider` generates the next level's batch. */
  readonly allDone: boolean;
}

/**
 * The "play next" point for the level-batch system (no level select): the
 * first not-yet-completed puzzle in `progress.currentBatch`. Completion is
 * tracked in the same `progress.levels` map for every game, keyed by puzzle
 * id. `progress.currentBatch` is assumed non-null - `PlayerProgressProvider`
 * guarantees a batch has been generated by the time anything reads progress
 * (see its own comment) - so this throws rather than silently fabricating a
 * batch if that invariant is ever broken.
 */
export function getLevelPoint(progress: PlayerProgress): LevelPoint {
  const batch = progress.currentBatch;
  if (!batch) throw new Error('getLevelPoint: no current batch - PlayerProgressProvider should have generated one on load.');

  const next = nextInBatch(batch);
  const allDone = next === null;
  const ref = next ?? batch.puzzles[batch.puzzles.length - 1];
  const batchPosition = batch.puzzles.findIndex(p => p.puzzleId === ref.puzzleId) + 1;

  const info = puzzleDisplayInfo(ref.kind, ref.puzzleId) ?? { name: ref.puzzleId, chapter: '' };

  return {
    levelNumber: batch.levelNumber,
    entry: { kind: ref.kind, puzzleId: ref.puzzleId, name: info.name, chapter: info.chapter },
    batchPosition,
    batchSize: batch.puzzles.length,
    allDone,
  };
}

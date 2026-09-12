import { getStarThresholds, getLevelById } from '../game/levels';
import { JOURNEY, JourneyEntry } from '../game/journey';
import { StarRating } from '../game/scoring';
import {
  getLevelPositionInWorld,
  getNextLevelIdInWorld,
  getWorldForLevel,
  WorldDefinition,
  WORLDS,
} from '../game/worlds';
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

/**
 * Where "continue" should take the player: their stored cursor if it still
 * points at an unlocked level, otherwise the first unlocked level they have
 * not completed, otherwise the very first level. Always returns a playable
 * (world, level) pair.
 */
export function getResumePoint(progress: PlayerProgress): {
  world: WorldDefinition;
  levelId: string;
} {
  const cursor = progress.cursor;
  if (cursor) {
    const world = WORLDS.find(w => w.id === cursor.worldId);
    if (world && isLevelUnlocked(progress, world, cursor.levelId)) {
      return { world, levelId: cursor.levelId };
    }
  }

  for (const world of WORLDS) {
    if (!isWorldUnlocked(progress, world)) continue;
    for (const levelId of world.levelIds) {
      if (isLevelUnlocked(progress, world, levelId) && !isLevelCompleted(progress, levelId)) {
        return { world, levelId };
      }
    }
  }

  return { world: WORLDS[0], levelId: WORLDS[0].levelIds[0] };
}

export interface JourneyPoint {
  /** The journey entry the player should play now (any of the three games). */
  readonly entry: JourneyEntry;
  /** 1-based position in the whole journey. */
  readonly position: number;
  /** Total entries in the journey. */
  readonly total: number;
  /** How many journey entries are completed (across all three games). */
  readonly completedCount: number;
  /** True once every entry is completed - `entry` is then the last one, for replay. */
  readonly allDone: boolean;
  /** The next entry that is a gravity puzzle at or after `position` - the
   * fallback target while the other games have no screen yet. */
  readonly nextGravity: JourneyEntry | null;
}

/**
 * The "play next" point for Journey mode (no level select): the first entry
 * in the interleaved `JOURNEY` that hasn't been completed. Completion is
 * tracked in the same `progress.levels` map for every game, keyed by puzzle
 * id. When everything is done it returns the final entry with `allDone`.
 */
export function getJourneyPoint(progress: PlayerProgress): JourneyPoint {
  const total = JOURNEY.length;

  let index = JOURNEY.findIndex(entry => !isLevelCompleted(progress, entry.puzzleId));
  const allDone = index === -1;
  if (allDone) index = total - 1;

  const entry = JOURNEY[index];
  const completedCount = JOURNEY.filter(e => isLevelCompleted(progress, e.puzzleId)).length;
  const nextGravity =
    JOURNEY.find(e => e.kind === 'gravity' && e.position >= entry.position && !isLevelCompleted(progress, e.puzzleId)) ??
    JOURNEY.filter(e => e.kind === 'gravity').slice(-1)[0] ??
    null;

  return { entry, position: index + 1, total, completedCount, allDone, nextGravity };
}

/**
 * The next level to play after finishing `levelId`: the next level in the
 * same world if there is one and it is now unlocked. Returns `undefined` at
 * the end of a world (the UI falls back to "back to levels").
 */
export function getNextPlayableLevel(
  progress: PlayerProgress,
  levelId: string,
): { world: WorldDefinition; levelId: string } | undefined {
  const world = getWorldForLevel(levelId);
  if (!world) return undefined;

  const nextId = getNextLevelIdInWorld(world, levelId);
  if (!nextId) return undefined;
  if (!isLevelUnlocked(progress, world, nextId)) return undefined;

  return { world, levelId: nextId };
}

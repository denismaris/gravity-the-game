import { getLevelById, LevelDefinition } from '../levels';

/**
 * Gameplay mechanics a world is built around.
 *
 * This is a *declaration*, not an implementation hook - a world lists the
 * mechanics its levels rely on so the level-select UI (and, later, tutorials
 * or filtering) can describe it. Only the mechanics that already exist in the
 * engine are listed here. Future worlds will add entries (`'portals'`,
 * `'gravity-wells'`, ...) to this union *when those mechanics are actually
 * built* - adding one here does not, by itself, make it exist.
 */
export type MechanicId =
  | 'gravity'
  | 'targets'
  | 'obstacles'
  | 'multi-object'
  | 'anchored'
  | 'portals'
  | 'gravity-zone'
  | 'hazard';

/**
 * A world: an ordered group of levels sharing a theme and a mechanic set.
 *
 * Plain, serializable data - exactly like `LevelDefinition`. The 20
 * hand-authored levels are World 1; the shape is designed so a World 2 with a
 * completely different mechanic set is purely more data, no structural
 * change. A world never contains level data itself, only stable level ids
 * (`levelIds`, in play order) that resolve against `LEVELS`.
 */
export interface WorldDefinition {
  /** Stable unique id, e.g. "world-1". Never reuse or renumber. */
  readonly id: string;
  /** 1-based position in the world map. */
  readonly order: number;
  /** Short display name, e.g. "Gravity" (shown as "WORLD 1 — GRAVITY"). */
  readonly name: string;
  /** One-line description for the world header. */
  readonly subtitle?: string;
  /** Mechanics this world's levels use. Declarative only - see `MechanicId`. */
  readonly mechanics: ReadonlyArray<MechanicId>;
  /** Level ids in play order. Every id must resolve against `LEVELS`. */
  readonly levelIds: ReadonlyArray<string>;
}

/**
 * Validates a world's structural invariants: positive order, at least one
 * level, no duplicate level ids, and every referenced level actually exists.
 * Throws a descriptive Error on the first problem - mirrors
 * `assertValidLevel` for level data.
 */
export function assertValidWorld(world: WorldDefinition): void {
  if (world.order <= 0) {
    throw new Error(`World ${world.id}: order must be positive.`);
  }
  if (world.levelIds.length === 0) {
    throw new Error(`World ${world.id}: must contain at least one level.`);
  }
  if (new Set(world.levelIds).size !== world.levelIds.length) {
    throw new Error(`World ${world.id}: contains a duplicate level id.`);
  }
  for (const levelId of world.levelIds) {
    if (!getLevelById(levelId)) {
      throw new Error(`World ${world.id}: references unknown level "${levelId}".`);
    }
  }
}

/** Resolves a world's level ids to their `LevelDefinition`s, in play order. */
export function getWorldLevels(world: WorldDefinition): ReadonlyArray<LevelDefinition> {
  return world.levelIds.map(id => getLevelById(id) as LevelDefinition);
}

/** 1-based position of a level within its world (0 if it isn't in `world`). */
export function getLevelPositionInWorld(world: WorldDefinition, levelId: string): number {
  return world.levelIds.indexOf(levelId) + 1;
}

/** The level id immediately after `levelId` in `world`, or `undefined` if it
 * is the last one (or not in the world). */
export function getNextLevelIdInWorld(
  world: WorldDefinition,
  levelId: string,
): string | undefined {
  const index = world.levelIds.indexOf(levelId);
  if (index === -1) return undefined;
  return world.levelIds[index + 1];
}

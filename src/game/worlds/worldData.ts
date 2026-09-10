import { LEVELS } from '../levels';
import { assertValidWorld, WorldDefinition } from './world';

/** Level ids whose play order falls in `[from, to]`, in ascending order. */
function levelIdsInOrderRange(from: number, to: number): string[] {
  return [...LEVELS]
    .filter(level => level.order >= from && level.order <= to)
    .sort((a, b) => a.order - b.order)
    .map(level => level.id);
}

/**
 * Every world in the game, in map order.
 *
 *  - World 1 - Gravity: the original 20 levels (play order 1-20).
 *  - World 2 - Anchors: 40 levels (play order 21-60) built around the
 *    anchored-object mechanic - 21-30 teach and combine, 31-60 expand it
 *    across six further difficulty tiers.
 *
 * Each world's `levelIds` are derived from `LEVELS` by play-order range
 * (rather than hand-copied) so a world can never drift out of sync with the
 * level pack. A new world is just another entry here with its own
 * `mechanics` and `levelIds` - nothing else in the progression system needs
 * to change. `mechanics` is declarative; `'anchored'` appears now only
 * because the mechanic is actually implemented.
 */
export const WORLDS: ReadonlyArray<WorldDefinition> = [
  {
    id: 'world-1',
    order: 1,
    name: 'Gravity',
    subtitle: 'Learn to fall in every direction.',
    mechanics: ['gravity', 'targets', 'obstacles', 'multi-object'],
    levelIds: levelIdsInOrderRange(1, 20),
  },
  {
    id: 'world-2',
    order: 2,
    name: 'Anchors',
    subtitle: 'Some objects hold their ground.',
    mechanics: ['gravity', 'targets', 'obstacles', 'multi-object', 'anchored'],
    levelIds: levelIdsInOrderRange(21, 60),
  },
];

WORLDS.forEach(assertValidWorld);

/** The first (and, for now, only) world - a convenient default. */
export const FIRST_WORLD = WORLDS[0];

export function getWorldById(id: string): WorldDefinition | undefined {
  return WORLDS.find(world => world.id === id);
}

export function getWorldByOrder(order: number): WorldDefinition | undefined {
  return WORLDS.find(world => world.order === order);
}

/** The world a given level belongs to (`undefined` if no world lists it). */
export function getWorldForLevel(levelId: string): WorldDefinition | undefined {
  return WORLDS.find(world => world.levelIds.includes(levelId));
}

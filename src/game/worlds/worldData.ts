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
 *  - World 3 - Portals: 20 levels (play order 61-80) built around linked
 *    portal cells. No anchored objects here - portals on their own.
 *  - World 4 - Portals & Anchors: 20 levels (play order 81-100) combining
 *    portals with anchored objects (and obstacles / multiple objects).
 *  - World 5 - Gravity Zones: 40 levels (play order 101-140) built around a
 *    region where gravity pulls a different way. 101-110 teach and combine;
 *    111-130 expand the zone on its own (with obstacles and multiple
 *    objects); 131-140 fold the zone together with anchored objects and
 *    portals.
 *  - World 6 - Hazards: 16 levels (play order 141-156) built around a
 *    lethal cell that destroys any object which reaches it - the first
 *    genuine fail state in the game. 141-143 teach it alone; 144-147 combine
 *    it with obstacles/anchors (which now double as safety); 148-150 raise
 *    the stakes with tighter multi-step gauntlets; 151-156 fold in gravity
 *    zones and portals from Worlds 3-5 (a "belt" that carries an object one
 *    cell past its own far edge, into a waiting hazard).
 *
 * Each world's `levelIds` are derived from `LEVELS` by play-order range
 * (rather than hand-copied) so a world can never drift out of sync with the
 * level pack. A new world is just another entry here with its own
 * `mechanics` and `levelIds` - nothing else in the progression system needs
 * to change. `mechanics` is declarative; a mechanic id appears here only
 * once it is actually implemented.
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
  {
    id: 'world-3',
    order: 3,
    name: 'Portals',
    subtitle: 'Go in one side, come out the other.',
    mechanics: ['gravity', 'targets', 'obstacles', 'multi-object', 'portals'],
    levelIds: levelIdsInOrderRange(61, 80),
  },
  {
    id: 'world-4',
    order: 4,
    name: 'Portals & Anchors',
    subtitle: 'Two fixed points, one moving piece.',
    mechanics: ['gravity', 'targets', 'obstacles', 'multi-object', 'anchored', 'portals'],
    levelIds: levelIdsInOrderRange(81, 100),
  },
  {
    id: 'world-5',
    order: 5,
    name: 'Gravity Zones',
    subtitle: 'In this area, down is somewhere else.',
    mechanics: ['gravity', 'targets', 'obstacles', 'multi-object', 'gravity-zone', 'anchored', 'portals'],
    levelIds: levelIdsInOrderRange(101, 140),
  },
  {
    id: 'world-6',
    order: 6,
    name: 'Hazards',
    subtitle: 'One wrong move and it is over.',
    mechanics: ['gravity', 'targets', 'obstacles', 'anchored', 'hazard', 'gravity-zone', 'portals'],
    levelIds: levelIdsInOrderRange(141, 156),
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

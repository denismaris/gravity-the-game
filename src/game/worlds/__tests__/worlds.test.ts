import { LEVELS } from '../../levels';
import {
  assertValidWorld,
  FIRST_WORLD,
  getLevelPositionInWorld,
  getNextLevelIdInWorld,
  getWorldById,
  getWorldByOrder,
  getWorldForLevel,
  getWorldLevels,
  MechanicId,
  WorldDefinition,
  WORLDS,
} from '..';

describe('WORLDS', () => {
  test('there are five worlds, in order', () => {
    expect(WORLDS.map(w => [w.id, w.order, w.name])).toEqual([
      ['world-1', 1, 'Gravity'],
      ['world-2', 2, 'Anchors'],
      ['world-3', 3, 'Portals'],
      ['world-4', 4, 'Portals & Anchors'],
      ['world-5', 5, 'Gravity Zones'],
    ]);
    expect(FIRST_WORLD).toBe(WORLDS[0]);
  });

  test('worlds map to level ranges 1-20, 21-60, 61-80, 81-100, 101-140 in play order', () => {
    const idsInRange = (from: number, to: number) =>
      [...LEVELS]
        .filter(l => l.order >= from && l.order <= to)
        .sort((a, b) => a.order - b.order)
        .map(l => l.id);

    expect(WORLDS[0].levelIds).toEqual(idsInRange(1, 20));
    expect(WORLDS[1].levelIds).toEqual(idsInRange(21, 60));
    expect(WORLDS[2].levelIds).toEqual(idsInRange(61, 80));
    expect(WORLDS[3].levelIds).toEqual(idsInRange(81, 100));
    expect(WORLDS[4].levelIds).toEqual(idsInRange(101, 140));
    expect(WORLDS.map(w => w.levelIds.length)).toEqual([20, 40, 20, 20, 40]);
  });

  test('every world level id resolves and no level belongs to two worlds', () => {
    const seen = new Set<string>();
    for (const world of WORLDS) {
      for (const id of world.levelIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
    expect(seen.size).toBe(LEVELS.length);
  });

  test('worlds only declare mechanics that exist in the engine today', () => {
    const known: MechanicId[] = [
      'gravity',
      'targets',
      'obstacles',
      'multi-object',
      'anchored',
      'portals',
      'gravity-zone',
    ];
    for (const world of WORLDS) {
      for (const mechanic of world.mechanics) {
        expect(known).toContain(mechanic);
      }
    }
    // Each new mechanic is declared only by the world that introduces it.
    expect(WORLDS[0].mechanics).not.toContain('anchored');
    expect(WORLDS[0].mechanics).not.toContain('portals');
    expect(WORLDS[1].mechanics).toContain('anchored');
    expect(WORLDS[1].mechanics).not.toContain('portals');
    expect(WORLDS[2].mechanics).toContain('portals');
    expect(WORLDS[2].mechanics).not.toContain('anchored');
    // World 4 is the first to declare both.
    expect(WORLDS[3].mechanics).toContain('portals');
    expect(WORLDS[3].mechanics).toContain('anchored');
    // World 5 introduces gravity zones; its later bands (131-140) fold in
    // anchored objects and portals as combination content.
    expect(WORLDS[4].mechanics).toContain('gravity-zone');
    expect(WORLDS[4].mechanics).toContain('anchored');
    expect(WORLDS[4].mechanics).toContain('portals');
  });

  test('every world passes structural validation', () => {
    for (const world of WORLDS) {
      expect(() => assertValidWorld(world)).not.toThrow();
    }
  });

  test('assertValidWorld rejects unknown level ids, duplicates and empties', () => {
    const base: WorldDefinition = {
      id: 'world-x',
      order: 2,
      name: 'X',
      mechanics: ['gravity'],
      levelIds: ['level-001', 'level-002'],
    };
    expect(() => assertValidWorld({ ...base, levelIds: [] })).toThrow(/at least one level/);
    expect(() => assertValidWorld({ ...base, levelIds: ['level-001', 'level-001'] })).toThrow(
      /duplicate/,
    );
    expect(() => assertValidWorld({ ...base, levelIds: ['nope'] })).toThrow(/unknown level/);
    expect(() => assertValidWorld({ ...base, order: 0 })).toThrow(/order must be positive/);
  });

  test('lookups by id / order / member level', () => {
    expect(getWorldById('world-1')).toBe(FIRST_WORLD);
    expect(getWorldByOrder(1)).toBe(FIRST_WORLD);
    expect(getWorldById('world-99')).toBeUndefined();
    expect(getWorldForLevel('level-010')).toBe(FIRST_WORLD);
    expect(getWorldForLevel('does-not-exist')).toBeUndefined();
  });

  test('position and next-level helpers', () => {
    expect(getLevelPositionInWorld(FIRST_WORLD, FIRST_WORLD.levelIds[0])).toBe(1);
    expect(getLevelPositionInWorld(FIRST_WORLD, FIRST_WORLD.levelIds[19])).toBe(20);
    expect(getLevelPositionInWorld(FIRST_WORLD, 'not-in-world')).toBe(0);

    expect(getNextLevelIdInWorld(FIRST_WORLD, FIRST_WORLD.levelIds[0])).toBe(FIRST_WORLD.levelIds[1]);
    expect(getNextLevelIdInWorld(FIRST_WORLD, FIRST_WORLD.levelIds[19])).toBeUndefined();
    expect(getNextLevelIdInWorld(FIRST_WORLD, 'not-in-world')).toBeUndefined();
  });

  test('getWorldLevels resolves ids to level definitions in order', () => {
    const levels = getWorldLevels(FIRST_WORLD);
    expect(levels).toHaveLength(20);
    expect(levels.map(l => l.order)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

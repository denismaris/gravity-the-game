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
  test('there are two worlds: 1 - Gravity, 2 - Anchors', () => {
    expect(WORLDS).toHaveLength(2);
    expect(FIRST_WORLD.id).toBe('world-1');
    expect(FIRST_WORLD.order).toBe(1);
    expect(FIRST_WORLD.name).toBe('Gravity');
    expect(WORLDS[1].id).toBe('world-2');
    expect(WORLDS[1].order).toBe(2);
    expect(WORLDS[1].name).toBe('Anchors');
  });

  test('World 1 is levels 1-20, World 2 is levels 21-60, in play order', () => {
    const idsInRange = (from: number, to: number) =>
      [...LEVELS]
        .filter(l => l.order >= from && l.order <= to)
        .sort((a, b) => a.order - b.order)
        .map(l => l.id);

    expect(FIRST_WORLD.levelIds).toEqual(idsInRange(1, 20));
    expect(FIRST_WORLD.levelIds).toHaveLength(20);
    expect(WORLDS[1].levelIds).toEqual(idsInRange(21, 60));
    expect(WORLDS[1].levelIds).toHaveLength(40);
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
    const known: MechanicId[] = ['gravity', 'targets', 'obstacles', 'multi-object', 'anchored'];
    for (const world of WORLDS) {
      for (const mechanic of world.mechanics) {
        expect(known).toContain(mechanic);
      }
    }
    // Only World 2 uses the new anchored mechanic.
    expect(FIRST_WORLD.mechanics).not.toContain('anchored');
    expect(WORLDS[1].mechanics).toContain('anchored');
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

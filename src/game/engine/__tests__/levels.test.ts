import { findShortestSolution } from '../solver';
import { assertValidLevel, createGameStateFromLevel } from '../../levels/level';
import { LEVELS, getLevelById, getLevelByOrder } from '../../levels/levelData';
import { isPuzzleSolved } from '../completion';

const LEVEL_COUNT = 60;

/**
 * Validates the entire hand-authored level pack: structural integrity of
 * every `LevelDefinition`, plus (using the BFS solver) proof that every
 * single level is actually solvable and isn't already solved at move zero.
 *
 * This is what "every level MUST be solvable" and "every level should have
 * a clear logical solution" mean in test form: we don't just trust the
 * hand-authored coordinates, we verify them against the same engine the
 * player uses.
 */
describe('LEVELS (the hand-authored level pack)', () => {
  test(`there are exactly ${LEVEL_COUNT} levels`, () => {
    expect(LEVELS.length).toBe(LEVEL_COUNT);
  });

  test('every level has a unique id', () => {
    const ids = LEVELS.map(level => level.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test(`order values are exactly 1..${LEVEL_COUNT} with no gaps or duplicates`, () => {
    const orders = LEVELS.map(level => level.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1));
  });

  test('getLevelById / getLevelByOrder find every level', () => {
    for (const level of LEVELS) {
      expect(getLevelById(level.id)).toBe(level);
      expect(getLevelByOrder(level.order)).toBe(level);
    }
  });

  test('getLevelById / getLevelByOrder return undefined for unknown lookups', () => {
    expect(getLevelById('does-not-exist')).toBeUndefined();
    expect(getLevelByOrder(9999)).toBeUndefined();
  });

  describe.each(LEVELS.map(level => [level.order, level] as const))('level %i', (_order, level) => {
    test('passes structural validation', () => {
      expect(() => assertValidLevel(level)).not.toThrow();
    });

    test('is not already solved at the starting position', () => {
      const state = createGameStateFromLevel(level);
      expect(isPuzzleSolved(state)).toBe(false);
    });

    test('is solvable, and matches its recorded minMoves', () => {
      const state = createGameStateFromLevel(level);
      const solution = findShortestSolution(state, 30);

      expect(solution).not.toBeNull();

      if (level.metadata?.minMoves !== undefined) {
        expect(solution).not.toBeNull();
        expect((solution as string[]).length).toBe(level.metadata.minMoves);
      }
    });

    test('defines its own three-star thresholds, consistent with minMoves', () => {
      const stars = level.metadata?.stars;
      expect(stars).toBeDefined();
      expect(stars!.three).toBeGreaterThanOrEqual(1);
      expect(stars!.two).toBeGreaterThanOrEqual(stars!.three);

      // You can never out-score the shortest known solution.
      if (level.metadata?.minMoves !== undefined) {
        expect(stars!.three).toBeGreaterThanOrEqual(level.metadata.minMoves);
        // And the optimal path must actually earn all three stars.
        expect(level.metadata.minMoves).toBeLessThanOrEqual(stars!.three);
      }
    });
  });

  test('star thresholds are not one universal rule copy-pasted everywhere', () => {
    const shapes = new Set(
      LEVELS.map(level => `${level.metadata?.stars?.two}:${level.metadata?.stars?.three}`),
    );
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  test('difficulty anchors the progression (first level easy, last expert)', () => {
    const rank = { easy: 0, medium: 1, hard: 2, expert: 3 } as const;
    const sorted = [...LEVELS].sort((a, b) => a.order - b.order);
    expect(rank[sorted[0].difficulty]).toBe(rank.easy);
    expect(rank[sorted[sorted.length - 1].difficulty]).toBe(rank.expert);
  });

  test('World 1 (1-20) has no anchors; every World 2 level (21-60) has at least one', () => {
    for (const level of LEVELS) {
      const anchorCount = level.anchors?.length ?? 0;
      if (level.order <= 20) {
        expect(anchorCount).toBe(0);
      } else {
        expect(anchorCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('the single longest solution in the pack is the last level', () => {
    const hardest = Math.max(...LEVELS.map(level => level.metadata?.minMoves ?? 0));
    const hardestLevels = LEVELS.filter(level => level.metadata?.minMoves === hardest);
    expect(hardestLevels).toHaveLength(1);
    expect(hardestLevels[0].order).toBe(LEVEL_COUNT);
    expect(hardest).toBe(7);
  });

  // ---- World 1 tiers ---------------------------------------------------

  describe('tier 1 (levels 1-5): very easy, no obstacles', () => {
    const tier = LEVELS.filter(level => level.order >= 1 && level.order <= 5);

    test('has exactly 5 levels', () => {
      expect(tier).toHaveLength(5);
    });

    test('every level has exactly one object and zero obstacles', () => {
      for (const level of tier) {
        expect(level.objects).toHaveLength(1);
        expect(level.obstacles).toHaveLength(0);
      }
    });

    test('every level solves in at most 2 moves', () => {
      for (const level of tier) {
        expect(level.metadata?.minMoves ?? Infinity).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('tier 2 (levels 6-10): obstacles and positioning', () => {
    const tier = LEVELS.filter(level => level.order >= 6 && level.order <= 10);

    test('has exactly 5 levels', () => {
      expect(tier).toHaveLength(5);
    });

    test('every level has exactly one object and at least one obstacle', () => {
      for (const level of tier) {
        expect(level.objects).toHaveLength(1);
        expect(level.obstacles.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('tier 3 (levels 11-15): multiple objects', () => {
    const tier = LEVELS.filter(level => level.order >= 11 && level.order <= 15);

    test('has exactly 5 levels', () => {
      expect(tier).toHaveLength(5);
    });

    test('every level has at least two objects', () => {
      for (const level of tier) {
        expect(level.objects.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('tier 4 (levels 16-20): plan several moves ahead', () => {
    const tier = LEVELS.filter(level => level.order >= 16 && level.order <= 20);

    test('has exactly 5 levels', () => {
      expect(tier).toHaveLength(5);
    });

    test('every level requires at least 2 moves to solve', () => {
      for (const level of tier) {
        expect(level.metadata?.minMoves ?? 0).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ---- World 2 tiers (anchored objects) ------------------------------

  describe('tier 5 (levels 21-23): teach anchored objects', () => {
    const tier = LEVELS.filter(level => level.order >= 21 && level.order <= 23);

    test('has exactly 3 levels', () => {
      expect(tier).toHaveLength(3);
    });

    test('every level has one object, at least one anchor, and no obstacles', () => {
      for (const level of tier) {
        expect(level.objects).toHaveLength(1);
        expect(level.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.obstacles).toHaveLength(0);
      }
    });

    test('every level solves in at most 2 moves', () => {
      for (const level of tier) {
        expect(level.metadata?.minMoves ?? Infinity).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('tier 6 (levels 24-26): anchors combined with obstacles', () => {
    const tier = LEVELS.filter(level => level.order >= 24 && level.order <= 26);

    test('has exactly 3 levels', () => {
      expect(tier).toHaveLength(3);
    });

    test('every level has at least one anchor and at least one obstacle', () => {
      for (const level of tier) {
        expect(level.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.obstacles.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('tier 7 (levels 27-30): plan around multiple anchors', () => {
    const tier = LEVELS.filter(level => level.order >= 27 && level.order <= 30);

    test('has exactly 4 levels', () => {
      expect(tier).toHaveLength(4);
    });

    test('every level needs at least 3 moves to solve', () => {
      for (const level of tier) {
        expect(level.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.metadata?.minMoves ?? 0).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // ---- World 2 expansion bands (31-60) -----------------------------

  describe.each([
    ['tier 8 (31-35): trivial combinations', 31, 35, 1, 2],
    ['tier 9 (36-40): read anchor effect', 36, 40, 2, 4],
    ['tier 10 (41-45): multiple objects + anchors', 41, 45, 1, 3],
    ['tier 11 (46-50): plan several moves', 46, 50, 2, 4],
    ['tier 12 (51-55): busier layouts', 51, 55, 2, 5],
    ['tier 13 (56-60): advanced but fair', 56, 60, 3, 7],
  ] as const)('%s', (_label, from, to, minLo, minHi) => {
    const tier = LEVELS.filter(level => level.order >= from && level.order <= to);

    test('has exactly 5 levels', () => {
      expect(tier).toHaveLength(5);
    });

    test('every level uses at least one anchor', () => {
      for (const level of tier) {
        expect(level.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
      }
    });

    test(`every level's solution length is within [${minLo}, ${minHi}]`, () => {
      for (const level of tier) {
        const m = level.metadata?.minMoves ?? 0;
        expect(m).toBeGreaterThanOrEqual(minLo);
        expect(m).toBeLessThanOrEqual(minHi);
      }
    });

    test('the band is non-trivial in aggregate (not all one-move)', () => {
      const total = tier.reduce((sum, l) => sum + (l.metadata?.minMoves ?? 0), 0);
      expect(total).toBeGreaterThan(tier.length);
    });
  });

  test('the World 2 expansion covers a spread of solution lengths, not just "bigger"', () => {
    const band = LEVELS.filter(level => level.order >= 31 && level.order <= 60);
    const lengths = new Set(band.map(l => l.metadata?.minMoves));
    expect(lengths.size).toBeGreaterThanOrEqual(5);
  });
});

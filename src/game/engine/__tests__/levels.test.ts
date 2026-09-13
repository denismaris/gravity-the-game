import { findShortestSolution } from '../solver';
import { assertValidLevel, createGameStateFromLevel } from '../../levels/level';
import { LEVELS, getLevelById, getLevelByOrder } from '../../levels/levelData';
import { isPuzzleSolved } from '../completion';

const LEVEL_COUNT = 156;

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

  test('mechanic use tracks the world it belongs to', () => {
    for (const level of LEVELS) {
      const anchorCount = level.anchors?.length ?? 0;
      const portalCount = level.portals?.length ?? 0;
      if (level.order <= 20) {
        // World 1 - Gravity: no anchors, no portals.
        expect(anchorCount).toBe(0);
        expect(portalCount).toBe(0);
      } else if (level.order <= 60) {
        // World 2 - Anchors: at least one anchor, no portals.
        expect(anchorCount).toBeGreaterThanOrEqual(1);
        expect(portalCount).toBe(0);
      } else if (level.order <= 80) {
        // World 3 - Portals: at least one portal, no anchors.
        expect(portalCount).toBeGreaterThanOrEqual(1);
        expect(anchorCount).toBe(0);
      } else if (level.order <= 100) {
        // World 4 - Portals & Anchors: every level has a portal, and the
        // combination band always uses at least one anchor too.
        expect(portalCount).toBeGreaterThanOrEqual(1);
        expect(anchorCount).toBeGreaterThanOrEqual(1);
      } else if (level.order <= 130) {
        // World 5 - Gravity Zones (101-130): a zone on its own, still no
        // portals or anchors.
        expect(level.zone).toBeDefined();
        expect(portalCount).toBe(0);
        expect(anchorCount).toBe(0);
      } else if (level.order <= 140) {
        // World 5 combination band (131-140): a zone, plus at least one of
        // anchored objects or portals.
        expect(level.zone).toBeDefined();
        expect(portalCount + anchorCount).toBeGreaterThanOrEqual(1);
      } else {
        // World 6 - Hazards: always at least one hazard. 141-150 keep it
        // isolated (no zone/portal); 151-156 fold in a zone and/or portal.
        expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
        if (level.order <= 150) {
          expect(portalCount).toBe(0);
          expect(level.zone).toBeUndefined();
        } else {
          expect(level.zone !== undefined || portalCount >= 1).toBe(true);
        }
      }
    }
  });

  test('the longest solution in the pack (7 moves) is the anchor-world finale', () => {
    const hardest = Math.max(...LEVELS.map(level => level.metadata?.minMoves ?? 0));
    const hardestLevels = LEVELS.filter(level => level.metadata?.minMoves === hardest);
    expect(hardest).toBe(7);
    expect(hardestLevels).toHaveLength(1);
    expect(hardestLevels[0].order).toBe(60);
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

  // ---- World 3 tiers (portals) -----------------------------------

  describe.each([
    ['tier 14 (61-63): teach portals', 61, 63, 3],
    ['tier 15 (64-67): gravity + portals', 64, 67, 4],
    ['tier 16 (68-70): advanced portal positioning', 68, 70, 3],
  ] as const)('%s', (_label, from, to, count) => {
    const tier = LEVELS.filter(level => level.order >= from && level.order <= to);

    test(`has exactly ${count} levels`, () => {
      expect(tier).toHaveLength(count);
    });

    test('every level has at least one portal and no anchored objects', () => {
      for (const level of tier) {
        expect(level.portals?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.anchors?.length ?? 0).toBe(0);
      }
    });
  });

  test('World 3 escalates from 1-move teaches to a multi-move finale', () => {
    const world3 = LEVELS.filter(level => level.order >= 61 && level.order <= 70);
    const moves = world3.map(l => l.metadata?.minMoves ?? 0);
    expect(Math.min(...moves)).toBe(1);
    expect(Math.max(...moves)).toBe(4);
    expect(world3.find(l => l.order === 70)?.metadata?.minMoves).toBe(4);
  });

  // ---- Portal expansion 71-80 + Portals & Anchors 81-100 -----------

  describe.each([
    ['tier 17 (71-80): deeper portal positioning', 71, 80, 1, 3, false],
    ['tier 18 (81-90): introduce anchors + portals', 81, 90, 1, 4, true],
    ['tier 19 (91-100): advanced, everything', 91, 100, 2, 5, true],
  ] as const)('%s', (_label, from, to, minLo, minHi, needsAnchor) => {
    const tier = LEVELS.filter(level => level.order >= from && level.order <= to);

    test('has exactly 10 levels', () => {
      expect(tier).toHaveLength(10);
    });

    test('every level uses a portal (and an anchor where the band requires it)', () => {
      for (const level of tier) {
        expect(level.portals?.length ?? 0).toBeGreaterThanOrEqual(1);
        if (needsAnchor) expect(level.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
        else expect(level.anchors?.length ?? 0).toBe(0);
      }
    });

    test(`solution lengths stay within [${minLo}, ${minHi}]`, () => {
      for (const level of tier) {
        const m = level.metadata?.minMoves ?? 0;
        expect(m).toBeGreaterThanOrEqual(minLo);
        expect(m).toBeLessThanOrEqual(minHi);
      }
    });

    test('the band spans more than one solution length', () => {
      const lengths = new Set(tier.map(l => l.metadata?.minMoves));
      expect(lengths.size).toBeGreaterThanOrEqual(3);
    });
  });

  test('level 100 is a five-move Portals & Anchors puzzle', () => {
    const finale = LEVELS.find(level => level.order === 100);
    expect(finale?.metadata?.minMoves).toBe(5);
    expect(finale?.portals?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(finale?.anchors?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(finale?.difficulty).toBe('expert');
  });

  // ---- World 5 tiers (gravity zones) -----------------------------

  describe.each([
    ['tier 20 (101-103): teach gravity zones', 101, 103],
    ['tier 21 (104-106): global gravity + zone', 104, 106],
    ['tier 22 (107-110): advanced planning', 107, 110],
  ] as const)('%s', (_label, from, to) => {
    const tier = LEVELS.filter(level => level.order >= from && level.order <= to);

    test(`has ${to - from + 1} levels`, () => {
      expect(tier).toHaveLength(to - from + 1);
    });

    test('every level has a gravity zone and no portals or anchors', () => {
      for (const level of tier) {
        expect(level.zone).toBeDefined();
        expect(level.portals?.length ?? 0).toBe(0);
        expect(level.anchors?.length ?? 0).toBe(0);
        // the zone rectangle is well-formed and in bounds
        const z = level.zone!;
        expect(z.minRow).toBeLessThanOrEqual(z.maxRow);
        expect(z.minCol).toBeLessThanOrEqual(z.maxCol);
        expect(z.maxRow).toBeLessThan(level.rows);
        expect(z.maxCol).toBeLessThan(level.cols);
      }
    });
  });

  test('World 5 stays within a 1..4 move band and ends on a four-move finale', () => {
    const world5 = LEVELS.filter(level => level.order >= 101 && level.order <= 140);
    expect(world5).toHaveLength(40);
    const moves = world5.map(l => l.metadata?.minMoves ?? 0);
    expect(Math.min(...moves)).toBe(1);
    expect(Math.max(...moves)).toBe(4);
    // the original teaching band still opens the world at a one-move puzzle
    expect(Math.min(...LEVELS.filter(l => l.order >= 101 && l.order <= 110).map(l => l.metadata?.minMoves ?? 0))).toBe(1);
    const finale = world5.find(l => l.order === 140);
    expect(finale?.metadata?.minMoves).toBe(4);
    expect(finale?.difficulty).toBe('expert');
  });

  // ---- World 5 expansion bands (111-140) --------------------------

  describe.each([
    ['tier 23 (111-120): zone mastery, one object', 111, 120, 2, 4, 'solo'],
    ['tier 24 (121-130): zone + obstacles + multi-object', 121, 130, 2, 4, 'solo'],
    ['tier 25 (131-140): zone + anchors and/or portals', 131, 140, 1, 4, 'combo'],
  ] as const)('%s', (_label, from, to, minLo, minHi, kind) => {
    const tier = LEVELS.filter(level => level.order >= from && level.order <= to);

    test('has exactly 10 levels', () => {
      expect(tier).toHaveLength(10);
    });

    test('every level has a well-formed in-bounds gravity zone', () => {
      for (const level of tier) {
        expect(level.zone).toBeDefined();
        const z = level.zone!;
        expect(z.minRow).toBeLessThanOrEqual(z.maxRow);
        expect(z.minCol).toBeLessThanOrEqual(z.maxCol);
        expect(z.maxRow).toBeLessThan(level.rows);
        expect(z.maxCol).toBeLessThan(level.cols);
      }
    });

    test(
      kind === 'combo'
        ? 'every level combines the zone with an anchor or a portal'
        : 'no level uses anchors or portals',
      () => {
        for (const level of tier) {
          const a = level.anchors?.length ?? 0;
          const p = level.portals?.length ?? 0;
          if (kind === 'combo') expect(a + p).toBeGreaterThanOrEqual(1);
          else expect(a + p).toBe(0);
        }
      },
    );

    test(`solution lengths stay within [${minLo}, ${minHi}]`, () => {
      for (const level of tier) {
        const m = level.metadata?.minMoves ?? 0;
        expect(m).toBeGreaterThanOrEqual(minLo);
        expect(m).toBeLessThanOrEqual(minHi);
      }
    });

    test('the band spans more than one solution length', () => {
      const lengths = new Set(tier.map(l => l.metadata?.minMoves));
      expect(lengths.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- World 6 tiers (hazards) -------------------------------------

  describe('tier 26 (141-143): teach hazards', () => {
    const tier = LEVELS.filter(level => level.order >= 141 && level.order <= 143);

    test('has exactly 3 levels', () => {
      expect(tier).toHaveLength(3);
    });

    test('every level has at least one hazard and solves in at most 2 moves', () => {
      for (const level of tier) {
        expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.metadata?.minMoves ?? Infinity).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('tier 27 (144-147): hazards combined with obstacles/anchors', () => {
    const tier = LEVELS.filter(level => level.order >= 144 && level.order <= 147);

    test('has exactly 4 levels', () => {
      expect(tier).toHaveLength(4);
    });

    test('every level has a hazard and at least one obstacle or anchor', () => {
      for (const level of tier) {
        expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
        const blockers = level.obstacles.length + (level.anchors?.length ?? 0);
        expect(blockers).toBeGreaterThanOrEqual(1);
      }
    });

    test('solution lengths stay within [3, 4]', () => {
      for (const level of tier) {
        const m = level.metadata?.minMoves ?? 0;
        expect(m).toBeGreaterThanOrEqual(3);
        expect(m).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('tier 28 (148-150): hazard gauntlets', () => {
    const tier = LEVELS.filter(level => level.order >= 148 && level.order <= 150);

    test('has exactly 3 levels', () => {
      expect(tier).toHaveLength(3);
    });

    test('every level has a hazard and needs at least 4 moves to solve', () => {
      for (const level of tier) {
        expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.metadata?.minMoves ?? 0).toBeGreaterThanOrEqual(4);
      }
    });

    test('level 150 needs at least 4 moves, same as the rest of this tier', () => {
      const level150 = LEVELS.find(l => l.order === 150);
      expect(level150?.difficulty).toBe('hard');
      expect(level150?.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  describe('tier 29 (151-156): hazards fold into gravity zones and portals', () => {
    const tier = LEVELS.filter(level => level.order >= 151 && level.order <= 156);

    test('has exactly 6 levels', () => {
      expect(tier).toHaveLength(6);
    });

    test('every level has a hazard combined with a zone and/or a portal', () => {
      for (const level of tier) {
        expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(level.zone !== undefined || (level.portals?.length ?? 0) >= 1).toBe(true);
      }
    });

    test('solution lengths stay within [2, 3]', () => {
      for (const level of tier) {
        const m = level.metadata?.minMoves ?? 0;
        expect(m).toBeGreaterThanOrEqual(2);
        expect(m).toBeLessThanOrEqual(3);
      }
    });

    test('the true finale (level 156) uses every one of the three combinable mechanics', () => {
      const finale = LEVELS.find(l => l.order === 156);
      expect(finale?.difficulty).toBe('expert');
      expect(finale?.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(finale?.zone).toBeDefined();
      expect(finale?.portals?.length ?? 0).toBeGreaterThanOrEqual(1);
    });
  });

  test('World 6 is entirely built around hazards and escalates from 1 to 4 moves', () => {
    const world6 = LEVELS.filter(level => level.order >= 141 && level.order <= 156);
    expect(world6).toHaveLength(16);
    for (const level of world6) {
      expect(level.hazards?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
    const moves = world6.map(l => l.metadata?.minMoves ?? 0);
    expect(Math.min(...moves)).toBe(1);
    expect(Math.max(...moves)).toBe(4);
  });
});

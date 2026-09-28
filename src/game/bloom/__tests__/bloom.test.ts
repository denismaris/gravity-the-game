import {
  arcsLeft,
  assertValidBloom,
  BLOOM,
  bloomShapeKey,
  BloomPuzzle,
  countBloomSolutions,
  generateBloom,
  getBloomById,
  initialBloomState,
  isBloomSolved,
  isSolvableByLogic,
  joinedArcs,
  revealBloomHint,
  rotateTile,
  tileArcs,
  tileEnds,
  traceLoops,
} from '..';
import { endlessId } from '../../endlessId';

/** A single circle round the centre of a 2x2 board - the smallest closed
 * loop there is, and the one every arc-only region reduces to. */
const CIRCLE: BloomPuzzle = {
  id: 'bloom-fixture-circle',
  difficulty: 'easy',
  rows: 2,
  cols: 2,
  kinds: [
    ['arc', 'arc'],
    ['arc', 'arc'],
  ],
  // NW cell wraps its SE corner (1), NE wraps SW (2), SW wraps NE (0), SE wraps NW (3).
  solution: [
    [1, 2],
    [0, 3],
  ],
  start: [
    [0, 2],
    [0, 3],
  ],
  pinned: [
    [false, false],
    [false, false],
  ],
};

describe('tiles', () => {
  test('an arc reaches exactly the two edges either side of the corner it wraps', () => {
    expect(tileEnds('arc', 0)).toBe(0b0011); // N + E
    expect(tileEnds('arc', 1)).toBe(0b0110); // E + S
    expect(tileEnds('arc', 2)).toBe(0b1100); // S + W
    expect(tileEnds('arc', 3)).toBe(0b1001); // W + N
    expect(tileEnds('empty', 2)).toBe(0);
    expect(tileEnds('knot', 1)).toBe(0b1111);
  });

  test("a knot's two arcs sit in opposite corners, and a quarter turn swaps the pair", () => {
    expect(tileArcs('knot', 0)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(tileArcs('knot', 1)).toEqual([
      [1, 2],
      [3, 0],
    ]);
  });
});

describe('play', () => {
  test('rotating turns a free arc a quarter clockwise and leaves pinned tiles alone', () => {
    const state = initialBloomState(CIRCLE);
    expect(rotateTile(CIRCLE, state, 0, 0).rotations[0][0]).toBe(1);
    const pinned: BloomPuzzle = { ...CIRCLE, pinned: [[true, false], [false, false]] };
    expect(rotateTile(pinned, state, 0, 0)).toBe(state);
  });

  test('a board is solved exactly when no arc end is left loose', () => {
    const start = initialBloomState(CIRCLE);
    expect(isBloomSolved(CIRCLE, start)).toBe(false);
    expect(arcsLeft(CIRCLE, start)).toBe(1);
    const solved = rotateTile(CIRCLE, start, 0, 0);
    expect(isBloomSolved(CIRCLE, solved)).toBe(true);
    expect(arcsLeft(CIRCLE, solved)).toBe(0);
  });

  test('a closed loop is traced in travel order, and an open chain is not a loop', () => {
    const solved = traceLoops(CIRCLE, { rotations: CIRCLE.solution });
    expect(solved.loops).toHaveLength(1);
    expect(solved.loops[0]).toHaveLength(4);
    expect(solved.looseEnds).toBe(0);
    const open = traceLoops(CIRCLE, initialBloomState(CIRCLE));
    expect(open.loops).toHaveLength(0);
    expect(open.looseEnds).toBeGreaterThan(0);
  });

  test('an arc is joined only when both of its ends meet another line', () => {
    // Start: the NW tile faces away, so it and the two arcs it should meet
    // are loose; the SE arc still meets both of its neighbours.
    const start = joinedArcs(CIRCLE, initialBloomState(CIRCLE));
    expect(start[0][0]).toEqual([false]);
    expect(start[1][1]).toEqual([true]);
    const solved = joinedArcs(CIRCLE, { rotations: CIRCLE.solution });
    expect(solved.flat(2).every(Boolean)).toBe(true);
  });

  test('a hint turns one wrong arc to its place', () => {
    const hint = revealBloomHint(CIRCLE, initialBloomState(CIRCLE))!;
    expect(hint.cell).toEqual({ row: 0, col: 0 });
    expect(isBloomSolved(CIRCLE, hint.state)).toBe(true);
    expect(revealBloomHint(CIRCLE, hint.state)).toBeNull();
  });
});

describe('the shipped pool', () => {
  test('has the expected size per tier, with unique ids', () => {
    expect(BLOOM).toHaveLength(20);
    expect(new Set(BLOOM.map(p => p.id)).size).toBe(BLOOM.length);
  });

  /** Every board: its own solution closes, it has exactly one solution
   * (counted exhaustively), and elimination alone reaches it - the
   * Fill-a-Pix lesson, that uniqueness is not the same as solvable. */
  test.each(BLOOM.map(p => [p.id, p] as const))('%s is fair', (_id, puzzle) => {
    expect(() => assertValidBloom(puzzle)).not.toThrow();
    expect(countBloomSolutions(puzzle, 2)).toBe(1);
    expect(isSolvableByLogic(puzzle)).toBe(true);
    expect(isBloomSolved(puzzle, initialBloomState(puzzle))).toBe(false);
  });

  test('every board has a real blossom in it, not only circles', () => {
    for (const puzzle of BLOOM) {
      const loops = traceLoops(puzzle, { rotations: puzzle.solution }).loops;
      expect(Math.max(...loops.map(loop => loop.length))).toBeGreaterThanOrEqual(8);
    }
  });

  test('generation is deterministic by id (and salt)', () => {
    const shipped = getBloomById('bloom-medium-03')!;
    const again = [0, 1, 2, 3].map(salt => generateBloom('bloom-medium-03', 'Garland', 'medium', salt));
    expect(again).toContainEqual(shipped);
  });

  test('no two boards are the same picture, turned or mirrored', () => {
    const keys = BLOOM.map(bloomShapeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /** Built at import - a slow pool would block every cold start (see the
   * Adjacent history). */
  test('the whole pool builds quickly', () => {
    const started = Date.now();
    for (const puzzle of BLOOM) generateBloom(puzzle.id, puzzle.name ?? '', puzzle.difficulty, 1);
    expect(Date.now() - started).toBeLessThan(300);
  });

  test('endless ids resolve to fair boards', () => {
    const puzzle = getBloomById(endlessId('bloom', 'hard', 4))!;
    expect(puzzle.difficulty).toBe('hard');
    expect(() => assertValidBloom(puzzle)).not.toThrow();
  });
});

import {
  colValues,
  emptyBinairoState,
  hasTripleRun,
  isBinairoSolved,
  isGiven,
  nextValue,
  remainingCells,
  setValue,
} from '../logic';
import { assertValidBinairo, revealHint, solveBinairo } from '../solver';
import { BINAIRO, getBinairoById } from '../puzzles';
import { BinairoPuzzle, BinairoState } from '../types';

/**
 * A hand-verified 4x4 solution, built by rotating the base row `0,0,1,1`
 * (checked *circularly* - including the wrap-around windows (2,3,0) and
 * (3,0,1) - for triple-freedom, which is what guarantees every rotation
 * used as a row, and every resulting column, is independently valid; see
 * `rotateGrid`'s comment in puzzles.ts for the full argument):
 *
 *   0 0 1 1
 *   0 1 1 0
 *   1 1 0 0
 *   1 0 0 1
 *
 * `SIMPLE` blanks only the puzzle's top-left two cells. Row 0 already has
 * two 1s (its full quota), so the quota rule alone forces both blanks to
 * 0 without any backtracking - a clean, fully-traced propagation case.
 */
const SIMPLE_SOLUTION_GRID: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 0, 1, 1],
  [0, 1, 1, 0],
  [1, 1, 0, 0],
  [1, 0, 0, 1],
];
const SIMPLE: BinairoPuzzle = {
  id: 'test-simple',
  size: 4,
  givens: [
    [null, null, 1, 1],
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [1, 0, 0, 1],
  ],
};
const SIMPLE_SOLUTION: BinairoState = { values: SIMPLE_SOLUTION_GRID };

/** A row that already has three equal values placed - an immediate,
 * un-propagatable contradiction, independent of anything else on the
 * board. */
const IMPOSSIBLE: BinairoPuzzle = {
  id: 'test-impossible',
  size: 4,
  givens: [
    [0, 0, 0, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
};

/** A fully blank board - many valid completions exist. */
const UNCLUED: BinairoPuzzle = {
  id: 'test-unclued',
  size: 4,
  givens: [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
};

describe('hasTripleRun', () => {
  test('detects a run of three, ignoring blanks', () => {
    expect(hasTripleRun([0, 0, 0, 1])).toBe(true);
    expect(hasTripleRun([0, 0, 1, 0])).toBe(false);
    expect(hasTripleRun([null, 0, 0])).toBe(false);
    expect(hasTripleRun([1, 1, 0, 1, 1])).toBe(false);
  });
});

describe('isGiven / nextValue / setValue', () => {
  test('cycles blank -> ring (0) -> dot (1) -> blank', () => {
    expect(nextValue(null)).toBe(0);
    expect(nextValue(0)).toBe(1);
    expect(nextValue(1)).toBeNull();
  });

  test('setValue refuses given cells and no-ops', () => {
    const state = emptyBinairoState(SIMPLE);
    expect(isGiven(SIMPLE, 1, 0)).toBe(true);
    expect(setValue(state, SIMPLE, 1, 0, 1)).toBe(state);
    expect(setValue(state, SIMPLE, 0, 0, null)).toBe(state); // already blank
  });

  test('setValue is pure and only touches the target cell', () => {
    const state = emptyBinairoState(SIMPLE);
    const next = setValue(state, SIMPLE, 0, 0, 0);
    expect(next).not.toBe(state);
    expect(next.values[0][0]).toBe(0);
    expect(state.values[0][0]).toBeNull();
  });
});

describe('emptyBinairoState / colValues / remainingCells', () => {
  test('starts from the givens, not from scratch', () => {
    const state = emptyBinairoState(SIMPLE);
    expect(state.values[1]).toEqual([0, 1, 1, 0]);
    expect(state.values[0]).toEqual([null, null, 1, 1]);
  });

  test('colValues reads a column top to bottom', () => {
    expect(colValues(SIMPLE_SOLUTION, 0)).toEqual([0, 0, 1, 1]);
  });

  test('remainingCells counts blanks only', () => {
    expect(remainingCells(emptyBinairoState(SIMPLE))).toBe(2);
    expect(remainingCells(SIMPLE_SOLUTION)).toBe(0);
  });
});

describe('isBinairoSolved', () => {
  test('the real solution solves SIMPLE', () => {
    expect(isBinairoSolved(SIMPLE, SIMPLE_SOLUTION)).toBe(true);
  });

  test('a partially-filled board is not solved', () => {
    expect(isBinairoSolved(SIMPLE, emptyBinairoState(SIMPLE))).toBe(false);
  });

  test('a triple run fails even if the rest of the board is fine', () => {
    const broken: BinairoState = {
      values: [
        [0, 0, 0, 1],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 1, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, broken)).toBe(false);
  });

  test('an unbalanced row fails even with no triple and no duplicate', () => {
    // Row 0 has three 0s and one 1 - no run of three, not a repeat of any
    // other row, but the wrong split for a 4-wide board (needs 2 and 2).
    const unbalanced: BinairoState = {
      values: [
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, unbalanced)).toBe(false);
  });

  test('two identical rows fail even if each is individually valid', () => {
    const duplicateRows: BinairoState = {
      values: [
        [0, 0, 1, 1],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, duplicateRows)).toBe(false);
  });
});

describe('solveBinairo', () => {
  test('finds the unique solution for SIMPLE via quota propagation alone', () => {
    const solutions = solveBinairo(SIMPLE, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(SIMPLE_SOLUTION);
  });

  test('reports no solutions when a triple is already given', () => {
    expect(solveBinairo(IMPOSSIBLE, 1)).toHaveLength(0);
  });

  test('reports multiple solutions for a fully blank board', () => {
    expect(solveBinairo(UNCLUED, 2)).toHaveLength(2);
  });

  test('every solution found independently satisfies the validator (round trip)', () => {
    for (const solution of solveBinairo(UNCLUED, 3)) {
      expect(isBinairoSolved(UNCLUED, solution)).toBe(true);
    }
  });
});

describe('assertValidBinairo', () => {
  test('accepts a well-formed, uniquely-solvable puzzle', () => {
    expect(() => assertValidBinairo(SIMPLE)).not.toThrow();
  });

  test('rejects an unsolvable puzzle', () => {
    expect(() => assertValidBinairo(IMPOSSIBLE)).toThrow(/no solution/);
  });

  test('rejects a non-unique puzzle', () => {
    expect(() => assertValidBinairo(UNCLUED)).toThrow(/not unique/);
  });

  test('rejects an odd size', () => {
    const bad: BinairoPuzzle = { ...SIMPLE, size: 5 };
    expect(() => assertValidBinairo(bad)).toThrow(/even/);
  });

  test('rejects a givens grid with the wrong number of rows', () => {
    const bad: BinairoPuzzle = { ...SIMPLE, givens: SIMPLE.givens.slice(0, 3) };
    expect(() => assertValidBinairo(bad)).toThrow(/rows/);
  });
});

describe('revealHint', () => {
  test('fills the first blank cell (row-major) with the solution value', () => {
    const result = revealHint(emptyBinairoState(SIMPLE), SIMPLE);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.state.values[0][0]).toBe(0);
  });

  test('never touches a wrongly-filled cell - only ever fills blanks', () => {
    const wrong = setValue(emptyBinairoState(SIMPLE), SIMPLE, 0, 0, 1); // solution wants 0
    const result = revealHint(wrong, SIMPLE);
    expect(result!.state.values[0][0]).toBe(1); // left alone
    expect(result!.cell).toEqual({ row: 0, col: 1 }); // next blank instead
  });

  test('returns null once the board is already fully solved', () => {
    expect(revealHint(SIMPLE_SOLUTION, SIMPLE)).toBeNull();
  });
});

describe('the shipped Binairo pool', () => {
  test('every id is unique and resolvable by getBinairoById', () => {
    const ids = BINAIRO.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getBinairoById(id)?.id).toBe(id);
  });

  test('getBinairoById returns undefined for an unknown id', () => {
    expect(getBinairoById('nope')).toBeUndefined();
  });

  test('sizes ramp from 6x6 up to 10x10, all even', () => {
    const sizes = BINAIRO.map(p => p.size);
    expect(Math.min(...sizes)).toBe(6);
    expect(Math.max(...sizes)).toBe(10);
    expect(sizes.every(s => s % 2 === 0)).toBe(true);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  describe.each(BINAIRO.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
    test('is well-formed and uniquely solvable', () => {
      expect(() => assertValidBinairo(puzzle)).not.toThrow();
    });

    test('is not already solved at rest (the givens alone)', () => {
      expect(isBinairoSolved(puzzle, emptyBinairoState(puzzle))).toBe(false);
    });
  });
});

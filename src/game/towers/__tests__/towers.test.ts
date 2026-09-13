import {
  colValues,
  computeConflicts,
  emptyTowersState,
  isColComplete,
  isRowComplete,
  isTowersSolved,
  remainingCells,
  setCell,
  visibleCount,
} from '../logic';
import { assertValidTowers, revealHint, solveTowers } from '../solver';
import { getTowersById, TOWERS } from '../puzzles';
import { TowersPuzzle, TowersState } from '../types';

/**
 * A hand-verified 3x3 Latin square, clues derived by hand for all four
 * sides:
 *
 *   1 2 3       left: 3,2,1     top:    3 2 1
 *   2 3 1       right: 1,2,2    bottom: 1 2 2
 *   3 1 2
 *
 * (left/right scan each row; top/bottom scan each column - see the derivation
 * comment above `SIMPLE` in mirror.test.ts's spirit, verified independently
 * here by tracing each of the 3 rows and 3 columns for local maxima.)
 */
const SIMPLE: TowersPuzzle = {
  id: 'test-simple',
  size: 3,
  topClues: [3, 2, 1],
  bottomClues: [1, 2, 2],
  leftClues: [3, 2, 1],
  rightClues: [1, 2, 2],
};
const SIMPLE_SOLUTION: TowersState = {
  values: [
    [1, 2, 3],
    [2, 3, 1],
    [3, 1, 2],
  ],
};

/** A column clue of `size` (every column strictly increasing downward)
 * demanded for every column at once - impossible, since that would force
 * row 0 to be the smallest value in every column simultaneously. */
const IMPOSSIBLE: TowersPuzzle = {
  id: 'test-impossible',
  size: 3,
  topClues: [3, 3, 3],
  bottomClues: [0, 0, 0],
  leftClues: [0, 0, 0],
  rightClues: [0, 0, 0],
};

/** No clues at all - any 3x3 Latin square is a valid solution, and there is
 * more than one, so this is genuinely ambiguous. */
const UNCLUED: TowersPuzzle = {
  id: 'test-unclued',
  size: 3,
  topClues: [0, 0, 0],
  bottomClues: [0, 0, 0],
  leftClues: [0, 0, 0],
  rightClues: [0, 0, 0],
};

describe('visibleCount', () => {
  test('counts each new local maximum, the first value always visible', () => {
    expect(visibleCount([1, 2, 3])).toBe(3);
    expect(visibleCount([3, 2, 1])).toBe(1);
    expect(visibleCount([2, 3, 1])).toBe(2);
    expect(visibleCount([2, 1, 3])).toBe(2);
  });
});

describe('setCell / colValues / remainingCells', () => {
  test('setCell is pure and only touches the target cell', () => {
    const state = emptyTowersState(SIMPLE);
    const next = setCell(state, 1, 1, 3);
    expect(next).not.toBe(state);
    expect(next.values[1][1]).toBe(3);
    expect(state.values[1][1]).toBe(0);
  });

  test('setCell no-ops when the value is unchanged', () => {
    const state = setCell(emptyTowersState(SIMPLE), 0, 0, 2);
    expect(setCell(state, 0, 0, 2)).toBe(state);
  });

  test('colValues reads a column top to bottom', () => {
    expect(colValues(SIMPLE_SOLUTION, 0)).toEqual([1, 2, 3]);
    expect(colValues(SIMPLE_SOLUTION, 2)).toEqual([3, 1, 2]);
  });

  test('remainingCells counts blanks only', () => {
    expect(remainingCells(emptyTowersState(SIMPLE))).toBe(9);
    expect(remainingCells(SIMPLE_SOLUTION)).toBe(0);
    expect(remainingCells(setCell(emptyTowersState(SIMPLE), 0, 0, 1))).toBe(8);
  });
});

describe('isTowersSolved', () => {
  test('the hand-derived solution solves SIMPLE', () => {
    expect(isTowersSolved(SIMPLE, SIMPLE_SOLUTION)).toBe(true);
  });

  test('an empty board is not solved', () => {
    expect(isTowersSolved(SIMPLE, emptyTowersState(SIMPLE))).toBe(false);
  });

  test('a valid Latin square that violates a clue is not solved', () => {
    // Reverse every row of the real solution: still a valid Latin square,
    // but the visibility counts (and hence the clues) come out different.
    const reversedRows: TowersState = { values: SIMPLE_SOLUTION.values.map(row => [...row].reverse()) };
    expect(isTowersSolved(SIMPLE, reversedRows)).toBe(false);
  });

  test('a repeated value in a row fails even if columns are untouched', () => {
    const broken: TowersState = { values: [[1, 1, 3], [2, 3, 1], [3, 1, 2]] };
    expect(isTowersSolved(SIMPLE, broken)).toBe(false);
  });
});

describe('isRowComplete / isColComplete', () => {
  test('a blank row/column is not complete', () => {
    const empty = emptyTowersState(SIMPLE);
    expect(isRowComplete(SIMPLE, empty, 0)).toBe(false);
    expect(isColComplete(SIMPLE, empty, 0)).toBe(false);
  });

  test('every row and column of the real solution is complete', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(isRowComplete(SIMPLE, SIMPLE_SOLUTION, i)).toBe(true);
      expect(isColComplete(SIMPLE, SIMPLE_SOLUTION, i)).toBe(true);
    }
  });

  test('a full permutation that violates its own row clue is not complete', () => {
    // Row 0 reversed is still {1,2,3}, but its visible-tower counts flip.
    const state: TowersState = { values: [[3, 2, 1], [2, 3, 1], [3, 1, 2]] };
    expect(isRowComplete(SIMPLE, state, 0)).toBe(false);
    // Untouched rows are unaffected by another row's violation.
    expect(isRowComplete(SIMPLE, state, 1)).toBe(true);
  });

  test('a full permutation that violates its own column clue is not complete', () => {
    // Column 0 as {3,2,1} top-to-bottom: a valid permutation, wrong order.
    const violates: TowersState = { values: [[3, 0, 0], [2, 0, 0], [1, 0, 0]] };
    expect(isColComplete(SIMPLE, violates, 0)).toBe(false);

    const matches: TowersState = { values: [[1, 0, 0], [2, 0, 0], [3, 0, 0]] };
    expect(isColComplete(SIMPLE, matches, 0)).toBe(true);
  });

  test('an unclued side never blocks completeness', () => {
    const anyPermutation: TowersState = { values: [[2, 0, 0], [3, 0, 0], [1, 0, 0]] };
    // UNCLUED has no left/right/top/bottom clues at all for any line.
    expect(isColComplete(UNCLUED, anyPermutation, 0)).toBe(true);
  });
});

describe('computeConflicts', () => {
  test('flags a repeated value sharing a row', () => {
    const state: TowersState = { values: [[1, 1, 3], [0, 0, 0], [0, 0, 0]] };
    const conflicts = computeConflicts(state);
    expect(conflicts.has('0:0')).toBe(true);
    expect(conflicts.has('0:1')).toBe(true);
    expect(conflicts.has('0:2')).toBe(false);
  });

  test('flags a repeated value sharing a column', () => {
    const state: TowersState = { values: [[2, 0, 0], [2, 0, 0], [0, 0, 0]] };
    const conflicts = computeConflicts(state);
    expect(conflicts.has('0:0')).toBe(true);
    expect(conflicts.has('1:0')).toBe(true);
  });

  test('a correctly-placed board has no conflicts', () => {
    expect(computeConflicts(SIMPLE_SOLUTION).size).toBe(0);
  });

  test('blanks never count as conflicting with each other', () => {
    expect(computeConflicts(emptyTowersState(SIMPLE)).size).toBe(0);
  });
});

describe('solveTowers', () => {
  test('finds the unique, hand-verified solution for SIMPLE', () => {
    const solutions = solveTowers(SIMPLE, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(SIMPLE_SOLUTION);
  });

  test('reports no solutions when a clue is impossible to satisfy', () => {
    expect(solveTowers(IMPOSSIBLE, 1)).toHaveLength(0);
  });

  test('reports multiple solutions for a fully unclued board', () => {
    expect(solveTowers(UNCLUED, 2)).toHaveLength(2);
  });

  test('every solution found independently satisfies the validator (round trip)', () => {
    for (const solution of solveTowers(UNCLUED, 3)) {
      expect(isTowersSolved(UNCLUED, solution)).toBe(true);
    }
  });
});

describe('assertValidTowers', () => {
  test('accepts a well-formed, uniquely-solvable puzzle', () => {
    expect(() => assertValidTowers(SIMPLE)).not.toThrow();
  });

  test('rejects an unsolvable puzzle', () => {
    expect(() => assertValidTowers(IMPOSSIBLE)).toThrow(/no solution/);
  });

  test('rejects a non-unique puzzle', () => {
    expect(() => assertValidTowers(UNCLUED)).toThrow(/not unique/);
  });

  test('rejects a clue array of the wrong length', () => {
    const bad: TowersPuzzle = { ...SIMPLE, topClues: [1, 2] };
    expect(() => assertValidTowers(bad)).toThrow(/topClues/);
  });

  test('rejects an out-of-range clue', () => {
    const bad: TowersPuzzle = { ...SIMPLE, leftClues: [4, 2, 1] };
    expect(() => assertValidTowers(bad)).toThrow(/out-of-range/);
  });
});

describe('revealHint', () => {
  test('fills the first blank cell (row-major) with the solution value', () => {
    const result = revealHint(emptyTowersState(SIMPLE), SIMPLE);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.state.values[0][0]).toBe(1);
  });

  test('never touches a wrongly-filled cell - only ever fills blanks', () => {
    const wrong = setCell(emptyTowersState(SIMPLE), 0, 0, 3); // solution wants 1
    const result = revealHint(wrong, SIMPLE);
    expect(result!.state.values[0][0]).toBe(3); // left alone
    expect(result!.cell).toEqual({ row: 0, col: 1 }); // next blank instead
  });

  test('returns null once the board is already fully solved', () => {
    expect(revealHint(SIMPLE_SOLUTION, SIMPLE)).toBeNull();
  });
});

describe('the shipped Skyscrapers pool', () => {
  test('every id is unique and resolvable by getTowersById', () => {
    const ids = TOWERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getTowersById(id)?.id).toBe(id);
  });

  test('getTowersById returns undefined for an unknown id', () => {
    expect(getTowersById('nope')).toBeUndefined();
  });

  test('sizes are only 4 or 5, ramping from 4 up to 5', () => {
    const sizes = TOWERS.map(p => p.size);
    expect(new Set(sizes)).toEqual(new Set([4, 5]));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  describe.each(TOWERS.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
    test('is well-formed and uniquely solvable', () => {
      expect(() => assertValidTowers(puzzle)).not.toThrow();
    });

    test('is not already solved at rest (an empty board)', () => {
      expect(isTowersSolved(puzzle, emptyTowersState(puzzle))).toBe(false);
    });
  });
});

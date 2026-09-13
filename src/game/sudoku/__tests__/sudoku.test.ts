import {
  SUDOKUS,
  SudokuPuzzle,
  SudokuState,
  assertValidSudoku,
  computeConflicts,
  emptySudokuState,
  getSudokuById,
  isGiven,
  isSudokuSolved,
  remainingCells,
  revealHint,
  setCell,
  solveSudoku,
} from '..';

const puzzle = SUDOKUS[0];

/** A tiny, deliberately near-empty puzzle for logic tests that don't need a
 * real 46-given board - most of an actual solved grid, with the corner left
 * open so there's exactly one blank to reason about. */
const ALMOST_DONE: SudokuPuzzle = {
  id: 'test-almost-done',
  givens: [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 0],
  ],
};

function fillCell(state: SudokuState, r: number, c: number, v: number): SudokuState {
  const values = state.values.map((row, rr) => (rr === r ? row.map((x, cc) => (cc === c ? v : x)) : row));
  return { values } as SudokuState;
}

describe('board logic', () => {
  test('emptySudokuState starts equal to the givens', () => {
    const state = emptySudokuState(puzzle);
    expect(state.values).toEqual(puzzle.givens);
  });

  test('isGiven identifies pre-filled cells only', () => {
    expect(isGiven(puzzle, 0, 0)).toBe(true); // '8' in Warm-Up
    expect(isGiven(puzzle, 0, 1)).toBe(false); // '.' in Warm-Up
  });

  test('setCell fills a blank, non-given cell', () => {
    const s0 = emptySudokuState(puzzle);
    const s1 = setCell(s0, puzzle, 0, 1, 2);
    expect(s1.values[0][1]).toBe(2);
    expect(s0.values[0][1]).toBe(0); // pure - s0 untouched
  });

  test('setCell refuses to edit a given cell', () => {
    const s0 = emptySudokuState(puzzle);
    expect(setCell(s0, puzzle, 0, 0, 9)).toBe(s0);
  });

  test('setCell is a no-op out of bounds or for an unchanged value', () => {
    const s0 = emptySudokuState(puzzle);
    expect(setCell(s0, puzzle, -1, 0, 1)).toBe(s0);
    expect(setCell(s0, puzzle, 0, 9, 1)).toBe(s0);
    const s1 = setCell(s0, puzzle, 0, 1, 2);
    expect(setCell(s1, puzzle, 0, 1, 2)).toBe(s1);
  });

  test('setCell can clear a cell back to blank', () => {
    const s0 = emptySudokuState(puzzle);
    const s1 = setCell(s0, puzzle, 0, 1, 2);
    const s2 = setCell(s1, puzzle, 0, 1, 0);
    expect(s2.values[0][1]).toBe(0);
  });

  test('computeConflicts is empty on a fully correct grid', () => {
    const state = emptySudokuState(ALMOST_DONE);
    const filled = fillCell(state, 8, 8, 9);
    expect(computeConflicts(filled)).toEqual(new Set());
  });

  test('computeConflicts flags a row duplicate', () => {
    const state = emptySudokuState(ALMOST_DONE);
    // Row 8 is "3 4 5 2 8 6 1 7 _" - putting a 3 in the blank duplicates
    // the 3 already at (8,0).
    const bad = fillCell(state, 8, 8, 3);
    const conflicts = computeConflicts(bad);
    expect(conflicts.has('8:8')).toBe(true);
    expect(conflicts.has('8:0')).toBe(true);
  });

  test('computeConflicts flags a column duplicate', () => {
    const state = emptySudokuState(ALMOST_DONE);
    // Column 8 already has a 2 at row 0; putting 2 at (8,8) duplicates it.
    const bad = fillCell(state, 8, 8, 2);
    const conflicts = computeConflicts(bad);
    expect(conflicts.has('8:8')).toBe(true);
    expect(conflicts.has('0:8')).toBe(true);
  });

  test('computeConflicts flags a box duplicate (same box, different row and column)', () => {
    const blank: SudokuPuzzle = {
      id: 'test-blank',
      givens: Array.from({ length: 9 }, () => Array(9).fill(0)) as SudokuPuzzle['givens'],
    };
    let state = emptySudokuState(blank);
    state = fillCell(state, 0, 0, 5);
    state = fillCell(state, 1, 1, 5); // same top-left box, different row and column
    const conflicts = computeConflicts(state);
    expect(conflicts.has('0:0')).toBe(true);
    expect(conflicts.has('1:1')).toBe(true);
  });

  test('a blank cell never conflicts', () => {
    const state = emptySudokuState(ALMOST_DONE);
    expect(computeConflicts(state).has('8:8')).toBe(false);
  });

  test('isSudokuSolved is false while blanks remain', () => {
    expect(isSudokuSolved(emptySudokuState(puzzle))).toBe(false);
  });

  test('isSudokuSolved is false when full but conflicting', () => {
    const state = emptySudokuState(ALMOST_DONE);
    const bad = fillCell(state, 8, 8, 3);
    expect(isSudokuSolved(bad)).toBe(false);
  });

  test('isSudokuSolved is true when full and valid', () => {
    const state = emptySudokuState(ALMOST_DONE);
    const done = fillCell(state, 8, 8, 9);
    expect(isSudokuSolved(done)).toBe(true);
  });

  test('remainingCells counts down to zero', () => {
    const state = emptySudokuState(ALMOST_DONE);
    expect(remainingCells(state)).toBe(1);
    expect(remainingCells(fillCell(state, 8, 8, 9))).toBe(0);
  });
});

describe('solveSudoku / revealHint', () => {
  test('the solver fills every cell and satisfies every given', () => {
    const [solution] = solveSudoku(puzzle, 1);
    expect(solution).toBeDefined();
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const given = puzzle.givens[r][c];
        if (given !== 0) expect(solution[r][c]).toBe(given);
      }
    }
    const state: SudokuState = { values: solution };
    expect(isSudokuSolved(state)).toBe(true);
  });

  test('revealHint fills exactly the solved value for the almost-done puzzle', () => {
    const state = emptySudokuState(ALMOST_DONE);
    const hint = revealHint(state, ALMOST_DONE);
    expect(hint).not.toBeNull();
    expect(hint!.cell).toEqual({ row: 8, col: 8 });
    expect(hint!.state.values[8][8]).toBe(9);
    expect(isSudokuSolved(hint!.state)).toBe(true);
  });

  test('revealHint never touches a given, and repeated calls finish the board', () => {
    let state = emptySudokuState(puzzle);
    let guard = 82;
    while (!isSudokuSolved(state) && guard > 0) {
      const hint = revealHint(state, puzzle);
      expect(hint).not.toBeNull();
      state = hint!.state;
      guard -= 1;
    }
    expect(isSudokuSolved(state)).toBe(true);
    expect(revealHint(state, puzzle)).toBeNull();
  });
});

describe('assertValidSudoku', () => {
  test('accepts every authored puzzle', () => {
    expect(() => assertValidSudoku(puzzle)).not.toThrow();
  });

  test('rejects a grid that is not 9x9', () => {
    expect(() => assertValidSudoku({ id: 'x', givens: [[1]] } as unknown as SudokuPuzzle)).toThrow(
      /9x9/,
    );
  });

  test('rejects an out-of-range value', () => {
    const bad: SudokuPuzzle = { id: 'x', givens: ALMOST_DONE.givens.map(r => [...r]) };
    (bad.givens as number[][])[0][0] = 10;
    expect(() => assertValidSudoku(bad)).toThrow(/not a digit/);
  });

  test('rejects givens that conflict with each other', () => {
    const bad: SudokuPuzzle = { id: 'x', givens: ALMOST_DONE.givens.map(r => [...r]) };
    (bad.givens as number[][])[8][8] = 5; // (8,0) is already 5 - same row
    expect(() => assertValidSudoku(bad)).toThrow(/conflicts with another given/);
  });

  test('rejects fewer than 17 givens', () => {
    const sparse: SudokuPuzzle = {
      id: 'x',
      givens: Array.from({ length: 9 }, () => Array(9).fill(0)) as SudokuPuzzle['givens'],
    };
    expect(() => assertValidSudoku(sparse)).toThrow(/never unique/);
  });

  test('rejects an unsolvable grid', () => {
    // A grid with 0 blanks and a genuine unresolved conflict has no
    // solution at all (not just "ambiguous").
    const rows = ALMOST_DONE.givens.map(r => [...r]);
    rows[8][8] = 9; // now fully filled and internally valid...
    rows[7][8] = 9; // ...until this duplicates it in the same column
    const bad: SudokuPuzzle = { id: 'x', givens: rows as SudokuPuzzle['givens'] };
    expect(() => assertValidSudoku(bad)).toThrow(/conflicts with another given/);
  });

  test('rejects an ambiguous (non-unique) puzzle', () => {
    // A classic "swap rectangle": (0,3)/(3,4) hold 6 and (0,4)/(3,3) hold 7
    // in the solved grid: opening exactly those four cells means the 6s and
    // 7s can trade places (6 7 / 7 6 vs. 7 6 / 6 7) without either value
    // repeating in any row, column or box either way - two genuinely valid
    // completions of the same givens.
    const rows = ALMOST_DONE.givens.map(r => [...r]);
    rows[8][8] = 9; // fill the one real blank so the grid is a genuine solution
    rows[0][3] = 0;
    rows[0][4] = 0;
    rows[3][3] = 0;
    rows[3][4] = 0;
    const ambiguous: SudokuPuzzle = { id: 'x', givens: rows as SudokuPuzzle['givens'] };
    expect(() => assertValidSudoku(ambiguous)).toThrow(/ambiguous/);
  });
});

describe('the authored Sudoku pack', () => {
  test('ids are unique and resolvable', () => {
    const ids = SUDOKUS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SUDOKUS) expect(getSudokuById(p.id)).toBe(p);
  });

  test('getSudokuById returns undefined for an unknown id', () => {
    expect(getSudokuById('does-not-exist')).toBeUndefined();
  });

  describe.each(SUDOKUS.map(p => [p.id, p] as const))('%s', (_id, p) => {
    test('is well-formed and has a unique solution', () => {
      expect(() => assertValidSudoku(p)).not.toThrow();
    });

    test('is not already solved at the starting position', () => {
      expect(isSudokuSolved(emptySudokuState(p))).toBe(false);
    });
  });

  test('the pack actually ramps up in difficulty (fewer givens later)', () => {
    const counts = SUDOKUS.map(p => p.givens.flat().filter(v => v !== 0).length);
    expect(counts[0]).toBeGreaterThan(counts[counts.length - 1]);
    // Monotonic isn't required, but the overall spread should be real.
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThanOrEqual(15);
  });
});

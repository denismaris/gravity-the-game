import { BOX_SIZE, SIZE, SudokuCell, SudokuPuzzle, SudokuState, SudokuValue } from './types';

type Grid = SudokuValue[][];

function canPlace(grid: Grid, row: number, col: number, value: SudokuValue): boolean {
  for (let i = 0; i < SIZE; i += 1) {
    if (grid[row][i] === value || grid[i][col] === value) return false;
  }
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = boxRow; r < boxRow + BOX_SIZE; r += 1) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c += 1) {
      if (grid[r][c] === value) return false;
    }
  }
  return true;
}

interface Candidate {
  readonly row: number;
  readonly col: number;
  readonly options: ReadonlyArray<SudokuValue>;
}

/** The blank cell with the fewest legal values (classic "most constrained
 * first" ordering) - keeps plain backtracking fast on a 9x9 grid without
 * needing anything fancier. `null` once the grid has no blanks left. */
function mostConstrainedBlank(grid: Grid): Candidate | null {
  let best: Candidate | null = null;

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] !== 0) continue;

      const options: SudokuValue[] = [];
      for (let v = 1; v <= 9; v += 1) {
        if (canPlace(grid, r, c, v as SudokuValue)) options.push(v as SudokuValue);
      }
      if (!best || options.length < best.options.length) {
        best = { row: r, col: c, options };
        if (options.length === 0) return best; // dead end - can't do better than this
      }
    }
  }

  return best;
}

/**
 * Backtracking Sudoku solver, seeded from `puzzle.givens`. Returns up to
 * `limit` complete solutions (default 1) - pass 2 to distinguish "unique"
 * from "ambiguous", the same convention `solveConstellation` uses.
 */
export function solveSudoku(puzzle: SudokuPuzzle, limit = 1): SudokuValue[][][] {
  const grid: Grid = puzzle.givens.map(row => [...row]);
  const solutions: SudokuValue[][][] = [];

  const dfs = (): void => {
    if (solutions.length >= limit) return;

    const next = mostConstrainedBlank(grid);
    if (!next) {
      solutions.push(grid.map(row => [...row]));
      return;
    }

    const { row, col, options } = next;
    for (const value of options) {
      grid[row][col] = value;
      dfs();
      grid[row][col] = 0;
      if (solutions.length >= limit) return;
    }
  };

  dfs();
  return solutions;
}

/**
 * Throws unless `puzzle` is well-formed AND has exactly one solution. Run
 * over every authored puzzle in tests, exactly like
 * `assertValidConstellation`.
 */
export function assertValidSudoku(puzzle: SudokuPuzzle): void {
  const { id, givens } = puzzle;

  if (givens.length !== SIZE || givens.some(row => row.length !== SIZE)) {
    throw new Error(`Sudoku ${id}: givens must be a ${SIZE}x${SIZE} grid.`);
  }
  for (const row of givens) {
    for (const v of row) {
      if (v < 0 || v > 9 || !Number.isInteger(v)) {
        throw new Error(`Sudoku ${id}: value ${v} is not a digit 0-9.`);
      }
    }
  }

  // The givens must not already break their own row/column/box.
  const grid: Grid = givens.map(row => [...row]);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const v = grid[r][c];
      if (v === 0) continue;
      grid[r][c] = 0;
      const ok = canPlace(grid, r, c, v);
      grid[r][c] = v;
      if (!ok) throw new Error(`Sudoku ${id}: given ${v} at (${r}, ${c}) conflicts with another given.`);
    }
  }

  const givenCount = grid.flat().filter(v => v !== 0).length;
  if (givenCount < 17) {
    // A Sudoku needs at least 17 clues to ever have a unique solution -
    // below that it's provably ambiguous, no need to even run the solver.
    throw new Error(`Sudoku ${id}: only ${givenCount} givens - below 17, never unique.`);
  }

  const solutions = solveSudoku(puzzle, 2);
  if (solutions.length === 0) throw new Error(`Sudoku ${id}: has no solution.`);
  if (solutions.length > 1) throw new Error(`Sudoku ${id}: clues are ambiguous (more than one solution).`);
}

/**
 * Solver-backed hint: fills the first still-blank cell (row-major) with the
 * puzzle's true answer for it. Always solves from the puzzle's own
 * `givens` (never the player's current, possibly-wrong, entries), so a
 * mistake elsewhere on the board never breaks or mis-directs a hint.
 * Returns `null` once every cell is already filled.
 */
export function revealHint(
  state: SudokuState,
  puzzle: SudokuPuzzle,
): { state: SudokuState; cell: SudokuCell } | null {
  const [solution] = solveSudoku(puzzle, 1);
  if (!solution) return null;

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (state.values[r][c] !== 0) continue;
      const value = solution[r][c];
      const values = state.values.map((line, rr) =>
        rr === r ? line.map((v, cc) => (cc === c ? value : v)) : line,
      );
      return { state: { values }, cell: { row: r, col: c } };
    }
  }

  return null;
}

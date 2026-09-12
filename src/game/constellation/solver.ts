import { runsOf } from './clues';
import { ConstellationPuzzle } from './types';

/**
 * Every way a single line of `width` cells can satisfy `clue`
 * (its run lengths). Used to author-check puzzles for a unique solution -
 * an ambiguous nonogram is a bad nonogram.
 */
export function rowCandidates(width: number, clue: ReadonlyArray<number>): boolean[][] {
  if (clue.length === 0) return [new Array(width).fill(false)];

  const results: boolean[][] = [];
  const suffixMin: number[] = new Array(clue.length + 1).fill(0);
  for (let i = clue.length - 1; i >= 0; i -= 1) {
    suffixMin[i] = clue[i] + (i === clue.length - 1 ? 0 : 1) + suffixMin[i + 1];
  }

  const place = (index: number, minStart: number, starts: number[]): void => {
    if (index === clue.length) {
      const row = new Array(width).fill(false);
      for (let i = 0; i < clue.length; i += 1) {
        for (let k = 0; k < clue[i]; k += 1) row[starts[i] + k] = true;
      }
      results.push(row);
      return;
    }
    for (let start = minStart; start + suffixMin[index] <= width; start += 1) {
      place(index + 1, start + clue[index] + 1, [...starts, start]);
    }
  };

  place(0, 0, []);
  return results;
}

/** Whether a column's cells so far could still complete to `target`. */
function columnFeasible(
  colBits: boolean[],
  target: ReadonlyArray<number>,
  rowsTotal: number,
): boolean {
  const placedFilled = colBits.reduce((n, on) => n + (on ? 1 : 0), 0);
  const need = target.reduce((a, b) => a + b, 0);
  const remainingRows = rowsTotal - colBits.length;
  if (need - placedFilled > remainingRows) return false;
  if (placedFilled > need) return false;

  const runs = runsOf(colBits);
  const runInProgress = colBits.length > 0 && colBits[colBits.length - 1];

  if (colBits.length === rowsTotal) {
    return runs.length === target.length && runs.every((n, i) => n === target[i]);
  }

  if (runs.length === 0) return true;
  if (runs.length > target.length) return false;

  const settled = runInProgress ? runs.length - 1 : runs.length;
  for (let i = 0; i < settled; i += 1) {
    if (runs[i] !== target[i]) return false;
  }
  if (runInProgress) {
    const last = runs[runs.length - 1];
    if (last > target[runs.length - 1]) return false;
  }
  return true;
}

/**
 * Solutions to `puzzle`, capped at `limit` (default 2 - enough to tell
 * "unique" from "ambiguous"). DFS row by row over `rowCandidates`, pruning
 * against the column clues after every placement.
 */
export function solveConstellation(puzzle: ConstellationPuzzle, limit = 2): boolean[][][] {
  const { rows, cols, rowClues, colClues } = puzzle;
  const candidatesPerRow = rowClues.map(clue => rowCandidates(cols, clue));
  const solutions: boolean[][][] = [];
  const grid: boolean[][] = [];

  const dfs = (r: number): void => {
    if (solutions.length >= limit) return;
    if (r === rows) {
      solutions.push(grid.map(line => line.slice()));
      return;
    }
    for (const candidate of candidatesPerRow[r]) {
      grid.push(candidate);
      let ok = true;
      for (let c = 0; c < cols && ok; c += 1) {
        const colBits = grid.map(line => line[c]);
        if (!columnFeasible(colBits, colClues[c], rows)) ok = false;
      }
      if (ok) dfs(r + 1);
      grid.pop();
      if (solutions.length >= limit) return;
    }
  };

  dfs(0);
  return solutions;
}

/**
 * Throws unless `puzzle` is well-formed AND has exactly one solution, which
 * must equal its stated `solution`. Run over every authored puzzle in tests.
 */
export function assertValidConstellation(puzzle: ConstellationPuzzle): void {
  const { id, rows, cols, solution } = puzzle;
  if (rows <= 0 || cols <= 0) throw new Error(`Constellation ${id}: rows/cols must be positive.`);
  if (solution.length !== rows) throw new Error(`Constellation ${id}: solution has ${solution.length} rows, expected ${rows}.`);
  if (solution.some(row => row.length !== cols)) {
    throw new Error(`Constellation ${id}: solution is not rectangular ${rows}x${cols}.`);
  }
  if (!solution.some(row => row.some(Boolean))) {
    throw new Error(`Constellation ${id}: solution is empty - nothing to reveal.`);
  }

  const solutions = solveConstellation(puzzle, 2);
  if (solutions.length === 0) throw new Error(`Constellation ${id}: clues have no solution.`);
  if (solutions.length > 1) throw new Error(`Constellation ${id}: clues are ambiguous (more than one solution).`);

  const found = solutions[0];
  const matches = found.every((line, r) => line.every((on, c) => on === solution[r][c]));
  if (!matches) throw new Error(`Constellation ${id}: the unique solution does not match the stated picture.`);
}

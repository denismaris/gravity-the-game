import { TowersCell, TowersPuzzle, TowersState } from './types';
import { setCell, visibleCount } from './logic';

type WorkingGrid = number[][];

function cloneGrid(grid: WorkingGrid): WorkingGrid {
  return grid.map(row => row.slice());
}

function checkRowClues(puzzle: TowersPuzzle, grid: WorkingGrid, row: number): boolean {
  const line = grid[row];
  if (puzzle.leftClues[row] !== 0 && visibleCount(line) !== puzzle.leftClues[row]) return false;
  if (puzzle.rightClues[row] !== 0 && visibleCount([...line].reverse()) !== puzzle.rightClues[row]) return false;
  return true;
}

function checkColumnClues(puzzle: TowersPuzzle, grid: WorkingGrid): boolean {
  for (let c = 0; c < puzzle.size; c += 1) {
    const col = grid.map(row => row[c]);
    if (puzzle.topClues[c] !== 0 && visibleCount(col) !== puzzle.topClues[c]) return false;
    if (puzzle.bottomClues[c] !== 0 && visibleCount([...col].reverse()) !== puzzle.bottomClues[c]) return false;
  }
  return true;
}

/**
 * Searches for up to `limit` valid grids (pass 2 to check for ambiguity,
 * mirroring `solveSudoku`/`solveMirrorMaze`'s `limit` parameter).
 *
 * Fills row-major, only trying values not already used in that row or
 * column. The instant a row is completely filled, its own left/right clues
 * are checked immediately and the branch is abandoned on failure without
 * filling further rows - this is the concrete pruning the "staged clue-
 * checking" design calls for, not just plain backtracking. Column clues
 * (top/bottom) can only be checked once the *entire* grid is filled, since
 * a column never completes early under row-major fill - they're checked
 * once, at the end.
 */
export function solveTowers(puzzle: TowersPuzzle, limit = 1): ReadonlyArray<TowersState> {
  const n = puzzle.size;
  const grid: WorkingGrid = Array.from({ length: n }, () => new Array(n).fill(0));
  const solutions: TowersState[] = [];

  function dfs(row: number, col: number): void {
    if (solutions.length >= limit) return;

    if (row === n) {
      if (checkColumnClues(puzzle, grid)) solutions.push({ values: cloneGrid(grid) });
      return;
    }
    const [nextRow, nextCol] = col === n - 1 ? [row + 1, 0] : [row, col + 1];

    const usedInRow = new Set(grid[row].slice(0, col));
    const usedInCol = new Set<number>();
    for (let r = 0; r < row; r += 1) usedInCol.add(grid[r][col]);

    for (let value = 1; value <= n; value += 1) {
      if (usedInRow.has(value) || usedInCol.has(value)) continue;

      grid[row][col] = value;
      if (col === n - 1 && !checkRowClues(puzzle, grid, row)) {
        grid[row][col] = 0;
        continue;
      }

      dfs(nextRow, nextCol);
      grid[row][col] = 0;
      if (solutions.length >= limit) return;
    }
  }

  dfs(0, 0);
  return solutions;
}

/**
 * Validates a hand-authored puzzle: structurally well-formed (every clue
 * array has exactly `size` entries, every clue is in `[0, size]`), and
 * solvable with a *unique* solution. At N=4/5 the row/column pruning above
 * keeps the search small, so a real uniqueness proof (`limit=2`) is cheap
 * and appropriate - matching Sudoku/Constellation's bar, not a fabricated
 * "minimum clue count" the way Sudoku's 17 is a proven fact elsewhere.
 */
export function assertValidTowers(puzzle: TowersPuzzle): void {
  if (puzzle.size <= 0) {
    throw new Error(`Towers ${puzzle.id}: size must be positive.`);
  }

  const clueSets: ReadonlyArray<[string, ReadonlyArray<number>]> = [
    ['topClues', puzzle.topClues],
    ['bottomClues', puzzle.bottomClues],
    ['leftClues', puzzle.leftClues],
    ['rightClues', puzzle.rightClues],
  ];
  for (const [label, clues] of clueSets) {
    if (clues.length !== puzzle.size) {
      throw new Error(`Towers ${puzzle.id}: ${label} must have exactly ${puzzle.size} entries.`);
    }
    for (const clue of clues) {
      if (clue < 0 || clue > puzzle.size) {
        throw new Error(`Towers ${puzzle.id}: ${label} contains an out-of-range clue (${clue}).`);
      }
    }
  }

  const solutions = solveTowers(puzzle, 2);
  if (solutions.length === 0) {
    throw new Error(`Towers ${puzzle.id}: no solution exists.`);
  }
  if (solutions.length > 1) {
    throw new Error(`Towers ${puzzle.id}: solution is not unique.`);
  }
}

/**
 * Always re-solves from the puzzle's own fixed clues. Only ever fills a
 * blank cell - like Sudoku's hint, never Mirror Maze's "correct the first
 * wrong cell": a wrong-but-filled height here doesn't structurally block
 * anything (it's just a wrong entry, already visible via the conflict
 * highlight), so there is nothing a hint is obligated to undo.
 */
export function revealHint(
  state: TowersState,
  puzzle: TowersPuzzle,
): { state: TowersState; cell: TowersCell } | null {
  const [solution] = solveTowers(puzzle, 1);
  if (!solution) return null;

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (state.values[row][col] === 0) {
        return { state: setCell(state, row, col, solution.values[row][col]), cell: { row, col } };
      }
    }
  }
  return null;
}

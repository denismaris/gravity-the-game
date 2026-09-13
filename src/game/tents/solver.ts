import { TentMark, TentsTreesCell, TentsTreesPuzzle, TentsTreesState } from './types';
import {
  adjacentTreeCount,
  allNeighbors,
  inBounds,
  isEligible,
  isTentsTreesSolved,
  isTreeCell,
  setMark,
} from './logic';

/** `undefined` = not yet decided by the search. Tree cells are seeded as
 * `'empty'` up front (a tree is never a tent, so it never needs deciding) -
 * that also makes them count as zero, already-settled cells to every row/
 * column's forced-fill arithmetic below, with no special-casing needed. */
type Decided = TentMark | undefined;
type WorkingGrid = Decided[][];

function buildInitialGrid(puzzle: TentsTreesPuzzle): WorkingGrid {
  return Array.from({ length: puzzle.rows }, (_row, r) =>
    Array.from({ length: puzzle.cols }, (_col, c): Decided => {
      if (isTreeCell(puzzle, r, c)) return 'empty';
      if (adjacentTreeCount(puzzle, r, c) !== 1) return 'empty'; // 0 or 2+ adjacent trees: never a valid tent
      return undefined;
    }),
  );
}

type ForceResult = 'unchanged' | 'changed' | 'fail';

/** Forces every still-undecided cell in one row or column to `tent`/`empty`
 * the moment the remaining count makes the answer certain: no free cells
 * left needing a tent (fill the rest empty), or exactly as many free cells
 * as tents still needed (fill them all in). */
function forceLine(length: number, get: (i: number) => Decided, set: (i: number, v: TentMark) => void, needed: number): ForceResult {
  let decidedTents = 0;
  const undecided: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const v = get(i);
    if (v === 'tent') decidedTents += 1;
    else if (v === undefined) undecided.push(i);
  }
  if (decidedTents > needed || needed - decidedTents > undecided.length) return 'fail';
  if (undecided.length === 0) return 'unchanged';

  const remaining = needed - decidedTents;
  if (remaining === 0) {
    for (const i of undecided) set(i, 'empty');
    return 'changed';
  }
  if (remaining === undecided.length) {
    for (const i of undecided) set(i, 'tent');
    return 'changed';
  }
  return 'unchanged';
}

/**
 * Propagates every forced move to a fixed point, mutating `grid` in place.
 * Returns `false` the instant a contradiction is found (a line that can no
 * longer possibly reach its required count either way). Three rules, run
 * to convergence: (1) a confirmed tent forces all 8 neighbours empty; (2) a
 * row/column at its full tent count forces every remaining cell in it
 * empty; (3) a row/column whose remaining free cells exactly match its
 * remaining need forces all of them to tent.
 */
function propagate(puzzle: TentsTreesPuzzle, grid: WorkingGrid): boolean {
  let changed = true;
  while (changed) {
    changed = false;

    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        if (grid[r][c] !== 'tent') continue;
        for (const n of allNeighbors(puzzle, r, c)) {
          if (grid[n.row][n.col] === undefined) {
            grid[n.row][n.col] = 'empty';
            changed = true;
          }
        }
      }
    }

    for (let r = 0; r < puzzle.rows; r += 1) {
      const result = forceLine(
        puzzle.cols,
        c => grid[r][c],
        (c, v) => {
          grid[r][c] = v;
        },
        puzzle.rowCounts[r],
      );
      if (result === 'fail') return false;
      if (result === 'changed') changed = true;
    }

    for (let c = 0; c < puzzle.cols; c += 1) {
      const result = forceLine(
        puzzle.rows,
        r => grid[r][c],
        (r, v) => {
          grid[r][c] = v;
        },
        puzzle.colCounts[c],
      );
      if (result === 'fail') return false;
      if (result === 'changed') changed = true;
    }
  }
  return true;
}

function firstUndecided(puzzle: TentsTreesPuzzle, grid: WorkingGrid): TentsTreesCell | null {
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (grid[r][c] === undefined) return { row: r, col: c };
    }
  }
  return null;
}

function cloneGrid(grid: WorkingGrid): WorkingGrid {
  return grid.map(line => line.slice());
}

function gridToState(grid: WorkingGrid): TentsTreesState {
  return { marks: grid.map(line => line.map((v): TentMark => (v === 'tent' ? 'tent' : 'empty'))) };
}

/**
 * Searches for up to `limit` valid tent placements (pass 2 to check for
 * ambiguity, mirroring `solveSudoku`/`solveMirrorMaze`'s `limit` parameter).
 * Propagates to a fixed point, then branches on the first still-undecided
 * cell (tent or empty) and recurses, backtracking on contradiction.
 *
 * A fully-decided grid is re-checked against `isTentsTreesSolved` before
 * being accepted as a solution - belt and suspenders. `propagate`'s row/
 * column forcing rules and its "a confirmed tent excludes its neighbours"
 * rule are each individually sound, but they run independently: two cells
 * in different, unrelated rows/columns can each get forced to `tent` by
 * their own line's arithmetic in the same pass, before either one's
 * neighbour-exclusion has had a chance to rule the other out - so without
 * this final check, two mutually-touching forced tents could reach a
 * "fully decided" grid without ever being flagged as a contradiction. This
 * guarantees the round trip (every solution this function returns
 * independently satisfies the real validator) as an invariant of the code,
 * not just something the test suite happens to exercise.
 */
export function solveTentsAndTrees(puzzle: TentsTreesPuzzle, limit = 1): ReadonlyArray<TentsTreesState> {
  const solutions: TentsTreesState[] = [];

  function dfs(startingGrid: WorkingGrid): void {
    if (solutions.length >= limit) return;

    const grid = cloneGrid(startingGrid);
    if (!propagate(puzzle, grid)) return;

    const next = firstUndecided(puzzle, grid);
    if (!next) {
      const state = gridToState(grid);
      if (isTentsTreesSolved(puzzle, state)) solutions.push(state);
      return;
    }

    grid[next.row][next.col] = 'tent';
    dfs(grid);
    if (solutions.length >= limit) return;

    grid[next.row][next.col] = 'empty';
    dfs(grid);
  }

  dfs(buildInitialGrid(puzzle));
  return solutions;
}

/**
 * Validates a hand-authored puzzle: structurally well-formed (in bounds,
 * trees pairwise distinct, clue arrays the right length, row/column count
 * sums agreeing - a cheap authoring-typo catch), and solvable with a
 * *unique* solution. Unlike Mirror Maze/Trajectory's path-space (where
 * uniqueness is expensive and not required), this CSP's search space is
 * small and tightly pruned by propagation, so a real uniqueness proof is
 * cheap and appropriate here - matching Sudoku/Constellation's bar.
 */
export function assertValidTentsAndTrees(puzzle: TentsTreesPuzzle): void {
  if (puzzle.rows <= 0 || puzzle.cols <= 0) {
    throw new Error(`Tents and Trees ${puzzle.id}: rows/cols must be positive.`);
  }
  if (puzzle.rowCounts.length !== puzzle.rows) {
    throw new Error(`Tents and Trees ${puzzle.id}: rowCounts must have exactly ${puzzle.rows} entries.`);
  }
  if (puzzle.colCounts.length !== puzzle.cols) {
    throw new Error(`Tents and Trees ${puzzle.id}: colCounts must have exactly ${puzzle.cols} entries.`);
  }
  if (puzzle.trees.length === 0) {
    throw new Error(`Tents and Trees ${puzzle.id}: must have at least one tree.`);
  }

  const seen = new Set<string>();
  for (const tree of puzzle.trees) {
    if (!inBounds(puzzle, tree.row, tree.col)) {
      throw new Error(
        `Tents and Trees ${puzzle.id}: tree at (${tree.row}, ${tree.col}) is outside the ${puzzle.rows}x${puzzle.cols} board.`,
      );
    }
    const key = `${tree.row}:${tree.col}`;
    if (seen.has(key)) {
      throw new Error(`Tents and Trees ${puzzle.id}: duplicate tree at (${tree.row}, ${tree.col}).`);
    }
    seen.add(key);
  }

  const rowSum = puzzle.rowCounts.reduce((a, b) => a + b, 0);
  const colSum = puzzle.colCounts.reduce((a, b) => a + b, 0);
  if (rowSum !== colSum) {
    throw new Error(
      `Tents and Trees ${puzzle.id}: row counts sum to ${rowSum} but column counts sum to ${colSum}.`,
    );
  }

  const solutions = solveTentsAndTrees(puzzle, 2);
  if (solutions.length === 0) {
    throw new Error(`Tents and Trees ${puzzle.id}: no solution exists.`);
  }
  if (solutions.length > 1) {
    throw new Error(`Tents and Trees ${puzzle.id}: solution is not unique.`);
  }
}

/**
 * Always re-solves from the puzzle's own fixed data. Only ever fills a
 * missing tent the solution calls for - like `revealHint` everywhere else
 * that scores on hints, it never touches a cell the player has already set
 * (whether that's a correct tent, an empty, or a "marked" note), matching
 * Sudoku's "only fill blanks forward" contract rather than Mirror Maze's
 * "correct the first wrong cell" one: a wrongly-placed tent here doesn't
 * structurally block anything the way a wrong mirror blocks a beam, so
 * there's nothing here that a hint is ever obligated to undo.
 */
export function revealHint(
  state: TentsTreesState,
  puzzle: TentsTreesPuzzle,
): { state: TentsTreesState; cell: TentsTreesCell } | null {
  const [solution] = solveTentsAndTrees(puzzle, 1);
  if (!solution) return null;

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (!isEligible(puzzle, row, col)) continue;
      if (solution.marks[row][col] === 'tent' && state.marks[row][col] !== 'tent') {
        return { state: setMark(state, puzzle, row, col, 'tent'), cell: { row, col } };
      }
    }
  }
  return null;
}

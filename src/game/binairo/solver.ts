import { BinairoCell, BinairoPuzzle, BinairoState, BinairoValue } from './types';
import {
  constraintPartner,
  countClueNeighbours,
  countClueTally,
  isBinairoSolved,
  isGiven,
  setValue,
  twinPartner,
} from './logic';

type WorkingGrid = BinairoValue[][];

function cloneGrid(grid: WorkingGrid): WorkingGrid {
  return grid.map(row => row.slice());
}

type LineResult = 'unchanged' | 'changed' | 'fail';

/**
 * Propagates the two forced-move rules along one row or column (accessed
 * through `get`/`set`, so the same logic serves both orientations):
 *
 *  1. Triple window: in every span of 3 consecutive cells, two equal
 *     values with a blank third force the blank to the opposite value -
 *     and a span that's *already* three equal values (however it got that
 *     way - a row's own rule never sees a column's decision land) is an
 *     immediate contradiction, not just a pattern to avoid creating.
 *  2. Quota: once a line already has `length/2` of one value, every
 *     remaining blank in it must be the other value.
 */
function propagateLine(length: number, get: (i: number) => BinairoValue, set: (i: number, v: BinairoValue) => void): LineResult {
  let changed = false;

  for (let i = 0; i + 2 < length; i += 1) {
    const a = get(i);
    const b = get(i + 1);
    const c = get(i + 2);
    if (a !== null && a === b && b === c) return 'fail';
    if (a !== null && a === b && c === null) {
      set(i + 2, a === 0 ? 1 : 0);
      changed = true;
    } else if (b !== null && b === c && a === null) {
      set(i, b === 0 ? 1 : 0);
      changed = true;
    } else if (a !== null && a === c && b === null) {
      set(i + 1, a === 0 ? 1 : 0);
      changed = true;
    }
  }

  let zeros = 0;
  let ones = 0;
  for (let i = 0; i < length; i += 1) {
    const v = get(i);
    if (v === 0) zeros += 1;
    else if (v === 1) ones += 1;
  }
  const half = length / 2;
  if (zeros > half || ones > half) return 'fail';

  if (zeros === half || ones === half) {
    const fill: BinairoValue = zeros === half ? 1 : 0;
    for (let i = 0; i < length; i += 1) {
      if (get(i) === null) {
        set(i, fill);
        changed = true;
      }
    }
  }

  return changed ? 'changed' : 'unchanged';
}

/**
 * Propagates every `=`/`x` constraint once: a decided cell forces its
 * still-blank partner (`same` copies the value, `different` copies its
 * opposite); two decided cells that disagree with `kind` are an immediate
 * contradiction, the same "however it got that way" stance the triple
 * window takes above. A no-op pass over an empty `constraints` list (the
 * common case for every puzzle authored before this mechanic existed).
 */
function propagateConstraints(puzzle: BinairoPuzzle, grid: WorkingGrid): LineResult {
  let changed = false;
  for (const constraint of puzzle.constraints ?? []) {
    const partner = constraintPartner(constraint);
    const a = grid[constraint.row][constraint.col];
    const b = grid[partner.row][partner.col];
    if (a !== null && b !== null) {
      const satisfied = constraint.kind === 'same' ? a === b : a !== b;
      if (!satisfied) return 'fail';
    } else if (a !== null && b === null) {
      grid[partner.row][partner.col] = constraint.kind === 'same' ? a : a === 0 ? 1 : 0;
      changed = true;
    } else if (b !== null && a === null) {
      grid[constraint.row][constraint.col] = constraint.kind === 'same' ? b : b === 0 ? 1 : 0;
      changed = true;
    }
  }
  return changed ? 'changed' : 'unchanged';
}

/**
 * Propagates every twin pair once: a decided cell forces its still-blank
 * partner to the same value; two decided cells that disagree are an
 * immediate contradiction. Mirrors `propagateConstraints` exactly, minus
 * the `direction`/`kind` branching a twin pair doesn't need - it's
 * always "copy the value," and the partner is derived from geometry
 * (`twinPartner`), never stored. A no-op pass over an empty `twinCells`
 * list (the common case for every puzzle authored before this mechanic
 * existed).
 */
function propagateTwins(puzzle: BinairoPuzzle, grid: WorkingGrid): LineResult {
  let changed = false;
  for (const cell of puzzle.twinCells ?? []) {
    const partner = twinPartner(puzzle.size, cell);
    const a = grid[cell.row][cell.col];
    const b = grid[partner.row][partner.col];
    if (a !== null && b !== null) {
      if (a !== b) return 'fail';
    } else if (a !== null && b === null) {
      grid[partner.row][partner.col] = a;
      changed = true;
    } else if (b !== null && a === null) {
      grid[cell.row][cell.col] = b;
      changed = true;
    }
  }
  return changed ? 'changed' : 'unchanged';
}

/**
 * Propagates every neighbour-count clue once. Structurally the same quota
 * argument `propagateLine` makes about a row: once a clue already has all
 * the circles it is allowed, every undecided neighbour must be a square;
 * once it needs every remaining neighbour to reach its count, they must
 * all be circles. Either bound being overshot is an immediate
 * contradiction. A no-op pass over an empty `countClues` list, which is
 * every puzzle authored before this mechanic existed.
 */
function propagateCountClues(puzzle: BinairoPuzzle, grid: WorkingGrid): LineResult {
  let changed = false;
  for (const clue of puzzle.countClues ?? []) {
    const { ones, blanks } = countClueTally(puzzle.size, grid, clue);
    if (ones > clue.count || ones + blanks < clue.count) return 'fail';
    if (blanks === 0) continue;

    const forced: BinairoValue = ones === clue.count ? 0 : ones + blanks === clue.count ? 1 : null;
    if (forced === null) continue;

    for (const neighbour of countClueNeighbours(puzzle.size, clue)) {
      if (grid[neighbour.row][neighbour.col] === null) {
        grid[neighbour.row][neighbour.col] = forced;
        changed = true;
      }
    }
  }
  return changed ? 'changed' : 'unchanged';
}

/** Propagates every forced move to a fixed point, mutating `grid` in
 * place. Returns `false` the instant either rule finds a contradiction. */
function propagate(puzzle: BinairoPuzzle, grid: WorkingGrid): boolean {
  const n = puzzle.size;
  let changed = true;
  while (changed) {
    changed = false;

    for (let r = 0; r < n; r += 1) {
      const result = propagateLine(n, c => grid[r][c], (c, v) => { grid[r][c] = v; });
      if (result === 'fail') return false;
      if (result === 'changed') changed = true;
    }

    for (let c = 0; c < n; c += 1) {
      const result = propagateLine(n, r => grid[r][c], (r, v) => { grid[r][c] = v; });
      if (result === 'fail') return false;
      if (result === 'changed') changed = true;
    }

    const constraintResult = propagateConstraints(puzzle, grid);
    if (constraintResult === 'fail') return false;
    if (constraintResult === 'changed') changed = true;

    const twinResult = propagateTwins(puzzle, grid);
    if (twinResult === 'fail') return false;
    if (twinResult === 'changed') changed = true;

    const countResult = propagateCountClues(puzzle, grid);
    if (countResult === 'fail') return false;
    if (countResult === 'changed') changed = true;
  }
  return true;
}

function firstBlank(puzzle: BinairoPuzzle, grid: WorkingGrid): BinairoCell | null {
  for (let r = 0; r < puzzle.size; r += 1) {
    for (let c = 0; c < puzzle.size; c += 1) {
      if (grid[r][c] === null) return { row: r, col: c };
    }
  }
  return null;
}

function rowKey(row: ReadonlyArray<BinairoValue>): string {
  return row.join(',');
}

/** Whether `grid[row]` (now fully decided) repeats any earlier-decided
 * row - the "the moment a row completes" staged check, timed exactly like
 * `solveTowers`' row-clue check. Columns only ever complete once the whole
 * grid does, so they're checked once, at the end, via `isBinairoSolved`. */
function rowIsUniqueSoFar(grid: WorkingGrid, row: number): boolean {
  const key = rowKey(grid[row]);
  for (let r = 0; r < row; r += 1) {
    if (rowKey(grid[r]) === key) return false;
  }
  return true;
}

/**
 * Searches for up to `limit` valid grids (pass 2 to check for ambiguity,
 * mirroring `solveTowers`/`solveMirrorMaze`'s `limit` parameter). Branches
 * on the first remaining blank (row-major), trying 0 then 1, propagating
 * and pruning after each guess. A fully-decided grid is re-checked against
 * `isBinairoSolved` before being accepted - belt and suspenders, the same
 * guarantee `solveTentsAndTrees` added after finding that two locally-sound
 * decisions can still jointly violate a global rule neither one alone was
 * watching for.
 */
export function solveBinairo(puzzle: BinairoPuzzle, limit = 1): ReadonlyArray<BinairoState> {
  const solutions: BinairoState[] = [];

  function dfs(startingGrid: WorkingGrid): void {
    if (solutions.length >= limit) return;

    const grid = cloneGrid(startingGrid);
    if (!propagate(puzzle, grid)) return;

    const next = firstBlank(puzzle, grid);
    if (!next) {
      const state: BinairoState = { values: cloneGrid(grid) };
      if (isBinairoSolved(puzzle, state)) solutions.push(state);
      return;
    }

    for (const value of [0, 1] as const) {
      grid[next.row][next.col] = value;
      const rowComplete = grid[next.row].every(v => v !== null);
      if (rowComplete && !rowIsUniqueSoFar(grid, next.row)) {
        grid[next.row][next.col] = null;
        continue;
      }

      dfs(grid);
      grid[next.row][next.col] = null;
      if (solutions.length >= limit) return;
    }
  }

  dfs(puzzle.givens.map(row => row.slice()));
  return solutions;
}

/**
 * Validates a hand-authored puzzle: structurally well-formed (an even
 * size, every `givens` row the right length), and solvable with a
 * *unique* solution. The propagation above is strong enough (this ruleset
 * is famously close to fully constraint-propagatable) that a real
 * uniqueness proof stays cheap even at 10x10 - matching Sudoku/Tents and
 * Trees' bar.
 */
export function assertValidBinairo(puzzle: BinairoPuzzle): void {
  if (puzzle.size <= 0 || puzzle.size % 2 !== 0) {
    throw new Error(`Binairo ${puzzle.id}: size must be a positive even number.`);
  }
  if (puzzle.givens.length !== puzzle.size) {
    throw new Error(`Binairo ${puzzle.id}: givens must have exactly ${puzzle.size} rows.`);
  }
  for (const row of puzzle.givens) {
    if (row.length !== puzzle.size) {
      throw new Error(`Binairo ${puzzle.id}: every givens row must have exactly ${puzzle.size} entries.`);
    }
  }

  for (const clue of puzzle.countClues ?? []) {
    // A clue cell carries a real value like any other cell - see
    // `BinairoCountClue`'s own comment for why a valueless clue cell
    // cannot work on this board.
    if (!isGiven(puzzle, clue.row, clue.col)) {
      throw new Error(`Binairo ${puzzle.id}: count clue at ${clue.row},${clue.col} must sit on a given cell.`);
    }
    const maximum = countClueNeighbours(puzzle.size, clue).length;
    if (!Number.isInteger(clue.count) || clue.count < 0 || clue.count > maximum) {
      throw new Error(
        `Binairo ${puzzle.id}: count clue at ${clue.row},${clue.col} must be an integer in 0..${maximum}, got ${clue.count}.`,
      );
    }
  }

  const solutions = solveBinairo(puzzle, 2);
  if (solutions.length === 0) {
    throw new Error(`Binairo ${puzzle.id}: no solution exists.`);
  }
  if (solutions.length > 1) {
    throw new Error(`Binairo ${puzzle.id}: solution is not unique.`);
  }
}

/**
 * Always re-solves from the puzzle's own fixed givens. Only ever fills a
 * blank cell - like Sudoku's hint, never Mirror Maze's "correct the first
 * wrong cell": a wrong-but-filled value here is just wrong, already
 * visible the instant it breaks a rule, so there is nothing a hint is
 * obligated to undo.
 */
export function revealHint(
  state: BinairoState,
  puzzle: BinairoPuzzle,
): { state: BinairoState; cell: BinairoCell } | null {
  const [solution] = solveBinairo(puzzle, 1);
  if (!solution) return null;

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (isGiven(puzzle, row, col)) continue;
      if (state.values[row][col] === null) {
        return { state: setValue(state, puzzle, row, col, solution.values[row][col]), cell: { row, col } };
      }
    }
  }
  return null;
}

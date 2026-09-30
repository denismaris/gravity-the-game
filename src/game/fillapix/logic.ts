import { FillaPixCell, FillaPixPuzzle, FillaPixState } from './types';

export function emptyFillaPixState(size: number): FillaPixState {
  return { filled: Array.from({ length: size }, () => Array.from({ length: size }, () => false)) };
}

/** The 8 neighbours of `(row, col)` that actually exist on a `size` x
 * `size` board - clipped at the edges/corners rather than wrapping or
 * padding, so an edge clue's window is genuinely smaller. */
/**
 * The 3x3 block a clue counts - **including the clue's own square**.
 *
 * This is the standard Fill-a-Pix rule, and the app got it wrong for a
 * long time: the first version skipped the centre, so a clue described
 * only its eight neighbours. That one exclusion is most of what made
 * this game feel unfair. Under the real rule a `0` immediately empties
 * its own cell and a `9` immediately fills a whole block - the two
 * footholds every solver opens with, and the only deductions available
 * from a single clue in isolation. With the centre skipped, a clue says
 * nothing whatsoever about the square it is printed on, so neither
 * foothold exists and every chain of reasoning has to start a step
 * further back.
 *
 * Named for what it is rather than `clueWindow`, which is now exactly
 * the wrong word: the centre is the whole point.
 */
export function clueWindow(size: number, row: number, col: number): ReadonlyArray<FillaPixCell> {
  const result: FillaPixCell[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < size && c >= 0 && c < size) result.push({ row: r, col: c });
    }
  }
  return result;
}

/** How many of `(row, col)`'s 8 neighbours are filled in `grid`. Read
 * literally from the game's own spec ("how many filled cells touch that
 * cell") as the 8 neighbours only - the clue cell itself is never counted,
 * which diverges from classic Fill-a-Pix/Mosaic's 9-cell convention but
 * is what "touch" and "8 directions" actually say. */
function filledNeighbourCount(size: number, grid: ReadonlyArray<ReadonlyArray<boolean>>, row: number, col: number): number {
  let count = 0;
  for (const n of clueWindow(size, row, col)) if (grid[n.row][n.col]) count += 1;
  return count;
}

/** A clue cell's printed number - always derived from `puzzle.solution`,
 * never stored separately, so it can never drift out of sync with the
 * picture it describes. */
export function clueValue(puzzle: FillaPixPuzzle, row: number, col: number): number {
  return filledNeighbourCount(puzzle.size, puzzle.solution, row, col);
}

/** Live per-clue feedback against the player's *current* grid - every
 * cell is always in a definite filled/empty state, so this is a plain
 * equality check, re-evaluated after every tap. */
export function clueStatus(puzzle: FillaPixPuzzle, state: FillaPixState, row: number, col: number): 'satisfied' | 'violated' {
  return filledNeighbourCount(puzzle.size, state.filled, row, col) === clueValue(puzzle, row, col) ? 'satisfied' : 'violated';
}

/** Share of the picture's filled squares that start already filled, by
 * tier - a foothold, playtesting asked for one. */
export const GIVEN_FILL_SHARE = { easy: 0.2, medium: 0.14, hard: 0.1 } as const;

/**
 * Which squares start already filled and locked: a share of the picture's
 * own filled squares, spread apart (never two side by side while there is
 * any choice), picked by a fixed per-puzzle order so the same puzzle always
 * opens the same way. Taken from the solution, so they can never be wrong
 * and never change the one answer the clues pin down.
 */
export function givenFills(puzzle: FillaPixPuzzle): boolean[][] {
  const size = puzzle.size;
  const filled: FillaPixCell[] = [];
  puzzle.solution.forEach((line, row) => line.forEach((on, col) => on && filled.push({ row, col })));
  const want = Math.round(filled.length * GIVEN_FILL_SHARE[puzzle.difficulty]);
  // A fixed shuffle, seeded by the id.
  let seed = [...puzzle.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7);
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const order = filled
    .map(cell => ({ cell, key: next() }))
    .sort((a, b) => a.key - b.key)
    .map(entry => entry.cell);
  const given = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  let chosen = 0;
  const touches = (cell: FillaPixCell) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => given[cell.row + dr]?.[cell.col + dc]);
  for (const pass of [true, false]) {
    for (const cell of order) {
      if (chosen >= want) break;
      if (given[cell.row][cell.col] || (pass && touches(cell))) continue;
      given[cell.row][cell.col] = true;
      chosen += 1;
    }
  }
  return given;
}

/** The board a puzzle opens on: its given squares already filled. */
export function initialFillaPixState(puzzle: FillaPixPuzzle): FillaPixState {
  return { filled: givenFills(puzzle).map(line => line.slice()) };
}

export function toggleCell(state: FillaPixState, row: number, col: number): FillaPixState {
  const filled = state.filled.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? !v : v)) : r));
  return { filled };
}

/** Solved iff every *revealed* clue is satisfied. Sufficient, not just
 * convenient: `assertValidFillaPix` (see `solver.ts`) verifies at
 * authoring time that the revealed clue subset has exactly one grid that
 * satisfies all of it, so "every clue satisfied" and "state equals
 * puzzle.solution" are the same statement by construction - there is
 * nothing else to check here, the same way `isArukoneSolved` never
 * compares a drawn path against a stored solution either. */
export function isFillaPixSolved(puzzle: FillaPixPuzzle, state: FillaPixState): boolean {
  return puzzle.clues.every(cell => clueStatus(puzzle, state, cell.row, cell.col) === 'satisfied');
}

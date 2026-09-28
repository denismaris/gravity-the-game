import { AdjacentCell, AdjacentCoord, AdjacentFall, AdjacentMove, AdjacentPuzzle, AdjacentState } from './types';

/**
 * A tap only clears a run of **two or more**. A lone tile has nothing to
 * connect to, so tapping it does nothing at all - deliberately a no-op
 * rather than a one-tile clear, because a game that lets you dismantle
 * the board one tile at a time has no puzzle in it: every board would be
 * trivially clearable and the target score meaningless.
 */
export const MIN_GROUP = 2;

/** Points per tile in a run, before the bonus band. A round hundred so a
 * board's running total lands in the hundreds-to-thousands the targets
 * are quoted in, rather than needing a target of 150 to be fair. */
const BASE_POINTS = 100;

/**
 * The bonus band a run of `size` lands in.
 *
 * Steps rather than a smooth curve, and the steps are the numbers the
 * player is actually shown ("3x", "5x") - a continuous multiplier reads
 * as noise on a score counter, where a band reads as an achievement. The
 * jump from 3x to 5x at eight tiles is deliberately the largest: eight
 * connected tiles is not something a board hands you, it is something you
 * set up by clearing around it, and that is the skill this game has.
 */
export function multiplierFor(size: number): number {
  if (size >= 8) return 5;
  if (size >= 6) return 3;
  if (size >= 4) return 2;
  return 1;
}

/**
 * What a run of `size` tiles is worth: `(size - 1)` scoring tiles, times
 * the base, times its band. The first tile of a run pays nothing - it is
 * the *connection* that scores, which is why a pair is worth a single
 * tile's points and not two.
 */
export function cascadeScore(size: number): number {
  if (size < MIN_GROUP) return 0;
  return (size - 1) * BASE_POINTS * multiplierFor(size);
}

export function initialAdjacentState(puzzle: AdjacentPuzzle): AdjacentState {
  return { grid: puzzle.initial.map(row => row.slice()), score: 0, cascades: 0 };
}

function inBounds(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>, row: number, col: number): boolean {
  return row >= 0 && row < grid.length && col >= 0 && col < grid[row].length;
}

/**
 * Every tile orthogonally connected to `(row, col)` sharing its colour,
 * including the tapped tile itself. Empty for an empty square.
 *
 * Orthogonal only - diagonals do not connect, which is the whole shape of
 * the board and the thing the second tutorial slide exists to say. Plain
 * iterative flood fill on an explicit stack rather than recursion: a
 * single-colour 7x7 is 49 deep, which is fine, but this runs inside the
 * generator's search loop thousands of times and there is no reason to
 * put that on the JS call stack.
 */
export function groupAt(
  grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>,
  row: number,
  col: number,
): ReadonlyArray<AdjacentCoord> {
  if (!inBounds(grid, row, col)) return [];
  const colour = grid[row][col];
  if (colour === null) return [];

  const seen = new Set<string>([`${row}:${col}`]);
  const group: AdjacentCoord[] = [];
  const stack: AdjacentCoord[] = [{ row, col }];

  while (stack.length > 0) {
    const cell = stack.pop()!;
    group.push(cell);
    const neighbours = [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    ];
    for (const next of neighbours) {
      const key = `${next.row}:${next.col}`;
      if (seen.has(key)) continue;
      if (!inBounds(grid, next.row, next.col)) continue;
      if (grid[next.row][next.col] !== colour) continue;
      seen.add(key);
      stack.push(next);
    }
  }

  return group;
}

/** Whether tapping here would actually do anything. */
export function isLegalTap(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>, row: number, col: number): boolean {
  return groupAt(grid, row, col).length >= MIN_GROUP;
}

/**
 * Drops every tile as far down its own column as it will go, and reports
 * what moved.
 *
 * Columns are independent and never collapse sideways: an emptied column
 * stays empty rather than the board closing up around it. That is the
 * quieter of the two standard rules for this family of game, and the
 * right one here - a sideways collapse relocates tiles the player was
 * planning around, which turns a board you can read into one you cannot.
 */
export function settle(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>): {
  grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>;
  falls: ReadonlyArray<AdjacentFall>;
} {
  const size = grid.length;
  const next: AdjacentCell[][] = Array.from({ length: size }, () => Array<AdjacentCell>(grid[0].length).fill(null));
  const falls: AdjacentFall[] = [];

  for (let col = 0; col < grid[0].length; col += 1) {
    let writeRow = size - 1;
    for (let row = size - 1; row >= 0; row -= 1) {
      const cell = grid[row][col];
      if (cell === null) continue;
      next[writeRow][col] = cell;
      if (writeRow !== row) falls.push({ col, fromRow: row, toRow: writeRow });
      writeRow -= 1;
    }
  }

  return { grid: next, falls };
}

/**
 * The one move this game has: clear the run under `(row, col)`, score it,
 * and let the board settle.
 *
 * Returns `null` for a tap that is not a legal move (an empty square, or
 * a tile with no same-coloured neighbour) rather than an unchanged state,
 * so a caller can tell "nothing happened" from "something happened that
 * changed nothing" - the screen uses that to withhold the tap feedback on
 * a dead tap instead of rewarding it.
 */
export function applyTap(state: AdjacentState, row: number, col: number): AdjacentMove | null {
  const group = groupAt(state.grid, row, col);
  if (group.length < MIN_GROUP) return null;

  const cleared = state.grid.map(line => line.slice());
  for (const cell of group) cleared[cell.row][cell.col] = null;

  const { grid, falls } = settle(cleared);
  const gained = cascadeScore(group.length);

  return {
    state: { grid, score: state.score + gained, cascades: state.cascades + 1 },
    removed: group,
    falls,
    gained,
    multiplier: multiplierFor(group.length),
  };
}

/** How many tiles are still on the board - the header's own countdown. */
export function tileCount(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>): number {
  return grid.reduce((total, line) => total + line.filter(cell => cell !== null).length, 0);
}

/**
 * Whether any legal tap remains anywhere on the board. Scans for the
 * first same-coloured orthogonal pair rather than flood-filling every
 * cell: one adjacent pair is exactly the condition, and stopping at the
 * first one found keeps this cheap enough to call after every move (and
 * thousands of times inside the generator's search).
 */
export function hasLegalMove(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>): boolean {
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const cell = grid[row][col];
      if (cell === null) continue;
      if (row + 1 < grid.length && grid[row + 1][col] === cell) return true;
      if (col + 1 < grid[row].length && grid[row][col + 1] === cell) return true;
    }
  }
  return false;
}

/** Every distinct legal tap on the board, one representative coordinate
 * per run - what the search in `solver.ts` branches over. */
export function legalMoves(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>): ReadonlyArray<AdjacentCoord> {
  const claimed = new Set<string>();
  const moves: AdjacentCoord[] = [];

  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === null || claimed.has(`${row}:${col}`)) continue;
      const group = groupAt(grid, row, col);
      for (const cell of group) claimed.add(`${cell.row}:${cell.col}`);
      if (group.length >= MIN_GROUP) moves.push({ row, col });
    }
  }

  return moves;
}

/**
 * Finished: the target is met, or the board is empty.
 *
 * Either one alone is a win. Clearing a board outright is the rarer and
 * better outcome (it needs the colours to run out evenly, which random
 * dealing rarely allows), so it wins even from below the target - a
 * player who took the board apart completely has not failed to score.
 */
export function isAdjacentSolved(puzzle: AdjacentPuzzle, state: AdjacentState): boolean {
  return state.score >= puzzle.targetScore || tileCount(state.grid) === 0;
}

/**
 * Out of moves and short of the target. Not a fail *state* in the Gravity
 * sense - nothing is destroyed and the board is still there - but it is
 * the end of this attempt, and the screen offers a restart rather than
 * leaving the player tapping a dead board wondering what they missed.
 */
export function isAdjacentStuck(puzzle: AdjacentPuzzle, state: AdjacentState): boolean {
  return !isAdjacentSolved(puzzle, state) && !hasLegalMove(state.grid);
}

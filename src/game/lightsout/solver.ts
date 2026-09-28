import { litCount, pressedCells } from './logic';
import { LightsOutCell, LightsOutPuzzle, LightsOutState } from './types';

/**
 * Lights Out is a linear system over GF(2), and solving it as one is
 * both simpler and more honest than searching: each cell contributes one
 * equation ("this light must end up off"), each cell is one unknown
 * ("do I press it or not"), and because a press is its own inverse,
 * arithmetic mod 2 is exactly the right algebra. Gaussian elimination on
 * a 25- or 36-unknown system is sub-millisecond, so this runs live for a
 * hint rather than needing anything precomputed or stored on the puzzle.
 *
 * Same `solveX` / `assertValidX` shape every other solver-backed game in
 * this app already uses (`binairo/solver.ts`, `mirror/solver.ts`,
 * `tents/solver.ts`, `towers/solver.ts`, `fillapix/solver.ts`).
 */

/** Row `i` says: the presses that flip cell `i` must sum (mod 2) to
 * whether cell `i` is currently lit. Symmetric - pressing `j` flips `i`
 * exactly when pressing `i` would flip `j`. */
function buildAugmentedSystem(size: number, state: LightsOutState): number[][] {
  const n = size * size;
  const rows: number[][] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const row = new Array<number>(n + 1).fill(0);
      for (const cell of pressedCells(size, r, c)) row[cell.row * size + cell.col] = 1;
      row[n] = state.lights[r][c] ? 1 : 0;
      rows.push(row);
    }
  }
  return rows;
}

/**
 * The *smallest* set of cells that, pressed in any order, turns every
 * light off from `state` - or `null` if this configuration cannot be
 * solved at all. A set, not a sequence: presses commute and each is its
 * own inverse, so order never matters and no cell ever appears twice.
 *
 * Smallest matters, and is why this enumerates rather than just reading
 * one solution back. A 5x5 board's press matrix has a 2-dimensional null
 * space, so every solvable board has exactly four solutions, and they are
 * not the same size - the difference is routinely five or six presses.
 * Taking whichever one elimination happened to land on would make a
 * board's difficulty (see `par` in `types.ts`) an artefact of pivot
 * order rather than a property of the puzzle, and would hand out hints
 * that walk the player down a needlessly long route.
 *
 * The enumeration is 2^nullity, which is 4 on a 5x5 and 1 on a 6x6
 * (that matrix is invertible) - not a search, just reading the handful of
 * cosets off the same elimination.
 */
export function solveLightsOut(puzzle: LightsOutPuzzle, state: LightsOutState): ReadonlyArray<LightsOutCell> | null {
  const size = puzzle.size;
  const n = size * size;
  const rows = buildAugmentedSystem(size, state);
  const pivotOfCol = new Array<number>(n).fill(-1);
  let pivotRow = 0;

  for (let col = 0; col < n && pivotRow < rows.length; col += 1) {
    let selected = -1;
    for (let r = pivotRow; r < rows.length; r += 1) {
      if (rows[r][col] === 1) {
        selected = r;
        break;
      }
    }
    if (selected === -1) continue;

    [rows[pivotRow], rows[selected]] = [rows[selected], rows[pivotRow]];
    for (let r = 0; r < rows.length; r += 1) {
      if (r === pivotRow || rows[r][col] === 0) continue;
      /* eslint-disable-next-line no-bitwise -- XOR *is* addition in GF(2); that is the whole point of solving this puzzle over GF(2) rather than the reals */
      for (let c = col; c <= n; c += 1) rows[r][c] ^= rows[pivotRow][c];
    }
    pivotOfCol[col] = pivotRow;
    pivotRow += 1;
  }

  for (const row of rows) {
    if (row.slice(0, n).every(value => value === 0) && row[n] === 1) return null;
  }

  const freeCols: number[] = [];
  for (let col = 0; col < n; col += 1) if (pivotOfCol[col] === -1) freeCols.push(col);

  let best: number[] | null = null;
  /* eslint-disable no-bitwise -- enumerating the 2^nullity cosets by bit pattern, and GF(2) addition again */
  for (let mask = 0; mask < 1 << freeCols.length; mask += 1) {
    const x = new Array<number>(n).fill(0);
    freeCols.forEach((col, i) => {
      x[col] = (mask >> i) & 1;
    });
    for (let col = n - 1; col >= 0; col -= 1) {
      const pivot = pivotOfCol[col];
      if (pivot === -1) continue;
      let value = rows[pivot][n];
      for (const free of freeCols) if (rows[pivot][free] === 1) value ^= x[free];
      x[col] = value;
    }
    const candidateSize = x.reduce((sum, value) => sum + value, 0);
    if (best === null || candidateSize < best.reduce((sum, value) => sum + value, 0)) best = x;
  }
  /* eslint-enable no-bitwise */
  if (!best) return null;

  const cells: LightsOutCell[] = [];
  for (let i = 0; i < n; i += 1) {
    if (best[i] === 1) cells.push({ row: Math.floor(i / size), col: i % size });
  }
  return cells;
}

/** How many presses the shortest solution to `puzzle`'s own starting
 * board takes - the board's par, and the honest measure of how hard it
 * is. Notably *not* the number of lights on: a board with fewer lights
 * lit is routinely the harder of two, which is exactly the trap the
 * first pass at this game's difficulty bands fell into. */
export function parFor(puzzle: LightsOutPuzzle): number {
  const solution = solveLightsOut(puzzle, { lights: puzzle.initial });
  return solution ? solution.length : Infinity;
}

/**
 * Presses one cell that genuinely belongs to a solution of the board as
 * it stands right now - not of the board as it was dealt. That
 * distinction is the whole reason this game solves live instead of
 * storing an answer: a player who has pressed a few cells has a
 * different remaining solution, and a hint from the original one would
 * often be actively wrong.
 *
 * Lives here rather than in a `play.ts` because it is a thin read of the
 * solver, matching `towers/solver.ts` and `tents/solver.ts`'s own
 * `revealHint`. Returns `null` once there is nothing left to press.
 */
export function revealLightsOutHint(
  puzzle: LightsOutPuzzle,
  state: LightsOutState,
): { state: LightsOutState; cell: LightsOutCell } | null {
  const solution = solveLightsOut(puzzle, state);
  if (!solution || solution.length === 0) return null;
  const cell = solution[0];
  const flipped = new Set(pressedCells(puzzle.size, cell.row, cell.col).map(c => `${c.row}:${c.col}`));
  return {
    cell,
    state: { lights: state.lights.map((line, r) => line.map((lit, c) => (flipped.has(`${r}:${c}`) ? !lit : lit))) },
  };
}

/** Throws unless `puzzle`'s own starting board can actually be turned
 * off, and unless it starts with at least one light on (a board that is
 * already solved is not a puzzle). The pool-wide test calls this on every
 * shipped puzzle, the same `assertValidX` shape as every other game. */
export function assertValidLightsOut(puzzle: LightsOutPuzzle): void {
  const state = { lights: puzzle.initial };
  if (litCount(state) === 0) throw new Error(`Lights Out ${puzzle.id}: starts with every light already off.`);
  if (solveLightsOut(puzzle, state) === null) throw new Error(`Lights Out ${puzzle.id}: board cannot be solved.`);
}

import { isRotatable, neighbourAcross, setRotation, tileEnds } from './logic';
import { BloomCell, BloomEdge, BloomPuzzle, BloomState } from './types';

/* eslint-disable no-bitwise -- edge ends are a 4-bit mask throughout */

const EDGES: ReadonlyArray<BloomEdge> = [0, 1, 2, 3];
const opposite = (e: BloomEdge): BloomEdge => ((e + 2) & 3) as BloomEdge;

/** Each cell's still-possible rotations. */
type Domains = number[][][];

function initialDomains(puzzle: BloomPuzzle): Domains {
  return puzzle.kinds.map((line, row) =>
    line.map((kind, col) => (kind === 'arc' && !puzzle.pinned[row][col] ? [0, 1, 2, 3] : [puzzle.solution[row][col]])),
  );
}

/** Whether edge `e` of a cell can end a line (`true`) or stay bare
 * (`false`) under any rotation still open to it. */
function edgeOptions(puzzle: BloomPuzzle, domains: Domains, row: number, col: number, e: BloomEdge): { on: boolean; off: boolean } {
  let on = false;
  let off = false;
  for (const rotation of domains[row][col]) {
    if (tileEnds(puzzle.kinds[row][col], rotation) & (1 << e)) on = true;
    else off = true;
  }
  return { on, off };
}

/**
 * Arc consistency: throw out every rotation that would send a line into a
 * neighbour that cannot receive it (or into the rim), or leave bare an edge
 * the neighbour must cross - until nothing changes. This is exactly the
 * reasoning a player does ("this arc can't face the wall, so it faces
 * in"), which is the point: a board this settles on its own can be solved
 * by looking, never by guessing.
 *
 * Returns false on a contradiction (a cell with no rotation left).
 */
function propagate(puzzle: BloomPuzzle, domains: Domains): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        const domain = domains[row][col];
        if (domain.length <= 1 && puzzle.kinds[row][col] !== 'arc') continue;
        const kept = domain.filter(rotation => {
          const ends = tileEnds(puzzle.kinds[row][col], rotation);
          return EDGES.every(e => {
            const wants = (ends & (1 << e)) !== 0;
            const across = neighbourAcross(puzzle, row, col, e);
            if (!across) return !wants;
            const options = edgeOptions(puzzle, domains, across.row, across.col, opposite(e));
            return wants ? options.on : options.off;
          });
        });
        if (kept.length === 0) return false;
        if (kept.length !== domain.length) {
          domains[row][col] = kept;
          changed = true;
        }
      }
    }
  }
  return true;
}

/** Whether elimination alone settles every tile - the fairness bar every
 * shipped board has to clear. */
export function isSolvableByLogic(puzzle: BloomPuzzle): boolean {
  const domains = initialDomains(puzzle);
  if (!propagate(puzzle, domains)) return false;
  return domains.every((line, row) =>
    line.every((domain, col) => domain.length === 1 && domain[0] % 4 === puzzle.solution[row][col] % 4),
  );
}

/** How many tiles elimination leaves undecided - how much a pinned clue
 * still has to do. Used by the generator to choose where clues go. */
export function undecidedCells(puzzle: BloomPuzzle): BloomCell[] {
  const domains = initialDomains(puzzle);
  propagate(puzzle, domains);
  const cells: BloomCell[] = [];
  domains.forEach((line, row) => line.forEach((domain, col) => domain.length > 1 && cells.push({ row, col })));
  return cells;
}

/**
 * Counts solutions (up to `limit`) by search with elimination at every
 * step - a separate, exhaustive check, so the pool test does not take the
 * elimination solver's word for its own uniqueness.
 */
export function countBloomSolutions(puzzle: BloomPuzzle, limit = 2): number {
  let found = 0;
  const search = (domains: Domains): void => {
    if (found >= limit) return;
    if (!propagate(puzzle, domains)) return;
    let pick: BloomCell | null = null;
    for (let row = 0; row < puzzle.rows && !pick; row += 1) {
      for (let col = 0; col < puzzle.cols && !pick; col += 1) if (domains[row][col].length > 1) pick = { row, col };
    }
    if (!pick) {
      found += 1;
      return;
    }
    for (const rotation of domains[pick.row][pick.col]) {
      const copy = domains.map(line => line.map(domain => domain.slice()));
      copy[pick.row][pick.col] = [rotation];
      search(copy);
    }
  };
  search(initialDomains(puzzle));
  return found;
}

/** Turns one wrongly-facing arc to its place. Prefers one elimination
 * would settle first, so the hint teaches rather than just unblocks. */
export function revealBloomHint(puzzle: BloomPuzzle, state: BloomState): { state: BloomState; cell: BloomCell } | null {
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (!isRotatable(puzzle, row, col)) continue;
      if (state.rotations[row][col] % 4 === puzzle.solution[row][col] % 4) continue;
      return { cell: { row, col }, state: setRotation(state, row, col, puzzle.solution[row][col]) };
    }
  }
  return null;
}

export function assertValidBloom(puzzle: BloomPuzzle): void {
  const { id, rows, cols } = puzzle;
  if (puzzle.kinds.length !== rows || puzzle.kinds.some(line => line.length !== cols)) {
    throw new Error(`Bloom ${id}: grid is not ${rows}x${cols}.`);
  }
  // The solution itself must close every loop with nothing left loose.
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const ends = tileEnds(puzzle.kinds[row][col], puzzle.solution[row][col]);
      for (const e of EDGES) {
        const across = neighbourAcross(puzzle, row, col, e);
        const mine = (ends & (1 << e)) !== 0;
        const theirs = across
          ? (tileEnds(puzzle.kinds[across.row][across.col], puzzle.solution[across.row][across.col]) & (1 << opposite(e))) !== 0
          : false;
        if (mine !== theirs) throw new Error(`Bloom ${id}: the solution leaves a loose end at ${row},${col}.`);
      }
    }
  }
  if (countBloomSolutions(puzzle, 2) !== 1) throw new Error(`Bloom ${id}: does not have exactly one solution.`);
  if (!isSolvableByLogic(puzzle)) throw new Error(`Bloom ${id}: cannot be solved without guessing.`);
}

/* eslint-enable no-bitwise */

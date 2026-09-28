import { PuzzleDifficulty } from '../puzzleDifficulty';
import { traceLoops, tileEnds } from './logic';
import { isSolvableByLogic, undecidedCells } from './solver';
import { BloomPuzzle, BloomTileKind } from './types';

/* eslint-disable no-bitwise -- mulberry32, FNV-1a and 4-bit edge masks */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface BloomShape {
  readonly size: number;
  /** Share of cells that must carry line - below this a board is mostly
   * paper and there is too little to reason about. */
  readonly minFill: number;
  readonly minLoops: number;
  /** The biggest loop must have at least this many arcs. Arcs alone can
   * only ever close into four-arc circles; the lobed, blossom-shaped loops
   * come from running through knots, and a board of nothing but circles is
   * both dull to look at and trivial to read. */
  readonly minLargestLoop: number;
  /** At most this share of the loops may be plain four-arc circles. */
  readonly maxCircleShare: number;
  /** How often a cell is dealt a knot while the tiling is laid. */
  readonly knotWeight: number;
}

export function shapeForDifficulty(difficulty: PuzzleDifficulty): BloomShape {
  switch (difficulty) {
    case 'easy':
      return { size: 5, minFill: 0.6, minLoops: 2, minLargestLoop: 8, maxCircleShare: 0.67, knotWeight: 0.3 };
    case 'medium':
      return { size: 6, minFill: 0.62, minLoops: 2, minLargestLoop: 12, maxCircleShare: 0.6, knotWeight: 0.34 };
    case 'hard':
      return { size: 7, minFill: 0.64, minLoops: 3, minLargestLoop: 16, maxCircleShare: 0.55, knotWeight: 0.36 };
  }
}

interface Candidate {
  readonly kind: BloomTileKind;
  readonly rotation: number;
}

const ARC_CANDIDATES: ReadonlyArray<Candidate> = [0, 1, 2, 3].map(rotation => ({ kind: 'arc' as const, rotation }));
const KNOT_CANDIDATES: ReadonlyArray<Candidate> = [0, 1].map(rotation => ({ kind: 'knot' as const, rotation }));
const EMPTY: Candidate = { kind: 'empty', rotation: 0 };

/**
 * Lays a random closed tiling, cell by cell in reading order: each cell
 * must meet the south end of the cell above and the east end of the cell
 * to its left, and send nothing into the rim. Backtracks on a dead end,
 * which is rare - an arc can almost always turn to meet what is there.
 */
function layTiling(size: number, knotWeight: number, random: () => number): Candidate[][] | null {
  const grid: Candidate[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY));
  const order = (): Candidate[] => {
    const roll = random();
    const arcs = [...ARC_CANDIDATES].sort(() => random() - 0.5);
    const knots = [...KNOT_CANDIDATES].sort(() => random() - 0.5);
    // Mostly arcs, some knots, a little empty paper to break the lace up.
    if (roll < knotWeight) return [...knots, ...arcs, EMPTY];
    if (roll < knotWeight + 0.14) return [EMPTY, ...arcs, ...knots];
    return [...arcs, ...knots, EMPTY];
  };

  let steps = 0;
  const place = (index: number): boolean => {
    if (index === size * size) return true;
    if ((steps += 1) > 20000) return false;
    const row = Math.floor(index / size);
    const col = index % size;
    const needN = row > 0 ? (tileEnds(grid[row - 1][col].kind, grid[row - 1][col].rotation) & 0b0100) !== 0 : false;
    const needW = col > 0 ? (tileEnds(grid[row][col - 1].kind, grid[row][col - 1].rotation) & 0b0010) !== 0 : false;
    for (const candidate of order()) {
      const ends = tileEnds(candidate.kind, candidate.rotation);
      if (((ends & 0b0001) !== 0) !== needN) continue;
      if (((ends & 0b1000) !== 0) !== needW) continue;
      if (row === size - 1 && (ends & 0b0100) !== 0) continue;
      if (col === size - 1 && (ends & 0b0010) !== 0) continue;
      grid[row][col] = candidate;
      if (place(index + 1)) return true;
    }
    grid[row][col] = EMPTY;
    return false;
  };
  return place(0) ? grid : null;
}

const MAX_ATTEMPTS = 3000;

/** `salt` re-draws the same id when its first board repeats one already
 * in the pool (see `puzzles.ts`); the id itself never changes. */
export function generateBloom(id: string, name: string, difficulty: PuzzleDifficulty, salt = 0): BloomPuzzle {
  const shape = shapeForDifficulty(difficulty);
  const random = mulberry32(hashId(salt === 0 ? id : `${id}#${salt}`));
  const { size } = shape;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const tiling = layTiling(size, shape.knotWeight, random);
    if (!tiling) continue;

    const kinds = tiling.map(line => line.map(cell => cell.kind));
    const solution = tiling.map(line => line.map(cell => cell.rotation));
    const filled = kinds.flat().filter(kind => kind !== 'empty').length / (size * size);
    if (filled < shape.minFill) continue;

    const noPins = kinds.map(line => line.map(() => false));
    const base: BloomPuzzle = { id, name, difficulty, rows: size, cols: size, kinds, solution, start: solution, pinned: noPins };
    const loops = traceLoops(base, { rotations: solution }).loops;
    if (loops.length < shape.minLoops) continue;
    if (Math.max(...loops.map(loop => loop.length)) < shape.minLargestLoop) continue;
    if (loops.filter(loop => loop.length === 4).length / loops.length > shape.maxCircleShare) continue;

    // Pin arcs until elimination settles the whole board, each time on a
    // tile it has not managed to settle yet...
    const pinned = noPins.map(line => line.slice());
    let puzzle: BloomPuzzle = { ...base, pinned };
    let guard = 0;
    while (!isSolvableByLogic(puzzle) && guard < size * size) {
      guard += 1;
      const open = undecidedCells(puzzle).filter(cell => kinds[cell.row][cell.col] === 'arc');
      if (open.length === 0) break;
      const cell = open[Math.floor(random() * open.length)];
      pinned[cell.row][cell.col] = true;
      puzzle = { ...base, pinned: pinned.map(line => line.slice()) };
    }
    if (!isSolvableByLogic(puzzle)) continue;

    // ...then take back every pin the board turns out not to need, so the
    // clues left are the ones doing real work.
    const pinnedCells: Array<[number, number]> = [];
    pinned.forEach((line, row) => line.forEach((on, col) => on && pinnedCells.push([row, col])));
    pinnedCells.sort(() => random() - 0.5);
    for (const [row, col] of pinnedCells) {
      pinned[row][col] = false;
      const trial = { ...base, pinned: pinned.map(line => line.slice()) };
      if (isSolvableByLogic(trial)) puzzle = trial;
      else pinned[row][col] = true;
    }

    // Deal the free arcs at random - not "always wrong", which would tell
    // the player that every tile's current facing is the one it isn't.
    const start = solution.map((line, row) =>
      line.map((rotation, col) => (kinds[row][col] === 'arc' && !puzzle.pinned[row][col] ? Math.floor(random() * 4) : rotation)),
    );
    const candidate: BloomPuzzle = { ...puzzle, start };
    if (traceLoops(candidate, { rotations: start }).looseEnds === 0) continue;
    return candidate;
  }

  throw new Error(`Bloom ${id}: no fair board after ${MAX_ATTEMPTS} attempts.`);
}

/* eslint-enable no-bitwise */

import { PuzzleDifficulty } from '../puzzleDifficulty';
import { visibleCount } from './logic';
import { solveTowers } from './solver';
import { TowersPuzzle } from './types';

/**
 * Builds a Skyscrapers board from an id.
 *
 * The curated pool (`puzzles.ts`) is hand-verified Latin squares with
 * their clues derived; this does the same thing from a seed, so the game
 * can keep dealing boards after those fourteen are spent. Deterministic
 * from the id, like every other seeded generator here - an id that
 * produced a different board on the next launch would attach a player's
 * stars to a puzzle they never played.
 *
 * The grid itself is discarded: only the derived clues ship, exactly as
 * in the curated pool. And uniqueness is *verified*, not assumed - a
 * random Latin square's clues very often admit more than one solution,
 * which is the whole reason this retries.
 */

/* eslint-disable no-bitwise -- mulberry32 and FNV-1a are bitwise by definition */

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

/* eslint-enable no-bitwise */

export interface TowersShape {
  readonly size: number;
  /** Which edges keep their derived clue. Dropping one is the hard
   * tier's own lever, matching `towers-009` onward. */
  readonly sides: { top: boolean; bottom: boolean; left: boolean; right: boolean };
}

const ALL = { top: true, bottom: true, left: true, right: true };
const THREE = { top: true, bottom: false, left: true, right: true };

/**
 * Shapes for the endless stream, mirroring the curated ramp: 4x4 with
 * every clue, 5x5 with every clue, then 5x5 with one side dropped.
 */
export function endlessShapeFor(difficulty: PuzzleDifficulty): TowersShape {
  switch (difficulty) {
    case 'easy':
      return { size: 4, sides: ALL };
    case 'medium':
      return { size: 5, sides: ALL };
    case 'hard':
      // 5x5, not 6x6. A 6x6 with a clue side dropped was tried and
      // measured: twenty boards took **18 minutes** - about 55 seconds
      // each. `solveTowers` has to prove uniqueness, and at 6x6 with a
      // side missing almost every random square fails that check, so the
      // retries dominate. Opening a puzzle would simply have frozen. The
      // same shape at 5x5 is ~7ms. The curated pool keeps its one
      // authored 6x6, where the board is stored rather than searched for.
      return { size: 5, sides: THREE };
  }
}

function shuffled<T>(items: ReadonlyArray<T>, random: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A random Latin square, built by permuting the rows, columns and values
 * of a cyclic base - the same construction the curated grids were
 * hand-built from, which guarantees a valid square without any search.
 */
function latinSquare(size: number, random: () => number): number[][] {
  const base = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (__, c) => ((r + c) % size) + 1),
  );
  const rows = shuffled(base, random);
  const columnOrder = shuffled(Array.from({ length: size }, (_, i) => i), random);
  const permuted = rows.map(row => columnOrder.map(c => row[c]));
  const values = shuffled(Array.from({ length: size }, (_, i) => i + 1), random);
  return permuted.map(row => row.map(v => values[v - 1]));
}

function cluesFrom(id: string, name: string, difficulty: PuzzleDifficulty, shape: TowersShape, grid: number[][]): TowersPuzzle {
  const zeros = Array<number>(shape.size).fill(0);
  const column = (c: number): number[] => grid.map(row => row[c]);
  return {
    id,
    name,
    difficulty,
    size: shape.size,
    topClues: shape.sides.top ? grid[0].map((_v, c) => visibleCount(column(c))) : zeros,
    bottomClues: shape.sides.bottom ? grid[0].map((_v, c) => visibleCount([...column(c)].reverse())) : zeros,
    leftClues: shape.sides.left ? grid.map(row => visibleCount(row)) : zeros,
    rightClues: shape.sides.right ? grid.map(row => visibleCount([...row].reverse())) : zeros,
  };
}

/** Generous by a wide margin; it exists so a mis-tuned shape fails
 * loudly rather than hanging. */
const MAX_ATTEMPTS = 4000;

export function generateTowers(id: string, difficulty: PuzzleDifficulty, name: string): TowersPuzzle {
  const shape = endlessShapeFor(difficulty);
  const random = mulberry32(hashId(id));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = cluesFrom(id, name, difficulty, shape, latinSquare(shape.size, random));
    if (solveTowers(candidate, 2).length === 1) return candidate;
  }

  throw new Error(`Skyscrapers ${id}: no uniquely-solvable board after ${MAX_ATTEMPTS} attempts.`);
}

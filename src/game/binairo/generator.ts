import { PuzzleDifficulty } from '../puzzleDifficulty';
import { solveBinairo } from './solver';
import { BinairoConstraint, BinairoPuzzle, BinairoValue } from './types';

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

export type BinairoGrid = ReadonlyArray<ReadonlyArray<0 | 1>>;

export interface BinairoShape {
  readonly size: 6 | 8;
  /** Share of the squares left given once stripping is done - lower is
   * harder. Stripping never goes below what uniqueness needs. */
  readonly givenShare: number;
  /** How many `=` / `x` tiles the board carries. */
  readonly constraints: number;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Every row of length `n` with an even split and no run of three. */
/* eslint-disable no-bitwise -- enumerating rows as bit patterns */
function validRows(n: number): Array<Array<0 | 1>> {
  const rows: Array<Array<0 | 1>> = [];
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const row = Array.from({ length: n }, (_v, i) => ((mask >> i) & 1) as 0 | 1);
    if (row.filter(v => v === 1).length !== n / 2) continue;
    if (row.some((v, i) => i >= 2 && v === row[i - 1] && v === row[i - 2])) continue;
    rows.push(row);
  }
  return rows;
}
/* eslint-enable no-bitwise */

/**
 * A random, valid solution grid, row by row: each row an even, triple-free
 * row not already used, kept only while every column stays even-able and
 * triple-free, and at the end every column distinct too.
 *
 * The first pool built every grid by rotating one base row a step per row,
 * which is valid by construction - and far too regular: each row is the
 * last one shifted over, a pattern a player spots and then reads the board
 * off rather than reasoning it out. Playtesting found the 6x6 boards "too
 * easy" for exactly that reason.
 */
export function randomBinairoGrid(n: number, random: () => number): BinairoGrid {
  const candidates = validRows(n);
  const grid: Array<Array<0 | 1>> = [];
  const place = (): boolean => {
    const r = grid.length;
    if (r === n) {
      const cols = new Set(Array.from({ length: n }, (_v, c) => grid.map(row => row[c]).join('')));
      return cols.size === n;
    }
    for (const row of shuffle([...candidates], random)) {
      if (grid.some(existing => existing.join('') === row.join(''))) continue;
      const fits = row.every((v, c) => {
        const ones = grid.filter(existing => existing[c] === 1).length + (v === 1 ? 1 : 0);
        const zeros = r + 1 - ones;
        if (ones > n / 2 || zeros > n / 2) return false;
        return !(r >= 2 && grid[r - 1][c] === v && grid[r - 2][c] === v);
      });
      if (!fits) continue;
      grid.push(row);
      if (place()) return true;
      grid.pop();
    }
    return false;
  };
  if (!place()) throw new Error(`No ${n}x${n} Binairo grid found.`);
  return grid;
}

/**
 * A puzzle from a random grid: `constraints` random `=`/`x` tiles read off
 * the solution, then givens stripped one square at a time in a random
 * order, each removal kept only if the puzzle still has exactly one
 * solution - until the given share falls to the target, or no square can
 * go without losing uniqueness.
 */
export function generateBinairo(id: string, name: string, difficulty: PuzzleDifficulty, shape: BinairoShape): { puzzle: BinairoPuzzle; solution: BinairoGrid } {
  const random = mulberry32(hashId(id));
  const n = shape.size;
  const solution = randomBinairoGrid(n, random);

  const pairs: Array<{ row: number; col: number; direction: 'right' | 'down' }> = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (col + 1 < n) pairs.push({ row, col, direction: 'right' });
      if (row + 1 < n) pairs.push({ row, col, direction: 'down' });
    }
  }
  const constraints: BinairoConstraint[] = shuffle(pairs, random)
    .slice(0, shape.constraints)
    .map(({ row, col, direction }) => {
      const other = direction === 'right' ? solution[row][col + 1] : solution[row + 1][col];
      return { row, col, direction, kind: (solution[row][col] === other ? 'same' : 'different') as BinairoConstraint['kind'] };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col || a.direction.localeCompare(b.direction));

  const givens: BinairoValue[][] = solution.map(line => line.slice());
  const target = Math.round(n * n * shape.givenShare);
  let count = n * n;
  const order = shuffle(
    Array.from({ length: n * n }, (_v, i) => i),
    random,
  );
  for (const index of order) {
    if (count <= target) break;
    const row = Math.floor(index / n);
    const col = index % n;
    const kept = givens[row][col];
    givens[row][col] = null;
    const candidate: BinairoPuzzle = { id, name, difficulty, size: n, givens, constraints };
    if (solveBinairo(candidate, 2).length === 1) count -= 1;
    else givens[row][col] = kept;
  }

  return { puzzle: { id, name, difficulty, size: n, givens: givens.map(line => line.slice()), constraints }, solution };
}

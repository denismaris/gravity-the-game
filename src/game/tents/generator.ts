import { PuzzleDifficulty } from '../puzzleDifficulty';
import { solveTentsAndTrees } from './solver';
import { TentsTreesCell, TentsTreesPuzzle } from './types';

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

export interface TentsShape {
  readonly size: number;
  readonly tents: number;
}

const ORTHOGONAL: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * One random layout: `tents` tents scattered so no two touch (not even
 * diagonally), each then given its own tree on a free orthogonal square.
 * Null if the tents could not all be placed or paired this time.
 */
function layOut(size: number, tents: number, random: () => number): { trees: TentsTreesCell[]; tentCells: TentsTreesCell[] } | null {
  const tent = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const tree = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const tentCells: TentsTreesCell[] = [];
  const cells = shuffle(
    Array.from({ length: size * size }, (_v, i) => ({ row: Math.floor(i / size), col: i % size })),
    random,
  );
  const clear = (r: number, c: number) => {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) if (tent[r + dr]?.[c + dc]) return false;
    }
    return true;
  };
  for (const cell of cells) {
    if (tentCells.length >= tents) break;
    if (!clear(cell.row, cell.col)) continue;
    tent[cell.row][cell.col] = true;
    tentCells.push(cell);
  }
  if (tentCells.length < tents) return null;

  const trees: TentsTreesCell[] = [];
  for (const t of tentCells) {
    const spots = shuffle(
      ORTHOGONAL.map(([dr, dc]) => ({ row: t.row + dr, col: t.col + dc })).filter(
        s => s.row >= 0 && s.col >= 0 && s.row < size && s.col < size && !tent[s.row][s.col] && !tree[s.row][s.col],
      ),
      random,
    );
    if (spots.length === 0) return null;
    tree[spots[0].row][spots[0].col] = true;
    trees.push(spots[0]);
  }
  trees.sort((a, b) => a.row - b.row || a.col - b.col);
  return { trees, tentCells };
}

/**
 * A board from a random layout, kept only if its row and column counts pin
 * down exactly one solution.
 *
 * The first pool was ten hand-drawn boards - every one symmetric (four
 * corners, a ring, twin rows, twin columns), sparse enough that most rows
 * needed no tent at all, and so alike that players called them "too
 * similar". Random layouts at a real density - about one tent to every
 * five squares - are neither.
 */
export function generateTents(id: string, name: string, difficulty: PuzzleDifficulty, shape: TentsShape): TentsTreesPuzzle {
  const random = mulberry32(hashId(id));
  const { size, tents } = shape;
  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const layout = layOut(size, tents, random);
    if (!layout) continue;
    const rowCounts = new Array<number>(size).fill(0);
    const colCounts = new Array<number>(size).fill(0);
    for (const t of layout.tentCells) {
      rowCounts[t.row] += 1;
      colCounts[t.col] += 1;
    }
    // A line that needs no tent at all is a free answer; more than a
    // quarter of them and the board reads itself off.
    const zeroLines = [...rowCounts, ...colCounts].filter(count => count === 0).length;
    if (zeroLines > (size * 2) / 4) continue;
    const puzzle: TentsTreesPuzzle = { id, name, difficulty, rows: size, cols: size, trees: layout.trees, rowCounts, colCounts };
    if (solveTentsAndTrees(puzzle, 2).length === 1) return puzzle;
  }
  throw new Error(`Tents ${id}: no uniquely solvable ${size}x${size} board with ${tents} tents.`);
}

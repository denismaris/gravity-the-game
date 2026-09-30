import { PuzzleDifficulty } from '../puzzleDifficulty';
import { bridgeLinks } from './logic';
import { isSolvableByLogic } from './solver';
import { BridgesIsland, BridgesPuzzle } from './types';

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

export interface BridgesShape {
  readonly size: number;
  readonly minIslands: number;
  readonly maxIslands: number;
  /** Chance a bridge is laid double. */
  readonly doubleChance: number;
  /** Extra bridges between islands that already see each other - loops,
   * which is what makes the connection reasoning bite. */
  readonly extraLinks: number;
  /** Whether the counting rules alone may be enough. Easy boards: yes.
   * Harder ones must need the connection rules too. */
  readonly countingAlone: boolean;
}

export function shapeForDifficulty(difficulty: PuzzleDifficulty): BridgesShape {
  if (difficulty === 'easy') return { size: 7, minIslands: 9, maxIslands: 12, doubleChance: 0.35, extraLinks: 1, countingAlone: true };
  if (difficulty === 'medium') return { size: 8, minIslands: 14, maxIslands: 17, doubleChance: 0.35, extraLinks: 2, countingAlone: false };
  return { size: 9, minIslands: 18, maxIslands: 23, doubleChance: 0.3, extraLinks: 3, countingAlone: false };
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/**
 * One random archipelago, grown the way a real one would be charted: from
 * an island, pick a direction and a distance of at least two squares of
 * open water, set a new island there and lay one or two bridges to it. No
 * island is placed on an existing bridge, no bridge over an island or
 * across another bridge, and no two islands touch - so the network is a
 * true answer by construction. A few extra bridges then join islands that
 * already face each other, closing loops.
 */
function chart(size: number, target: number, shape: BridgesShape, random: () => number): { islands: BridgesIsland[]; bridges: Map<string, number> } | null {
  const island = new Map<string, number>(); // "r:c" -> island index
  const water = Array.from({ length: size }, () => new Array<'' | 'h' | 'v'>(size).fill(''));
  const spots: Array<{ row: number; col: number }> = [];
  const bridges = new Map<string, number>(); // "i:j" (i<j) -> count
  const free = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && !island.has(`${r}:${c}`) && water[r][c] === '';
  const lonely = (r: number, c: number) => DIRS.every(([dr, dc]) => !island.has(`${r + dr}:${c + dc}`));
  const place = (r: number, c: number) => {
    island.set(`${r}:${c}`, spots.length);
    spots.push({ row: r, col: c });
  };
  const lay = (i: number, j: number, count: number) => {
    const a = spots[i];
    const b = spots[j];
    const horizontal = a.row === b.row;
    if (horizontal) for (let c = Math.min(a.col, b.col) + 1; c < Math.max(a.col, b.col); c += 1) water[a.row][c] = 'h';
    else for (let r = Math.min(a.row, b.row) + 1; r < Math.max(a.row, b.row); r += 1) water[r][a.col] = 'v';
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    bridges.set(key, count);
  };

  place(1 + Math.floor(random() * (size - 2)), 1 + Math.floor(random() * (size - 2)));
  for (let tries = 0; spots.length < target && tries < 600; tries += 1) {
    const from = Math.floor(random() * spots.length);
    const [dr, dc] = DIRS[Math.floor(random() * 4)];
    const reach = 2 + Math.floor(random() * Math.floor(size / 2));
    const { row, col } = spots[from];
    let ok = true;
    for (let k = 1; k < reach && ok; k += 1) ok = free(row + dr * k, col + dc * k);
    const r = row + dr * reach;
    const c = col + dc * reach;
    if (!ok || !free(r, c) || !lonely(r, c)) continue;
    place(r, c);
    lay(from, spots.length - 1, random() < shape.doubleChance ? 2 : 1);
  }
  if (spots.length < shape.minIslands) return null;

  // Loops: join islands that face each other across open water.
  const islands = spots.map(s => ({ ...s, need: 0 }));
  const links = bridgeLinks({ rows: size, cols: size, islands });
  let extra = 0;
  for (const link of [...links].sort(() => random() - 0.5)) {
    if (extra >= shape.extraLinks) break;
    const key = `${link.a}:${link.b}`;
    if (bridges.has(key)) continue;
    const a = spots[link.a];
    const b = spots[link.b];
    let clear = true;
    if (link.horizontal) for (let col = a.col + 1; col < b.col && clear; col += 1) clear = water[a.row][col] === '';
    else for (let row = a.row + 1; row < b.row && clear; row += 1) clear = water[row][a.col] === '';
    if (!clear) continue;
    lay(link.a, link.b, 1);
    extra += 1;
  }
  return { islands, bridges };
}

/**
 * A board for `difficulty`, deterministic from its id: charted, then kept
 * only if it can be reasoned out without guessing - which also proves it
 * has exactly one answer, since the rules only ever rule things out. Easy
 * boards may fall to counting alone; medium and hard must need the
 * connection rules as well, so each tier asks for a new kind of thought.
 */
export function generateBridges(id: string, name: string, difficulty: PuzzleDifficulty, salt = 0): BridgesPuzzle {
  const shape = shapeForDifficulty(difficulty);
  const random = mulberry32(hashId(`${id}#${salt}`));
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const target = shape.minIslands + Math.floor(random() * (shape.maxIslands - shape.minIslands + 1));
    const charted = chart(shape.size, target, shape, random);
    if (!charted) continue;

    // Reading order, so an island's index reads left to right, top down.
    const order = charted.islands.map((_island, i) => i).sort((p, q) => charted.islands[p].row - charted.islands[q].row || charted.islands[p].col - charted.islands[q].col);
    const need = charted.islands.map(() => 0);
    for (const [key, count] of charted.bridges) {
      const [i, j] = key.split(':').map(Number);
      need[i] += count;
      need[j] += count;
    }
    const islands = order.map(old => ({ row: charted.islands[old].row, col: charted.islands[old].col, need: need[old] }));
    const draft = { id, name, difficulty, rows: shape.size, cols: shape.size, islands, solution: [] as number[] };
    const links = bridgeLinks(draft);
    const solution = links.map(link => {
      const oldA = order[link.a];
      const oldB = order[link.b];
      return charted.bridges.get(oldA < oldB ? `${oldA}:${oldB}` : `${oldB}:${oldA}`) ?? 0;
    });
    const puzzle: BridgesPuzzle = { ...draft, solution };

    if (!isSolvableByLogic(puzzle)) continue;
    if (!shape.countingAlone && isSolvableByLogic(puzzle, false)) continue;
    return puzzle;
  }
  throw new Error(`Bridges ${id}: no board found`);
}

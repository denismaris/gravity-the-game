import { endlessSeed } from '../endlessId';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { MosaicTheme, Silhouette } from './silhouettes';

/* eslint-disable no-bitwise -- mulberry32 is bitwise by definition */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

/** Bounding boxes and fill targets matched to the curated pictures of each
 * tier (easy ~6x6 / 22 squares, medium ~7x8 / 34, hard ~9x9 / 50). */
const SPEC: Record<PuzzleDifficulty, { rows: number; cols: number; cells: readonly [number, number] }> = {
  easy: { rows: 6, cols: 6, cells: [19, 24] },
  medium: { rows: 7, cols: 8, cells: [30, 38] },
  hard: { rows: 8, cols: 8, cells: [40, 48] },
};
const THEMES: ReadonlyArray<MosaicTheme> = ['garden', 'sea', 'hearth', 'dusk', 'meadow'];

/**
 * A silhouette for an endless Mosaic board: a mirror-symmetric emblem grown
 * outward from the centre line - the shape of a vase, a crest, a lantern -
 * one connected piece, filling its box about as fully as the hand-drawn
 * pictures do. It is not trying to be an object; it is a shape pleasant to
 * tile, and the theme colours it.
 */
export function endlessSilhouette(id: string, tier: PuzzleDifficulty, name: string): Silhouette {
  const { rows, cols, cells } = SPEC[tier];
  const random = mulberry32(endlessSeed(id));
  const target = cells[0] + Math.floor(random() * (cells[1] - cells[0] + 1));
  const half = Math.ceil(cols / 2);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const set = (r: number, c: number) => {
    grid[r][c] = true;
    grid[r][cols - 1 - c] = true;
  };
  const count = () => grid.flat().filter(Boolean).length;
  // Seed a spine down the middle, then grow outward and along.
  const top = Math.floor(random() * 2);
  for (let r = top; r < rows - Math.floor(random() * 2); r += 1) set(r, half - 1);
  for (let guard = 0; guard < 4000 && count() < target; guard += 1) {
    const frontier: Array<[number, number]> = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < half; c += 1) {
        if (grid[r][c]) continue;
        const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => grid[r + dr]?.[c + dc]).length;
        if (near > 0) frontier.push([r, c]);
      }
    }
    if (frontier.length === 0) break;
    // Favour squares touching two filled neighbours (filling a notch
    // smoothly) over one (a tendril) or three (squaring off a block): the
    // outline stays interesting - shoulders and waists, not a rectangle.
    const weights = frontier.map(([r, c]) => {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => grid[r + dr]?.[c + dc]).length;
      return near === 2 ? 4 : near === 1 ? 2 : 1;
    });
    let pick = random() * weights.reduce((a, b) => a + b, 0);
    let index = 0;
    while (pick > weights[index]) {
      pick -= weights[index];
      index += 1;
    }
    const [r, c] = frontier[Math.min(index, frontier.length - 1)];
    set(r, c);
  }
  // Trim empty rows and columns.
  const used = grid.filter(line => line.some(Boolean));
  const colsUsed = Array.from({ length: cols }, (_v, c) => used.some(line => line[c]));
  const art = used.map(line => line.filter((_v, c) => colsUsed[c]).map(on => (on ? '#' : '.')).join(''));
  return { key: `endless-${id}`, name, theme: THEMES[endlessSeed(`${id}:theme`) % THEMES.length], art };
}

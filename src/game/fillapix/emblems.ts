import { endlessSeed } from '../endlessId';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { FillaPixImage } from './pixelArt';

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

const SIZES: Record<PuzzleDifficulty, number> = { easy: 5, medium: 6, hard: 7 };

function connected(grid: boolean[][]): boolean {
  const n = grid.length;
  const filled: Array<[number, number]> = [];
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (grid[r][c]) filled.push([r, c]);
  if (filled.length === 0) return false;
  const seen = new Set([`${filled[0][0]}:${filled[0][1]}`]);
  const stack = [filled[0]];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr}:${nc}`;
      if (nr >= 0 && nc >= 0 && nr < n && nc < n && grid[nr][nc] && !seen.has(key)) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  return seen.size === filled.length;
}

/**
 * A picture for an endless Fill-a-Pix board: an emblem, like a crest or a
 * sampler motif - mirror-symmetric (a third of them four-way, like a
 * snowflake), smoothed so it reads as a shape rather than noise, one
 * connected piece, and neither too sparse nor too solid to be a picture.
 *
 * Random grids were deliberately never used for the curated pool (they
 * are not recognisable), and these are not trying to be objects - they
 * are the other thing a hidden picture can be: a *pattern* that resolves
 * into symmetry as it is uncovered, which is its own small reward.
 */
export function emblemFor(id: string, tier: PuzzleDifficulty): FillaPixImage {
  const n = SIZES[tier];
  const random = mulberry32(endlessSeed(id));
  const half = Math.ceil(n / 2);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const fourWay = random() < 0.34;
    let grid = Array.from({ length: n }, () => Array.from({ length: n }, () => false));
    for (let r = 0; r < (fourWay ? half : n); r += 1) {
      for (let c = 0; c < half; c += 1) grid[r][c] = random() < 0.52;
    }
    // Mirror left to right (and top to bottom, for four-way emblems).
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const sr = fourWay && r >= half ? n - 1 - r : r;
        const sc = c >= half ? n - 1 - c : c;
        grid[r][c] = grid[sr][sc];
      }
    }
    // One gentle smoothing pass: a square follows its neighbourhood's
    // majority, which turns speckle into shapes.
    grid = grid.map((line, r) =>
      line.map((on, c) => {
        let around = 0;
        let total = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
            total += 1;
            if (grid[nr][nc]) around += 1;
          }
        }
        const share = around / total;
        return share > 0.62 ? true : share < 0.3 ? false : on;
      }),
    );
    const filled = grid.flat().filter(Boolean).length / (n * n);
    if (filled < 0.36 || filled > 0.66 || !connected(grid)) continue;
    // Something in every row and column's neighbourhood - no dead bands.
    if (grid.some((line, r) => r > 0 && r < n - 1 && !line.some(Boolean))) continue;
    return { id: `emblem-${id}`, rows: grid.map(line => line.map(on => (on ? '#' : '.')).join('')) };
  }
  // Unreachable in practice (see the endless tests); a plain diamond.
  const c = (n - 1) / 2;
  return { id: `emblem-${id}`, rows: Array.from({ length: n }, (_v, r) => Array.from({ length: n }, (_w, col) => (Math.abs(r - c) + Math.abs(col - c) <= c ? '#' : '.')).join('')) };
}

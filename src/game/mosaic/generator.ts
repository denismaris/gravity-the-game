import { PuzzleDifficulty } from '../puzzleDifficulty';
import { chooseFixedPieces, distinctOrientations, normalise, shapeKey } from './logic';
import { SILHOUETTES, Silhouette, silhouetteGrid } from './silhouettes';
import { countTilings } from './solver';
import { MosaicCell, MosaicOrientation, MosaicPiece, MosaicPuzzle } from './types';

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

export interface MosaicShape {
  readonly minPiece: number;
  readonly maxPiece: number;
  readonly allowFlip: boolean;
}

/** Small, blunt pieces for easy; hard is mostly the awkward five-square
 * shapes. No tier lets pieces be mirrored: most pictures are mirror-
 * symmetric (a vase, an owl, a tree), and with mirroring allowed every
 * filling of one has a mirror-image twin - so no such picture could ever
 * have a single answer. Turning alone keeps them unique, because an L or
 * an S cannot stand in for its own reflection. */
export function shapeForDifficulty(difficulty: PuzzleDifficulty): MosaicShape {
  switch (difficulty) {
    case 'easy':
      return { minPiece: 3, maxPiece: 4, allowFlip: false };
    case 'medium':
      return { minPiece: 3, maxPiece: 5, allowFlip: false };
    case 'hard':
      return { minPiece: 4, maxPiece: 5, allowFlip: false };
  }
}

/** The palette size the board draws each theme in. */
export const PALETTE_SIZE = 5;

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Carves the picture into pieces. Each piece grows from the *most cornered*
 * empty square left (fewest free neighbours) - so narrow places are claimed
 * first rather than being left behind as scraps - and grows into the free
 * square that is itself most cornered. A leftover too small to be a piece
 * joins the smallest neighbour that can take it. Returns null on a dead end
 * (the caller just tries again).
 */
function carve(grid: boolean[][], shape: MosaicShape, random: () => number): MosaicCell[][] | null {
  const rows = grid.length;
  const cols = grid[0].length;
  const owner: number[][] = grid.map(line => line.map(() => -1));
  const regions: MosaicCell[][] = [];
  const free = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < rows && c < cols && grid[r][c] && owner[r][c] === -1;
  const freeDegree = (r: number, c: number): number => NEIGHBOURS.filter(([dr, dc]) => free(r + dr, c + dc)).length;

  for (;;) {
    let seed: MosaicCell | null = null;
    let seedDegree = 99;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!free(r, c)) continue;
        const d = freeDegree(r, c) + random() * 0.9;
        if (d < seedDegree) {
          seedDegree = d;
          seed = { row: r, col: c };
        }
      }
    }
    if (!seed) break;

    const target = shape.minPiece + Math.floor(random() * (shape.maxPiece - shape.minPiece + 1));
    const region: MosaicCell[] = [seed];
    const index = regions.length;
    owner[seed.row][seed.col] = index;
    while (region.length < target) {
      const frontier: MosaicCell[] = [];
      for (const cell of region) {
        for (const [dr, dc] of NEIGHBOURS) if (free(cell.row + dr, cell.col + dc)) frontier.push({ row: cell.row + dr, col: cell.col + dc });
      }
      if (frontier.length === 0) break;
      frontier.sort((a, b) => freeDegree(a.row, a.col) + random() * 1.5 - (freeDegree(b.row, b.col) + random() * 1.5));
      const next = frontier[0];
      owner[next.row][next.col] = index;
      region.push(next);
    }
    regions.push(region);
  }

  // Fold scraps into a neighbour that can still take them.
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    if (region.length === 0 || region.length >= shape.minPiece) continue;
    const candidates = new Set<number>();
    for (const cell of region) {
      for (const [dr, dc] of NEIGHBOURS) {
        const r = cell.row + dr;
        const c = cell.col + dc;
        if (r >= 0 && c >= 0 && r < rows && c < cols && owner[r][c] !== -1 && owner[r][c] !== i) candidates.add(owner[r][c]);
      }
    }
    const host = [...candidates].filter(j => regions[j].length + region.length <= shape.maxPiece).sort((a, b) => regions[a].length - regions[b].length)[0];
    if (host === undefined) return null;
    for (const cell of region) owner[cell.row][cell.col] = host;
    regions[host] = [...regions[host], ...region];
    regions[i] = [];
  }
  return regions.filter(region => region.length > 0);
}

/** Colours the pieces so no two that touch share one, spreading the
 * palette rather than reaching for the first free colour each time. */
function colourPieces(regions: MosaicCell[][], random: () => number): number[] {
  const at = new Map<string, number>();
  regions.forEach((region, i) => region.forEach(c => at.set(`${c.row}:${c.col}`, i)));
  const colours: number[] = [];
  const usage = new Array(PALETTE_SIZE).fill(0);
  regions.forEach((region, i) => {
    const banned = new Set<number>();
    for (const c of region) {
      for (const [dr, dc] of NEIGHBOURS) {
        const j = at.get(`${c.row + dr}:${c.col + dc}`);
        if (j !== undefined && j < i) banned.add(colours[j]);
      }
    }
    const options = Array.from({ length: PALETTE_SIZE }, (_v, k) => k).filter(k => !banned.has(k));
    const pool = options.length > 0 ? options : Array.from({ length: PALETTE_SIZE }, (_v, k) => k);
    pool.sort((a, b) => usage[a] - usage[b] || random() - 0.5);
    colours.push(pool[0]);
    usage[pool[0]] += 1;
  });
  return colours;
}

const MAX_ATTEMPTS = 4000;

/** A shape's identity however it is turned. */
function shapeClassOf(cells: ReadonlyArray<MosaicCell>): string {
  return distinctOrientations(cells, false)
    .map(v => shapeKey(v.cells))
    .sort()[0];
}
const SQUARE_CLASS = shapeClassOf([
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
]);

/** `salt` re-draws the same id if its first cut repeats another board. */
export function generateMosaic(id: string, silhouette: Silhouette, difficulty: PuzzleDifficulty, salt = 0): MosaicPuzzle {
  const shape = shapeForDifficulty(difficulty);
  const random = mulberry32(hashId(salt === 0 ? id : `${id}#${salt}`));
  const grid = silhouetteGrid(silhouette);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const regions = carve(grid, shape, random);
    if (!regions) continue;
    // Reading order, so the tray and the solution list agree.
    const firstSquare = (region: MosaicCell[]) => Math.min(...region.map(c => c.row * 100 + c.col));
    regions.sort((a, b) => firstSquare(a) - firstSquare(b));
    // Variety is most of what makes placing pieces a pleasure rather than
    // a chore: at most one plain 2x2 square (it looks the same however it
    // is turned, so it is the dullest piece there is) and at most two of
    // any one shape.
    const classes = regions.map(region => shapeClassOf(region));
    const tally = new Map<string, number>();
    for (const key of classes) tally.set(key, (tally.get(key) ?? 0) + 1);
    if ((tally.get(SQUARE_CLASS) ?? 0) > 1 || [...tally.values()].some(n => n > 2)) continue;
    const colours = colourPieces(regions, random);
    const pieces: MosaicPiece[] = regions.map((region, i) => ({ id: `p${i}`, cells: normalise(region), color: colours[i] }));
    const solution = regions.map(region => ({
      rotation: 0,
      flipped: false,
      row: Math.min(...region.map(c => c.row)),
      col: Math.min(...region.map(c => c.col)),
    }));
    // Pieces start turned at random - never shown the way they go.
    const start: MosaicOrientation[] = pieces.map(() => ({
      rotation: Math.floor(random() * 4),
      flipped: shape.allowFlip && random() < 0.5,
    }));
    const base: Omit<MosaicPuzzle, 'fixed'> = {
      id,
      name: silhouette.name,
      difficulty,
      subject: silhouette.key,
      theme: silhouette.theme,
      rows: grid.length,
      cols: grid[0].length,
      silhouette: grid,
      pieces,
      solution,
      start,
      allowFlip: shape.allowFlip,
    };
    const puzzle: MosaicPuzzle = { ...base, fixed: chooseFixedPieces(base) };
    if (countTilings(puzzle, 2).solutions === 1) return puzzle;
  }
  throw new Error(`Mosaic ${id}: no uniquely-fitting cut of ${silhouette.key} after ${MAX_ATTEMPTS} attempts.`);
}

export { SILHOUETTES };

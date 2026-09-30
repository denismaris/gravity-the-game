import { PuzzleDifficulty } from '../puzzleDifficulty';
import { fewestMirrors } from './solver';
import { Direction, MirrorMazeCell, MirrorMazePuzzle } from './types';

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

export interface MirrorShape {
  readonly sizes: ReadonlyArray<number>;
  readonly gems: readonly [number, number];
  readonly obstacles: readonly [number, number];
  /** The fewest mirrors a solution may need - the tier's real difficulty. */
  readonly mirrors: readonly [number, number];
}

export function mirrorShapeFor(tier: PuzzleDifficulty): MirrorShape {
  // Bands matched to the curated pool's own (fewest mirrors: easy 1-3,
  // medium 2-6, hard 4-8), nudged to its upper half so an endless board
  // is never a let-down after a curated one.
  if (tier === 'easy') return { sizes: [4, 5], gems: [1, 2], obstacles: [0, 1], mirrors: [2, 3] };
  if (tier === 'medium') return { sizes: [5], gems: [2, 3], obstacles: [1, 2], mirrors: [4, 6] };
  return { sizes: [6], gems: [3, 4], obstacles: [1, 3], mirrors: [6, 9] };
}

/**
 * An endless Mirror Maze board: a source on the rim, a target, gems and a
 * few obstacles scattered at random - kept only if the fewest mirrors any
 * answer needs falls in the tier's band. That count is the honest measure
 * (a board with six gems can still fall to two mirrors), and it is what
 * the curated pool was chosen by too.
 */
export function generateMirrorMaze(id: string, name: string, tier: PuzzleDifficulty): MirrorMazePuzzle {
  const shape = mirrorShapeFor(tier);
  const random = mulberry32(hashId(id));
  const between = ([lo, hi]: readonly [number, number]) => lo + Math.floor(random() * (hi - lo + 1));
  let fallback: MirrorMazePuzzle | null = null;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const size = shape.sizes[Math.floor(random() * shape.sizes.length)];
    const used = new Set<string>();
    const cell = (): MirrorMazeCell => {
      for (;;) {
        const c = { row: Math.floor(random() * size), col: Math.floor(random() * size) };
        const key = `${c.row}:${c.col}`;
        if (!used.has(key)) {
          used.add(key);
          return c;
        }
      }
    };
    const edge = Math.floor(random() * 4);
    const along = Math.floor(random() * size);
    const source = edge === 0 ? { row: 0, col: along } : edge === 1 ? { row: size - 1, col: along } : edge === 2 ? { row: along, col: 0 } : { row: along, col: size - 1 };
    used.add(`${source.row}:${source.col}`);
    const sourceDirection: Direction = edge === 0 ? 'down' : edge === 1 ? 'up' : edge === 2 ? 'right' : 'left';
    const puzzle: MirrorMazePuzzle = {
      id,
      name,
      difficulty: tier,
      rows: size,
      cols: size,
      source,
      sourceDirection,
      target: cell(),
      gems: Array.from({ length: between(shape.gems) }, cell),
      obstacles: Array.from({ length: between(shape.obstacles) }, cell),
    };
    const need = fewestMirrors(puzzle, tier === 'hard' ? 40000 : 20000);
    if (need === null) continue;
    if (need >= shape.mirrors[0] && need <= shape.mirrors[1]) return puzzle;
    if (!fallback && need >= shape.mirrors[0] - 1) fallback = puzzle;
  }
  if (fallback) return fallback;
  throw new Error(`Mirror maze ${id}: no board found`);
}

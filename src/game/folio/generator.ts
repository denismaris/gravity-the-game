import { PuzzleDifficulty } from '../puzzleDifficulty';
import { creasesOf, flatSheet, foldSheet, topInks } from './logic';
import { shortestFolds } from './solver';
import { FOLIO_INKS, FolioInk, FolioPuzzle, FolioSquare } from './types';

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

export interface FolioShape {
  /** The sheets this tier deals, as [width, height]. */
  readonly sizes: ReadonlyArray<readonly [number, number]>;
  /** Folds the target takes. */
  readonly folds: number;
  /** The colours a front is painted from. */
  readonly fronts: ReadonlyArray<FolioInk>;
  /** The colours a back is painted from (never the front's own). */
  readonly backs: ReadonlyArray<FolioInk>;
}

/**
 * Easy sheets have bare paper backs, so the first boards ask one thing:
 * which squares must turn over. Medium paints the backs too, and hard
 * brings the fourth colour and a fourth fold.
 */
export function shapeForDifficulty(difficulty: PuzzleDifficulty): FolioShape {
  switch (difficulty) {
    case 'easy':
      return { sizes: [[3, 2], [2, 3], [3, 3], [4, 2], [2, 4], [4, 3]], folds: 2, fronts: ['vermilion', 'indigo'], backs: ['paper'] };
    case 'medium':
      return { sizes: [[4, 3], [3, 4], [4, 4], [5, 2], [5, 3], [3, 5]], folds: 3, fronts: ['paper', 'vermilion', 'indigo'], backs: ['paper', 'vermilion', 'indigo'] };
    case 'hard':
      return { sizes: [[4, 4], [5, 4], [4, 5], [5, 3]], folds: 4, fronts: ['paper', 'vermilion', 'indigo', 'saffron'], backs: ['paper', 'vermilion', 'indigo', 'saffron'] };
  }
}

const MAX_ATTEMPTS = 400;

/**
 * A board whose target takes exactly the tier's folds - folded at random
 * from a random sheet, then checked with the real search that no shorter
 * folding reaches the same target. Deterministic from `id`.
 */
export function generateFolio(id: string, name: string | undefined, difficulty: PuzzleDifficulty): FolioPuzzle {
  const shape = shapeForDifficulty(difficulty);
  const random = mulberry32(hashId(id));
  const pick = <T,>(list: ReadonlyArray<T>): T => list[Math.floor(random() * list.length)];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [width, height] = pick(shape.sizes);
    const squares: FolioSquare[] = [];
    for (let i = 0; i < width * height; i += 1) {
      const front = pick(shape.fronts);
      const backs = shape.backs.filter(ink => ink !== front);
      squares.push({ front, back: pick(backs) });
    }
    // Both colours of the fronts on the sheet, so it reads as a pattern.
    if (new Set(squares.map(s => s.front)).size < Math.min(2, shape.fronts.length)) continue;

    let sheet = flatSheet({ width, height, squares });
    for (let i = 0; i < shape.folds; i += 1) {
      const creases = creasesOf(sheet);
      if (creases.length === 0) break;
      sheet = foldSheet(sheet, pick(creases));
    }
    const inks = topInks(squares, sheet);
    if (inks.length < 2 || new Set(inks).size < 2) continue;
    // No colour may take most of the target: a target that is nearly all
    // one ink (easy sheets were often all bare paper) asks very little.
    const most = Math.max(...FOLIO_INKS.map(ink => inks.filter(i => i === ink).length));
    if (most > Math.ceil(inks.length / 2)) continue;
    // Medium and hard targets are worth looking at: three squares or more.
    if (shape.folds >= 3 && inks.length < 3 && random() < 0.7) continue;
    // Easy sheets fold to a square most of the time; strips half as often
    // turn up on their own, so the square is passed over now and then.
    if (shape.folds === 2 && sheet.width === sheet.height && random() < 0.5) continue;
    const target = { width: sheet.width, height: sheet.height, inks };
    const path = shortestFolds({ squares, target }, flatSheet({ width, height, squares }));
    if (!path || path.length !== shape.folds) continue;
    return { id, name, difficulty, width, height, squares, target, par: shape.folds };
  }
  throw new Error(`Folio ${id}: no ${difficulty} board after ${MAX_ATTEMPTS} attempts.`);
}

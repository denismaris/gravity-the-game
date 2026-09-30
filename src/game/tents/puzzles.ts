import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, endlessSeed, parseEndlessId } from '../endlessId';
import { generateTents, TentsShape } from './generator';
import { BAKED_TENTS } from './pool.generated';
import { TentsTreesPuzzle } from './types';

/**
 * The pool: ids, names, tiers and shapes, in size order (the pool test
 * holds the ramp). Boards come from `generateTents` - random layouts at
 * about one tent to every five squares, kept only if uniquely solvable -
 * replacing ten hand-drawn symmetric boards that players found "too
 * similar". Ids 001-010 keep their places (names that described the old
 * symmetric layouts were renamed); 011-020 are new. Ids are frozen.
 */
const SPECS: ReadonlyArray<readonly [string, string, PuzzleDifficulty, TentsShape]> = [
  ['tents-001', 'First Grove', 'easy', { size: 5, tents: 4 }],
  ['tents-002', 'Clearing', 'easy', { size: 5, tents: 5 }],
  ['tents-011', 'Birch Hollow', 'easy', { size: 5, tents: 5 }],
  ['tents-003', 'Scattered Grove', 'easy', { size: 6, tents: 6 }],
  ['tents-012', 'Fern Bank', 'easy', { size: 6, tents: 6 }],
  ['tents-013', 'Mossy Glade', 'easy', { size: 6, tents: 7 }],
  ['tents-004', 'Hazel Copse', 'medium', { size: 6, tents: 7 }],
  ['tents-016', 'Riverside', 'medium', { size: 6, tents: 8 }],
  ['tents-005', 'Pine Ridge', 'medium', { size: 7, tents: 8 }],
  ['tents-006', 'Alder Row', 'medium', { size: 7, tents: 9 }],
  ['tents-007', 'Wide Grove', 'medium', { size: 7, tents: 9 }],
  ['tents-014', 'Bracken', 'medium', { size: 7, tents: 10 }],
  ['tents-015', 'Timberline', 'medium', { size: 7, tents: 10 }],
  ['tents-008', 'Thicket', 'hard', { size: 8, tents: 11 }],
  ['tents-017', 'Night Camp', 'hard', { size: 8, tents: 12 }],
  ['tents-009', 'Deep Woods', 'hard', { size: 8, tents: 12 }],
  ['tents-019', 'Wildwood', 'hard', { size: 8, tents: 12 }],
  ['tents-010', 'Old Forest', 'hard', { size: 8, tents: 13 }],
  ['tents-018', 'Greenwood', 'hard', { size: 8, tents: 13 }],
  ['tents-020', 'Heartwood', 'hard', { size: 8, tents: 14 }],
];

/** Builds the pool. Run once, offline, to write `pool.generated.ts`; the
 * app loads that, and the pool test checks the two still agree. */
export function buildTentsPool(): TentsTreesPuzzle[] {
  return SPECS.map(([id, name, difficulty, shape]) => generateTents(id, name, difficulty, shape));
}

export const TENTS_TREES: ReadonlyArray<TentsTreesPuzzle> = BAKED_TENTS;

/**
 * The endless board's shape for a tier, varied from board to board (by the
 * id's seed) within the same bands the curated pool spans - roughly one tent
 * to every five squares, so the density that made the pool feel real
 * carries on past it.
 */
export function endlessTentsShape(id: string, tier: PuzzleDifficulty): TentsShape {
  const seed = endlessSeed(id);
  const choices: Record<PuzzleDifficulty, ReadonlyArray<TentsShape>> = {
    easy: [{ size: 5, tents: 5 }, { size: 6, tents: 6 }, { size: 6, tents: 7 }],
    medium: [{ size: 6, tents: 8 }, { size: 7, tents: 9 }, { size: 7, tents: 10 }],
    hard: [{ size: 8, tents: 12 }, { size: 8, tents: 13 }, { size: 8, tents: 14 }],
  };
  return choices[tier][seed % 3];
}

const endlessCache = new Map<string, TentsTreesPuzzle>();

export function getTentsTreesById(id: string): TentsTreesPuzzle | undefined {
  const found = TENTS_TREES.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'tents') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateTents(id, endlessName(endless.index, 'tents'), endless.tier, endlessTentsShape(id, endless.tier));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getTentsTreesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<TentsTreesPuzzle> {
  return TENTS_TREES.filter(puzzle => puzzle.difficulty === difficulty);
}

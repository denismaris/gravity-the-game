import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateBloom } from './generator';
import { bloomShapeKey } from './logic';
import { BloomPuzzle } from './types';
import { BAKED_BLOOM } from './pool.generated';

/**
 * The shipped pool, named for things that open. Generated at import from
 * each board's id (a few milliseconds for the whole pool - measured, see
 * the pool test), so the ids are the source of truth and are frozen: new
 * boards are appended, never inserted.
 */
const BOARDS: Record<PuzzleDifficulty, ReadonlyArray<string>> = {
  easy: ['First Bud', 'Clover', 'Buttonhole', 'Posy', 'Daisy Chain', 'Primrose', 'Windowbox'],
  medium: ['Lacework', 'Hedgerow', 'Garland', 'Camellia', 'Tea Rose', 'Wild Thyme', 'Trellis'],
  hard: ['Peony', 'Full Bloom', 'Rose Window', 'Arbour', 'The Walled Garden', 'Midsummer'],
};

/** Every board in the pool is a different picture, however it is turned
 * or mirrored - a board that repeats one already dealt is re-drawn with a
 * salt, the same way Arukone+ keeps its shapes new. `noDuplicatePuzzles`
 * checks the result independently. */
function poolFor(difficulty: PuzzleDifficulty, shapesSeen: Set<string>): BloomPuzzle[] {
  return BOARDS[difficulty].map((name, index) => {
    const id = `bloom-${difficulty}-${String(index + 1).padStart(2, '0')}`;
    for (let salt = 0; ; salt += 1) {
      const puzzle = generateBloom(id, name, difficulty, salt);
      const key = bloomShapeKey(puzzle);
      if (shapesSeen.has(key) && salt < 50) continue;
      shapesSeen.add(key);
      return puzzle;
    }
  });
}

/** Builds the pool. Run once, offline, to write `pool.generated.ts`; the
 * app loads that instead (see below), and the pool test checks the two
 * still agree. */
export function buildBloomPool(): BloomPuzzle[] {
  const shapesSeen = new Set<string>();
  return [...poolFor('easy', shapesSeen), ...poolFor('medium', shapesSeen), ...poolFor('hard', shapesSeen)];
}

/** The shipped pool, baked - building it costs tens of milliseconds at
 * every cold start, for boards that never change. The pool test
 * regenerates it and fails on any drift. */
export const BLOOM: ReadonlyArray<BloomPuzzle> = BAKED_BLOOM;

const endlessCache = new Map<string, BloomPuzzle>();

export function getBloomById(id: string): BloomPuzzle | undefined {
  const found = BLOOM.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'bloom') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateBloom(id, endlessName(endless.index, 'bloom'), endless.tier);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getBloomByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BloomPuzzle> {
  return BLOOM.filter(puzzle => puzzle.difficulty === difficulty);
}

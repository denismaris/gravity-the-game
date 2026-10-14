import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { BloomRules, generateBloom } from './generator';
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
/**
 * Later boards that bring something new, each dealt after the plain board
 * it follows (by index): one or two pairs of twins on medium, more on hard. Their
 * ids are their own, so no plain board's id ever moves.
 */
const RULED: Record<PuzzleDifficulty, ReadonlyArray<{ id: string; name: string; after: number; rules: BloomRules }>> = {
  easy: [],
  medium: [
    { id: 'bloom-medium-t01', name: 'Twin Buds', after: 1, rules: { twins: 1 } },
    { id: 'bloom-medium-t02', name: 'Paired Roses', after: 4, rules: { twins: 2 } },
  ],
  hard: [
    { id: 'bloom-hard-t01', name: 'Woven Garland', after: 1, rules: { twins: 2 } },
    { id: 'bloom-hard-t02', name: 'Three Pairs', after: 4, rules: { twins: 3 } },
  ],
};

function poolFor(difficulty: PuzzleDifficulty, shapesSeen: Set<string>): BloomPuzzle[] {
  const make = (id: string, name: string, rules: BloomRules = {}): BloomPuzzle => {
    for (let salt = 0; ; salt += 1) {
      const puzzle = generateBloom(id, name, difficulty, salt, rules);
      const key = bloomShapeKey(puzzle);
      if (shapesSeen.has(key) && salt < 50) continue;
      shapesSeen.add(key);
      return puzzle;
    }
  };
  // Plain boards first, so their salts never depend on the ruled ones.
  const plain = BOARDS[difficulty].map((name, index) => make(`bloom-${difficulty}-${String(index + 1).padStart(2, '0')}`, name));
  const out: BloomPuzzle[] = [];
  plain.forEach((puzzle, index) => {
    out.push(puzzle);
    for (const r of RULED[difficulty]) if (r.after === index) out.push(make(r.id, r.name, r.rules));
  });
  return out;
}

/** What an endless board brings, from its id: twin tiles, often. */
function endlessRules(id: string, tier: PuzzleDifficulty): BloomRules {
  /* eslint-disable no-bitwise -- FNV-1a */
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const roll = (h >>> 0) % 100;
  /* eslint-enable no-bitwise */
  if (tier === 'medium' && roll < 40) return { twins: 1 };
  if (tier === 'hard' && roll < 50) return { twins: roll < 25 ? 2 : 1 };
  return {};
}

/** Builds the pool. Run once, offline, to write `pool.generated.ts`; the
 * app loads that instead (see below), and the pool test checks the two
 * still agree. */
export function buildBloomPool(): BloomPuzzle[] {
  const shapesSeen = new Set<string>();
  const easy = poolFor('easy', shapesSeen);
  const medium = poolFor('medium', shapesSeen);
  const hard = poolFor('hard', shapesSeen);
  return [...easy, ...medium, ...hard];
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
  const puzzle = generateBloom(id, endlessName(endless.index, 'bloom'), endless.tier, 0, endlessRules(id, endless.tier));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getBloomByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BloomPuzzle> {
  return BLOOM.filter(puzzle => puzzle.difficulty === difficulty);
}

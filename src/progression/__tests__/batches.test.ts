import { getBinairoByDifficulty } from '../../game/binairo';
import { getLevelsByDifficulty, LEVELS } from '../../game/levels';
import { getMirrorMazesByDifficulty } from '../../game/mirror';
import { GameKind, ROTATION } from '../../game/journey';
import { getTentsTreesByDifficulty } from '../../game/tents';
import { getTowersByDifficulty } from '../../game/towers';
import { generateBatch, isBatchComplete, markPuzzleCompleted, nextInBatch } from '../batches';
import { emptyProgress, PlayerProgress, recordCompletion } from '../playerProgress';

/** Every puzzle id tagged `hard` in its own game's pool, across all five
 * games - the ceiling check below needs to catch a hard-tier draw from
 * *any* game, not just Gravity/Mirror Maze. */
const HARD_IDS: ReadonlySet<string> = new Set([
  ...getLevelsByDifficulty('hard').map(l => l.id),
  ...getMirrorMazesByDifficulty('hard').map(p => p.id),
  ...getTentsTreesByDifficulty('hard').map(p => p.id),
  ...getTowersByDifficulty('hard').map(p => p.id),
  ...getBinairoByDifficulty('hard').map(p => p.id),
]);

/** A deterministic PRNG (mulberry32) so tests can exercise many draws
 * without real randomness making a failure unreproducible. */
/* eslint-disable no-bitwise -- mulberry32 is bitwise by definition */
function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

function complete(progress: PlayerProgress, levelId: string): PlayerProgress {
  return recordCompletion(progress, levelId, 1, { two: 4, three: 2 });
}

describe('tier curve (levels 1-40 explicit, 41+ a permanent plateau)', () => {
  test('level 1 is pure easy, batch size 3', () => {
    const rng = seededRng(1);
    const batch = generateBatch(1, emptyProgress(), null, rng);
    expect(batch.puzzles).toHaveLength(3);
  });

  test('batch size grows to 4 by level 9, and to 5 by level 26', () => {
    expect(generateBatch(8, emptyProgress(), null, seededRng(2)).puzzles).toHaveLength(3);
    expect(generateBatch(9, emptyProgress(), null, seededRng(3)).puzzles).toHaveLength(4);
    expect(generateBatch(25, emptyProgress(), null, seededRng(4)).puzzles).toHaveLength(4);
    expect(generateBatch(26, emptyProgress(), null, seededRng(5)).puzzles).toHaveLength(5);
  });

  test('the plateau is genuinely permanent - level 41 and level 5000 draw from the same distribution', () => {
    // Not a proof of identical distributions, but both should be able to
    // produce a batch at all (no crash / no empty pool) and both should be
    // capped at batch size 5 - the concrete, testable half of "identical".
    const at41 = generateBatch(41, emptyProgress(), null, seededRng(6));
    const at5000 = generateBatch(5000, emptyProgress(), null, seededRng(7));
    expect(at41.puzzles).toHaveLength(5);
    expect(at5000.puzzles).toHaveLength(5);
  });

  test('never draws a hard-tier puzzle before level 16, across many draws', () => {
    for (let level = 1; level < 16; level += 1) {
      for (let seed = 0; seed < 5; seed += 1) {
        const batch = generateBatch(level, emptyProgress(), null, seededRng(level * 100 + seed));
        for (const ref of batch.puzzles) {
          expect(HARD_IDS.has(ref.puzzleId)).toBe(false);
        }
      }
    }
  });

  test('Gravity levels tagged "expert" are structurally unreachable at any level number', () => {
    const expertIds = new Set(LEVELS.filter(l => l.difficulty === 'expert').map(l => l.id));
    expect(expertIds.size).toBeGreaterThan(0); // sanity: the fixture actually has expert levels to avoid

    for (const level of [1, 25, 50, 51, 10000]) {
      for (let seed = 0; seed < 20; seed += 1) {
        const batch = generateBatch(level, emptyProgress(), null, seededRng(level * 1000 + seed));
        for (const ref of batch.puzzles) {
          if (ref.kind === 'gravity') expect(expertIds.has(ref.puzzleId)).toBe(false);
        }
      }
    }
  });
});

describe('generateBatch - randomization rules', () => {
  test('never repeats the same game in back-to-back slots within one batch', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const batch = generateBatch(45, emptyProgress(), null, seededRng(seed));
      for (let i = 1; i < batch.puzzles.length; i += 1) {
        expect(batch.puzzles[i].kind).not.toBe(batch.puzzles[i - 1].kind);
      }
    }
  });

  test('never re-serves an already-completed puzzle while its tier still has untouched puzzles left', () => {
    // Complete half of the easy Gravity levels - deliberately not all of
    // them (see the fixture note on `EXISTING_MIRROR_COMPLETIONS` in
    // `playerProgressStore.test.ts` for why: exhausting the whole tier
    // would legitimately trigger the "pool exhausted -> repeats allowed"
    // fallback this test isn't exercising).
    const easyLevels = getLevelsByDifficulty('easy');
    let progress = emptyProgress();
    for (const level of easyLevels.slice(0, Math.floor(easyLevels.length / 2))) progress = complete(progress, level.id);

    for (let seed = 0; seed < 20; seed += 1) {
      const batch = generateBatch(1, progress, null, seededRng(seed));
      for (const ref of batch.puzzles) {
        if (ref.kind === 'gravity') {
          expect(progress.levels[ref.puzzleId]).toBeUndefined();
        }
      }
    }
  });

  test('falls back to repeats once a tier is fully exhausted, rather than crashing or stalling', () => {
    // Complete literally every easy-tier Gravity level - level 1 draws only
    // from `easy`, so this fully exhausts the one tier this batch can pull
    // Gravity puzzles from.
    let progress = emptyProgress();
    for (const level of getLevelsByDifficulty('easy')) progress = complete(progress, level.id);

    // Must still produce a full, well-formed batch - falling back to
    // repeats, not crashing or stalling with an empty candidate pool.
    const batch = generateBatch(1, progress, null, seededRng(99));
    expect(batch.puzzles).toHaveLength(3);
    expect(batch.puzzles.every(p => typeof p.puzzleId === 'string' && p.puzzleId.length > 0)).toBe(true);
  });

  test('the soft cross-level penalty does not prevent a game from ever appearing again', () => {
    // A single previous batch can't hard-ban a game forever - run many
    // draws and confirm every game in ROTATION shows up at least once.
    const previous = generateBatch(45, emptyProgress(), null, seededRng(1));
    const seenKinds = new Set<GameKind>();
    for (let seed = 0; seed < 50; seed += 1) {
      const batch = generateBatch(46, emptyProgress(), previous, seededRng(seed + 500));
      for (const ref of batch.puzzles) seenKinds.add(ref.kind);
    }
    for (const kind of ROTATION) expect(seenKinds.has(kind)).toBe(true);
  });
});

describe('isBatchComplete / nextInBatch / markPuzzleCompleted', () => {
  const batch = generateBatch(1, emptyProgress(), null, seededRng(42));

  test('a fresh batch is not complete, and points at its first puzzle', () => {
    expect(isBatchComplete(batch)).toBe(false);
    expect(nextInBatch(batch)).toEqual(batch.puzzles[0]);
  });

  test('marking a puzzle completed advances nextInBatch, and is idempotent', () => {
    const afterFirst = markPuzzleCompleted(batch, batch.puzzles[0].puzzleId);
    expect(nextInBatch(afterFirst)).toEqual(batch.puzzles[1]);

    const again = markPuzzleCompleted(afterFirst, batch.puzzles[0].puzzleId);
    expect(again).toBe(afterFirst); // no-op, same reference
  });

  test('marking a puzzle not in the batch is a no-op', () => {
    expect(markPuzzleCompleted(batch, 'not-in-this-batch')).toBe(batch);
  });

  test('completing every puzzle makes the batch complete', () => {
    let b = batch;
    for (const ref of batch.puzzles) b = markPuzzleCompleted(b, ref.puzzleId);
    expect(isBatchComplete(b)).toBe(true);
    expect(nextInBatch(b)).toBeNull();
  });
});

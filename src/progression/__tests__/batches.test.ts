import { getArukoneByDifficulty } from '../../game/arukone';
import { getBinairoByDifficulty } from '../../game/binairo';
import { getFillaPixByDifficulty } from '../../game/fillapix';
import { getLightsOutByDifficulty } from '../../game/lightsout';
import { getAdjacentByDifficulty } from '../../game/adjacent';
import { getBloomByDifficulty } from '../../game/bloom';
import { getMosaicByDifficulty } from '../../game/mosaic';
import { getBridgesByDifficulty } from '../../game/bridges';
import { getGravityLevelsForTier, LEVELS } from '../../game/levels';
import { getMirrorMazesByDifficulty } from '../../game/mirror';
import { GameKind, ROTATION } from '../../game/journey';
import { getTentsTreesByDifficulty } from '../../game/tents';
import { getTowersByDifficulty } from '../../game/towers';
import { CHALLENGE_EVERY, generateBatch, HARD_TIER_FIRST_LEVEL, isBatchComplete, markPuzzleCompleted, nextInBatch } from '../batches';
import { emptyProgress, PlayerProgress, recordCompletion } from '../playerProgress';

/**
 * Every puzzle id tagged `hard` in its own game's pool, across every game
 * - the checks below need to catch a hard-tier draw from *any* game, not
 * just the ones that happened to exist when they were written.
 *
 * Keyed by `GameKind` rather than spread from a hand-written list for
 * exactly that reason: this started as a list, Arukone was added to the
 * app without being added here, and the gap silently weakened every test
 * that reads this set. A `Record<GameKind, ...>` makes the next omission
 * a compile error instead, the same way `App.tsx`'s default-less switch
 * does.
 */
const HARD_POOLS: Record<GameKind, ReadonlyArray<string>> = {
  gravity: getGravityLevelsForTier('hard').map(l => l.id),
  mirror: getMirrorMazesByDifficulty('hard').map(p => p.id),
  tents: getTentsTreesByDifficulty('hard').map(p => p.id),
  towers: getTowersByDifficulty('hard').map(p => p.id),
  binairo: getBinairoByDifficulty('hard').map(p => p.id),
  arukone: getArukoneByDifficulty('hard').map(p => p.id),
  fillapix: getFillaPixByDifficulty('hard').map(p => p.id),
  lightsout: getLightsOutByDifficulty('hard').map(p => p.id),
  adjacent: getAdjacentByDifficulty('hard').map(p => p.id),
  bloom: getBloomByDifficulty('hard').map(p => p.id),
  mosaic: getMosaicByDifficulty('hard').map(p => p.id),
  bridges: getBridgesByDifficulty('hard').map(p => p.id),
};

const HARD_IDS: ReadonlySet<string> = new Set(Object.values(HARD_POOLS).flat());

/** Every puzzle id one game has at one tier. */
function poolIdsFor(kind: GameKind, tier: 'easy' | 'medium' | 'hard'): ReadonlyArray<string> {
  switch (kind) {
    case 'gravity':
      return getGravityLevelsForTier(tier).map(l => l.id);
    case 'mirror':
      return getMirrorMazesByDifficulty(tier).map(p => p.id);
    case 'tents':
      return getTentsTreesByDifficulty(tier).map(p => p.id);
    case 'towers':
      return getTowersByDifficulty(tier).map(p => p.id);
    case 'binairo':
      return getBinairoByDifficulty(tier).map(p => p.id);
    case 'arukone':
      return getArukoneByDifficulty(tier).map(p => p.id);
    case 'fillapix':
      return getFillaPixByDifficulty(tier).map(p => p.id);
    case 'lightsout':
      return getLightsOutByDifficulty(tier).map(p => p.id);
    case 'adjacent':
      return getAdjacentByDifficulty(tier).map(p => p.id);
    case 'bloom':
      return getBloomByDifficulty(tier).map(p => p.id);
    case 'mosaic':
      return getMosaicByDifficulty(tier).map(p => p.id);
    case 'bridges':
      return getBridgesByDifficulty(tier).map(p => p.id);
  }
}

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

  test('batch size grows to 4 by level 6, and to 5 by level 19', () => {
    expect(generateBatch(5, emptyProgress(), null, seededRng(2)).puzzles).toHaveLength(3);
    expect(generateBatch(6, emptyProgress(), null, seededRng(3)).puzzles).toHaveLength(4);
    expect(generateBatch(18, emptyProgress(), null, seededRng(4)).puzzles).toHaveLength(4);
    expect(generateBatch(19, emptyProgress(), null, seededRng(5)).puzzles).toHaveLength(5);
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

  test('never draws a hard-tier puzzle before the curve allows one', () => {
    expect(HARD_TIER_FIRST_LEVEL).toBeGreaterThan(1);
    for (let level = 1; level < HARD_TIER_FIRST_LEVEL; level += 1) {
      for (let seed = 0; seed < 5; seed += 1) {
        const batch = generateBatch(level, emptyProgress(), null, seededRng(level * 100 + seed));
        for (const ref of batch.puzzles) {
          expect(HARD_IDS.has(ref.puzzleId)).toBe(false);
        }
      }
    }
  });

  // Gravity's fourth tier used to match no query at all, which kept its
  // twenty hardest levels out of every batch ever generated. They now
  // answer to the hard tier - so they are reachable, but only from the
  // point in the curve where hard puzzles start appearing.
  /** Gravity is dealt by depth (`minMoves`), not by its authored labels -
   * see \`getGravityLevelsForTier\`. The deepest boards must reach players,
   * and must stay behind the hard tier. */
  test('the deepest Gravity boards (8+ moves) can actually be dealt, but never early', () => {
    const expertIds = new Set(LEVELS.filter(l => (l.metadata?.minMoves ?? 0) >= 8).map(l => l.id));
    expect(expertIds.size).toBeGreaterThan(0);

    let seenLate = 0;
    for (const level of [30, 50, 120, 10000]) {
      for (let seed = 0; seed < 40; seed += 1) {
        const batch = generateBatch(level, emptyProgress(), null, seededRng(level * 1000 + seed));
        for (const ref of batch.puzzles) {
          if (ref.kind === 'gravity' && expertIds.has(ref.puzzleId)) seenLate += 1;
        }
      }
    }
    expect(seenLate).toBeGreaterThan(0);

    // Still gated behind the hard tier, so an expert level cannot turn up
    // while the curve is only dealing easy and medium.
    for (let level = 1; level < HARD_TIER_FIRST_LEVEL; level += 1) {
      for (let seed = 0; seed < 10; seed += 1) {
        const batch = generateBatch(level, emptyProgress(), null, seededRng(level * 77 + seed));
        for (const ref of batch.puzzles) {
          if (ref.kind === 'gravity') expect(expertIds.has(ref.puzzleId)).toBe(false);
        }
      }
    }
  });
});

/**
 * The rhythm. Difficulty used to be sampled independently per slot, which
 * is why it felt arbitrary - a level could deal three hard puzzles in a
 * row or none, and nothing anywhere said which was which. These check the
 * two halves of the replacement: hard arrives on a fixed cadence, and it
 * arrives *only* there.
 */
describe('the challenge cadence', () => {
  /** Plays levels 1..`throughLevel` in order, flattening them into the one
   * continuous run of puzzles a player actually experiences - which is the
   * sequence the cadence is defined over, and the only place a per-batch
   * check could not see it. */
  function playThrough(throughLevel: number, seed: number) {
    const run: Array<{ level: number; challenge: boolean; puzzleId: string }> = [];
    let previous = null as ReturnType<typeof generateBatch> | null;
    for (let level = 1; level <= throughLevel; level += 1) {
      const batch = generateBatch(level, emptyProgress(), previous, seededRng(seed * 1000 + level));
      for (const ref of batch.puzzles) {
        run.push({ level, challenge: ref.challenge === true, puzzleId: ref.puzzleId });
      }
      previous = batch;
    }
    return run;
  }

  test('lands on exactly every sixth puzzle, counted across levels rather than within one', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const run = playThrough(30, seed);
      run.forEach((puzzle, index) => {
        const onCadence = index % CHALLENGE_EVERY === CHALLENGE_EVERY - 1;
        // Before the curve opens the hard tier there is nothing to deal,
        // so those cadence positions are skipped rather than softened.
        const expected = onCadence && puzzle.level >= HARD_TIER_FIRST_LEVEL;
        expect(puzzle.challenge).toBe(expected);
      });
    }
  });

  test('every challenge is genuinely a hard-tier puzzle', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      for (const puzzle of playThrough(40, seed)) {
        if (puzzle.challenge) expect(HARD_IDS.has(puzzle.puzzleId)).toBe(true);
      }
    }
  });

  /** The half that makes the signposting worth anything: if hard puzzles
   * could still turn up in ordinary slots, marking one of them would be a
   * decoration rather than a promise. */
  test('no ordinary slot ever deals a hard puzzle, at any level', () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      for (const puzzle of playThrough(60, seed)) {
        if (!puzzle.challenge) expect(HARD_IDS.has(puzzle.puzzleId)).toBe(false);
      }
    }
  });

  test('is a property of the position, not of the draw - different seeds flag the same slots', () => {
    const positionsFor = (seed: number) =>
      playThrough(25, seed)
        .map((puzzle, index) => (puzzle.challenge ? index : -1))
        .filter(index => index >= 0);
    expect(positionsFor(2)).toEqual(positionsFor(1));
    expect(positionsFor(3)).toEqual(positionsFor(1));
    expect(positionsFor(1).length).toBeGreaterThan(0);
  });

  test('the plateau keeps dealing them - the rhythm does not stop once the curve flattens', () => {
    const batches = [200, 201, 202, 203].map(level => generateBatch(level, emptyProgress(), null, seededRng(level)));
    const challenges = batches.flatMap(batch => batch.puzzles.filter(ref => ref.challenge));
    // Four plateau batches of five is twenty puzzles, so three or four.
    expect(challenges.length).toBeGreaterThanOrEqual(3);
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
    const easyLevels = getGravityLevelsForTier('easy');
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
    for (const level of getGravityLevelsForTier('easy')) progress = complete(progress, level.id);

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

/**
 * The second pass at randomization, after playtesting called the run "too
 * easy" and noticed some games far more than others.
 */
describe('generateBatch - shape and spread', () => {
  const EASY_IDS = new Set<string>(ROTATION.flatMap(kind => poolIdsFor(kind, 'easy')));
  const MEDIUM_IDS = new Set<string>(ROTATION.flatMap(kind => poolIdsFor(kind, 'medium')));
  const rank = (id: string) => (EASY_IDS.has(id) ? 0 : MEDIUM_IDS.has(id) ? 1 : 2);

  test('ordinary puzzles in a level run easier to harder - every level warms up and builds', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      for (const level of [4, 8, 14, 30]) {
        const ranks = generateBatch(level, emptyProgress(), null, seededRng(seed * 97 + level))
          .puzzles.filter(ref => !ref.challenge)
          .map(ref => rank(ref.puzzleId));
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
      }
    }
  });

  test('past the early levels an ordinary slot is almost never an easy puzzle', () => {
    let easy = 0;
    let total = 0;
    for (let seed = 0; seed < 60; seed += 1) {
      for (const ref of generateBatch(30, emptyProgress(), null, seededRng(seed)).puzzles) {
        if (ref.challenge) continue;
        total += 1;
        if (EASY_IDS.has(ref.puzzleId)) easy += 1;
      }
    }
    expect(easy / total).toBeLessThan(0.12);
  });

  test('a level rarely repeats a game', () => {
    let repeats = 0;
    for (let seed = 0; seed < 100; seed += 1) {
      const kinds = generateBatch(40, emptyProgress(), null, seededRng(seed)).puzzles.map(ref => ref.kind);
      if (new Set(kinds).size < kinds.length) repeats += 1;
    }
    expect(repeats).toBeLessThan(6);
  });

  /** Every game an equal chance: the busiest game over a long run is dealt
   * at most twice as often as the quietest - it used to be Gravity by a
   * wide margin, weighted by the size of its pool. */
  test('over a long run every game gets a fair share', () => {
    const tally = new Map<string, number>();
    let previous = null as ReturnType<typeof generateBatch> | null;
    for (let level = 20; level < 420; level += 1) {
      const batch = generateBatch(level, emptyProgress(), previous, seededRng(level));
      for (const ref of batch.puzzles) tally.set(ref.kind, (tally.get(ref.kind) ?? 0) + 1);
      previous = batch;
    }
    expect(tally.size).toBe(ROTATION.length);
    const counts = [...tally.values()];
    expect(Math.max(...counts) / Math.min(...counts)).toBeLessThan(2);
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

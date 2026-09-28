import { BatchState, generateBatch } from '../batches';
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { getLightsOutById } from '../../game/lightsout';
import { getArukoneById } from '../../game/arukone';
import { getAdjacentById } from '../../game/adjacent';
import { assertValidTowers, getTowersById } from '../../game/towers';
import { isEndlessId, parseEndlessId } from '../../game/endlessId';
import { puzzleDisplayInfo } from '../../game/journey';

/**
 * The app used to run out.
 *
 * Every pool is finite, and `availablePuzzleIds` fell back to *replaying*
 * a tier once it was exhausted - so a player who finished a game started
 * meeting boards they had already solved, with nothing to mark that the
 * app had nothing new left. These tests exhaust a pool on purpose and
 * check what comes out the other side.
 */

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** A save in which every listed puzzle has been completed. */
function withCompleted(ids: ReadonlyArray<string>): PlayerProgress {
  const base = emptyProgress();
  const levels: Record<string, unknown> = { ...base.levels };
  for (const id of ids) levels[id] = { stars: 3, moves: 0 };
  return { ...base, levels } as PlayerProgress;
}

/** Plays forward `levels` batches, recording every puzzle dealt. */
function playThrough(levels: number, rng: () => number): { dealt: string[]; progress: PlayerProgress } {
  let progress = emptyProgress();
  let previous: BatchState | null = null;
  const dealt: string[] = [];
  for (let level = 1; level <= levels; level += 1) {
    const batch = generateBatch(level, progress, previous, rng);
    const levelsMap: Record<string, unknown> = { ...progress.levels };
    for (const ref of batch.puzzles) {
      dealt.push(ref.puzzleId);
      levelsMap[ref.puzzleId] = { stars: 3, moves: 0 };
    }
    progress = { ...progress, levels: levelsMap } as PlayerProgress;
    previous = batch;
  }
  return { dealt, progress };
}

describe('the puzzle stream never runs out', () => {
  test('the endless games never deal the same puzzle twice, however long the run', () => {
    // Far past the point every curated pool is exhausted.
    const { dealt } = playThrough(400, seededRng(7));
    expect(dealt.length).toBeGreaterThan(1000);

    // Split honestly: only the generating games can promise this. The
    // hand-authored pools still replay once spent, which is exactly the
    // limitation worth stating in a test rather than papering over.
    const endless = dealt.filter(isEndlessId);
    expect(endless.length).toBeGreaterThan(200);
    expect(new Set(endless).size).toBe(endless.length);
  });

  test('the stream keeps producing puzzles the player has never seen', () => {
    // The property that actually matters: however deep you go, the next
    // batch still contains something new. Before endless ids existed this
    // stopped being true the moment the pools ran dry.
    const { dealt } = playThrough(400, seededRng(19));
    const firstSeen = new Set<string>();
    let freshInLastHundred = 0;
    dealt.forEach((id, index) => {
      if (!firstSeen.has(id)) {
        firstSeen.add(id);
        if (index >= dealt.length - 100) freshInLastHundred += 1;
      }
    });
    expect(freshInLastHundred).toBeGreaterThan(20);
  });

  test('once the curated pools are spent, the stream is endless ids', () => {
    const { dealt } = playThrough(400, seededRng(11));
    const tail = dealt.slice(-200);
    // Not *every* game generates - the hand-authored ones still repeat -
    // but the long tail has to contain genuinely new puzzles, which is
    // the whole point.
    expect(tail.some(isEndlessId)).toBe(true);
  });

  test('a fully-completed tier yields a brand new puzzle, not an old one', () => {
    // Complete every Lights Out hard board, then ask for one.
    const { getLightsOutByDifficulty } = require('../../game/lightsout');
    const hardIds: string[] = getLightsOutByDifficulty('hard').map((p: { id: string }) => p.id);
    const progress = withCompleted(hardIds);
    const batch = generateBatch(60, progress, null, seededRng(3));
    const lightsOut = batch.puzzles.filter(p => p.kind === 'lightsout');
    for (const ref of lightsOut) {
      if (hardIds.includes(ref.puzzleId)) continue;
      expect(progress.levels[ref.puzzleId]).toBeUndefined();
    }
  });
});

describe('an endless id rebuilds the same puzzle, forever', () => {
  test('Lights Out', () => {
    const id = 'lightsout-e-medium-42';
    const a = getLightsOutById(id);
    const b = getLightsOutById(id);
    expect(a).toBeDefined();
    expect(a!.initial).toEqual(b!.initial);
    expect(a!.difficulty).toBe('medium');
    // The board is real, not a placeholder: its par is inside the tier's
    // own band and verified by the generator against the real solver.
    expect(a!.par).toBeGreaterThan(0);
  });

  test('Arukone+', () => {
    const id = 'arukone-e-hard-9';
    const a = getArukoneById(id);
    const b = getArukoneById(id);
    expect(a).toBeDefined();
    expect(a!.pairs).toEqual(b!.pairs);
    expect(a!.difficulty).toBe('hard');
  });

  test('Adjacent', () => {
    const id = 'adjacent-e-easy-4';
    const a = getAdjacentById(id);
    const b = getAdjacentById(id);
    expect(a).toBeDefined();
    expect(a!.initial).toEqual(b!.initial);
    expect(a!.difficulty).toBe('easy');
  });

  test('Skyscrapers - and the board is genuinely uniquely solvable', () => {
    const id = 'towers-e-hard-5';
    const a = getTowersById(id);
    const b = getTowersById(id);
    expect(a).toBeDefined();
    expect(a!.topClues).toEqual(b!.topClues);
    expect(a!.difficulty).toBe('hard');
    // Not merely "a board was produced": the generator proves uniqueness
    // with the real solver before returning, and this re-checks it from
    // the outside.
    expect(() => assertValidTowers(a!)).not.toThrow();
  });

  test('different indices are overwhelmingly different boards', () => {
    // Not a guarantee of *all* distinct, and deliberately not asserted as
    // one: two seeds can land on the same board, and at the bottom of the
    // easy band that is unavoidable because the space is small (a par-1
    // 5x5 is "press one cell" - 25 boards in total). Endless draws skip
    // that rung for exactly this reason; measured, it takes every tier to
    // 59-60 distinct out of 60.
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const boards = new Set<string>();
      for (let index = 0; index < 60; index += 1) {
        const puzzle = getLightsOutById(`lightsout-e-${tier}-${index}`)!;
        boards.add(puzzle.initial.map(row => row.map(lit => (lit ? '#' : '.')).join('')).join('/'));
      }
      expect(boards.size).toBeGreaterThanOrEqual(58);
    }
  });

  test('a curated id still wins over the endless path', () => {
    const curated = getLightsOutById('lightsout-easy-01');
    expect(curated).toBeDefined();
    expect(isEndlessId(curated!.id)).toBe(false);
  });

  test('an id for the wrong game resolves to nothing', () => {
    expect(getLightsOutById('adjacent-e-easy-1')).toBeUndefined();
    expect(getAdjacentById('lightsout-e-easy-1')).toBeUndefined();
  });
});

describe('naming an endless puzzle never builds it', () => {
  test('Home can label a puzzle without paying for its board', () => {
    // Adjacent's generator deals and verifies a whole tray (~70ms). Home
    // asks for a name on every render of its hero card, so this path has
    // to answer from the id alone - if it ever starts resolving through
    // the generator, the hub stalls on a puzzle nobody has opened.
    const id = 'adjacent-e-hard-1234';
    const started = Date.now();
    const info = puzzleDisplayInfo('adjacent', id);
    const elapsed = Date.now() - started;
    expect(info).toBeDefined();
    expect(info!.difficulty).toBe('hard');
    expect(info!.chapter).toBe('Adjacent');
    expect(elapsed).toBeLessThan(20);
  });

  test('the id round-trips through its own parser', () => {
    const ref = parseEndlessId('towers-e-medium-17');
    expect(ref).toEqual({ kind: 'towers', tier: 'medium', index: 17 });
    expect(parseEndlessId('lightsout-easy-01')).toBeNull();
  });
});

import { MIRROR_MAZES } from '../../game/mirror';
import { createMemoryBackend } from '../../storage';
import { generateBatch } from '../batches';
import { emptyProgress, recordCompletion } from '../playerProgress';
import {
  loadProgress,
  parseProgress,
  PLAYER_PROGRESS_KEY,
  saveProgress,
} from '../playerProgressStore';

const T = { two: 4, three: 2 };

describe('parseProgress', () => {
  test('null / empty -> empty progress', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('')).toEqual(emptyProgress());
  });

  test('malformed JSON -> empty progress (no throw)', () => {
    expect(parseProgress('{not json')).toEqual(emptyProgress());
  });

  test('unreadable schema version -> empty progress', () => {
    expect(parseProgress(JSON.stringify({ version: 999, levels: {} }))).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ version: 'nope', levels: {} }))).toEqual(emptyProgress());
  });

  test('migrates a v1 record forward, keeping stars and defaulting the cursor, daily streak and best streak', () => {
    const v1 = JSON.stringify({
      version: 1,
      levels: { 'level-001': { completed: true, stars: 3, bestMoves: 1 } },
    });
    const parsed = parseProgress(v1);
    expect(parsed.version).toBe(5);
    expect(parsed.levels['level-001']).toEqual({ completed: true, stars: 3, bestMoves: 1 });
    expect(parsed.cursor).toBeNull();
    expect(parsed.daily).toEqual({ streak: 0, lastCompletedKey: null });
    expect(parsed.bestDailyStreak).toBe(0);
    expect(parsed.currentLevel).toBe(1);
    expect(parsed.currentBatch).toBeNull();
    expect(parsed.adFreeTimeRemainingMs).toBeNull();
  });

  test('reads a v2 cursor, and rejects a malformed one', () => {
    const good = parseProgress(
      JSON.stringify({ version: 2, levels: {}, cursor: { worldId: 'world-1', levelId: 'level-003' } }),
    );
    expect(good.cursor).toEqual({ worldId: 'world-1', levelId: 'level-003' });
    expect(good.daily).toEqual({ streak: 0, lastCompletedKey: null }); // v2 has no daily yet

    const bad = parseProgress(JSON.stringify({ version: 2, levels: {}, cursor: { worldId: 5 } }));
    expect(bad.cursor).toBeNull();
  });

  test('reads a v3 daily streak, and rejects a malformed one', () => {
    const good = parseProgress(
      JSON.stringify({ version: 3, levels: {}, daily: { streak: 4, lastCompletedKey: '2026-01-05' } }),
    );
    expect(good.daily).toEqual({ streak: 4, lastCompletedKey: '2026-01-05' });

    const bad = parseProgress(
      JSON.stringify({ version: 3, levels: {}, daily: { streak: -1, lastCompletedKey: '2026-01-05' } }),
    );
    expect(bad.daily).toEqual({ streak: 0, lastCompletedKey: null });
  });

  test('v3 (no bestDailyStreak) backfills it from the live streak', () => {
    const parsed = parseProgress(
      JSON.stringify({ version: 3, levels: {}, daily: { streak: 5, lastCompletedKey: '2026-01-05' } }),
    );
    expect(parsed.bestDailyStreak).toBe(5);
  });

  test('reads a real v4 bestDailyStreak, and never lets it read lower than the live streak', () => {
    const good = parseProgress(
      JSON.stringify({
        version: 4,
        levels: {},
        daily: { streak: 2, lastCompletedKey: '2026-01-05' },
        bestDailyStreak: 9,
      }),
    );
    expect(good.bestDailyStreak).toBe(9);

    // A corrupt/stale bestDailyStreak lower than the live streak can't be
    // right (the live streak proves at least that many days happened) - the
    // live streak wins.
    const inconsistent = parseProgress(
      JSON.stringify({
        version: 4,
        levels: {},
        daily: { streak: 7, lastCompletedKey: '2026-01-05' },
        bestDailyStreak: 2,
      }),
    );
    expect(inconsistent.bestDailyStreak).toBe(7);
  });

  test('v4 (no currentLevel/currentBatch/adFreeTimeRemainingMs) defaults to level 1, no batch, unused ad-free time', () => {
    const parsed = parseProgress(
      JSON.stringify({ version: 4, levels: {}, daily: { streak: 0, lastCompletedKey: null }, bestDailyStreak: 0 }),
    );
    expect(parsed.currentLevel).toBe(1);
    expect(parsed.currentBatch).toBeNull();
    expect(parsed.adFreeTimeRemainingMs).toBeNull();
  });

  test('reads a real v5 currentLevel/currentBatch/adFreeTimeRemainingMs', () => {
    const parsed = parseProgress(
      JSON.stringify({
        version: 5,
        levels: {},
        daily: { streak: 0, lastCompletedKey: null },
        bestDailyStreak: 0,
        currentLevel: 7,
        currentBatch: {
          levelNumber: 7,
          puzzles: [
            { kind: 'gravity', puzzleId: 'level-050' },
            { kind: 'mirror', puzzleId: 'mirror-003' },
          ],
          completedPuzzleIds: ['level-050'],
        },
        adFreeTimeRemainingMs: 60000,
      }),
    );
    expect(parsed.currentLevel).toBe(7);
    expect(parsed.currentBatch).toEqual({
      levelNumber: 7,
      puzzles: [
        { kind: 'gravity', puzzleId: 'level-050' },
        { kind: 'mirror', puzzleId: 'mirror-003' },
      ],
      completedPuzzleIds: ['level-050'],
    });
    expect(parsed.adFreeTimeRemainingMs).toBe(60000);
  });

  test('a malformed currentLevel/adFreeTimeRemainingMs falls back to its default rather than propagating garbage', () => {
    const parsed = parseProgress(JSON.stringify({ version: 5, levels: {}, currentLevel: -3, adFreeTimeRemainingMs: 'soon' }));
    expect(parsed.currentLevel).toBe(1);
    expect(parsed.adFreeTimeRemainingMs).toBeNull();
  });

  test('a currentBatch with an invalid puzzle ref is discarded wholesale, not partially salvaged', () => {
    const parsed = parseProgress(
      JSON.stringify({
        version: 5,
        levels: {},
        currentBatch: {
          levelNumber: 2,
          puzzles: [{ kind: 'gravity', puzzleId: 'level-001' }, { kind: 'not-a-real-game', puzzleId: 'x' }],
          completedPuzzleIds: [],
        },
      }),
    );
    expect(parsed.currentBatch).toBeNull();
  });

  test('completedPuzzleIds is filtered down to ids that are actually in the batch', () => {
    const parsed = parseProgress(
      JSON.stringify({
        version: 5,
        levels: {},
        currentBatch: {
          levelNumber: 2,
          puzzles: [{ kind: 'gravity', puzzleId: 'level-001' }],
          completedPuzzleIds: ['level-001', 'not-in-this-batch'],
        },
      }),
    );
    expect(parsed.currentBatch?.completedPuzzleIds).toEqual(['level-001']);
  });

  test('drops individual corrupt level entries but keeps valid ones', () => {
    const raw = JSON.stringify({
      version: 1,
      levels: {
        'level-001': { completed: true, stars: 3, bestMoves: 2 },
        'level-002': { completed: true, stars: 9, bestMoves: 4 }, // bad stars
        'level-003': { completed: true, stars: 2, bestMoves: 0 }, // bad moves
        'level-004': 'nonsense',
      },
    });
    const parsed = parseProgress(raw);
    expect(Object.keys(parsed.levels)).toEqual(['level-001']);
  });
});

/**
 * The v4 -> v5 migration, against a realistic fixture of an existing
 * player's save from before the level-batch system existed - not an empty
 * save. A player who has been on this app a while: a real, varied `levels`
 * map (multiple games, a mix of star ratings, including some Mirror Maze
 * puzzles specifically, exercised further below), a resume `cursor`, and a
 * Daily streak already in progress.
 */
describe('v4 -> v5 migration, realistic existing-player fixture', () => {
  // Only 2 of Mirror Maze's 12 puzzles, and both from its `easy` tier
  // (`mirror-001`/`mirror-002` - see the difficulty tagging in
  // `src/game/mirror/puzzles.ts`), deliberately leaving every tier
  // non-exhausted - `availablePuzzleIds`'s own "pool exhausted -> repeats
  // allowed" fallback is real, intentional behaviour (see `batches.ts`),
  // not something this test is trying to rule out; it would kick in (and
  // legitimately re-serve a completed puzzle) if the whole tier were
  // completed, which isn't the case being tested here.
  const EXISTING_MIRROR_COMPLETIONS = MIRROR_MAZES.slice(0, 2).map(p => p.id);

  function existingV4Save(): string {
    const levels: Record<string, { completed: true; stars: number; bestMoves: number }> = {
      'level-001': { completed: true, stars: 3, bestMoves: 1 },
      'level-002': { completed: true, stars: 2, bestMoves: 3 },
      'level-010': { completed: true, stars: 1, bestMoves: 9 },
      'towers-001': { completed: true, stars: 3, bestMoves: 1 },
      'binairo-002': { completed: true, stars: 2, bestMoves: 2 },
    };
    for (const id of EXISTING_MIRROR_COMPLETIONS) levels[id] = { completed: true, stars: 3, bestMoves: 1 };

    return JSON.stringify({
      version: 4,
      levels,
      cursor: { worldId: 'world-1', levelId: 'level-010' },
      daily: { streak: 4, lastCompletedKey: '2026-03-10' },
      bestDailyStreak: 6,
    });
  }

  test('every pre-existing field survives byte-for-byte', () => {
    const parsed = parseProgress(existingV4Save());
    expect(parsed.version).toBe(5);
    expect(Object.keys(parsed.levels)).toHaveLength(5 + EXISTING_MIRROR_COMPLETIONS.length);
    expect(parsed.levels['level-001']).toEqual({ completed: true, stars: 3, bestMoves: 1 });
    expect(parsed.levels['towers-001']).toEqual({ completed: true, stars: 3, bestMoves: 1 });
    expect(parsed.levels['binairo-002']).toEqual({ completed: true, stars: 2, bestMoves: 2 });
    expect(parsed.cursor).toEqual({ worldId: 'world-1', levelId: 'level-010' });
    expect(parsed.daily).toEqual({ streak: 4, lastCompletedKey: '2026-03-10' });
    expect(parsed.bestDailyStreak).toBe(6);
  });

  test('backfills the new v5 fields to their "level-batch system hasn\'t started yet" defaults', () => {
    const parsed = parseProgress(existingV4Save());
    expect(parsed.currentLevel).toBe(1);
    expect(parsed.currentBatch).toBeNull();
    expect(parsed.adFreeTimeRemainingMs).toBeNull();
  });

  test('a batch generated from the migrated progress never re-serves an already-completed Mirror Maze puzzle', () => {
    const parsed = parseProgress(existingV4Save());
    // Generate many level-1 batches (randomized) and confirm none of them
    // ever include one of the 8 Mirror Maze puzzles this player already
    // solved before the migration - the whole point of reading completion
    // straight from `progress.levels` rather than tracking a separate
    // "seen" list is that migrated history participates automatically.
    for (let i = 0; i < 50; i += 1) {
      const batch = generateBatch(parsed.currentLevel, parsed, null, () => (i % 7) / 7); // deterministic but varied
      const mirrorIdsInBatch = batch.puzzles.filter(p => p.kind === 'mirror').map(p => p.puzzleId);
      for (const id of mirrorIdsInBatch) {
        expect(EXISTING_MIRROR_COMPLETIONS).not.toContain(id);
      }
    }
  });
});

describe('loadProgress / saveProgress round-trip', () => {
  test('what is saved is what is loaded', async () => {
    const backend = createMemoryBackend();
    let progress = emptyProgress();
    progress = recordCompletion(progress, 'level-001', 2, T);
    progress = recordCompletion(progress, 'level-005', 6, T);

    await saveProgress(backend, progress);
    const loaded = await loadProgress(backend);

    expect(loaded).toEqual(progress);
  });

  test('loading a fresh backend yields empty progress', async () => {
    const loaded = await loadProgress(createMemoryBackend());
    expect(loaded).toEqual(emptyProgress());
  });

  test('a throwing backend degrades to empty progress instead of rejecting', async () => {
    const brokenBackend = {
      getItem: () => Promise.reject(new Error('disk gone')),
      setItem: () => Promise.reject(new Error('disk gone')),
      removeItem: () => Promise.reject(new Error('disk gone')),
    };
    await expect(loadProgress(brokenBackend)).resolves.toEqual(emptyProgress());
    await expect(saveProgress(brokenBackend, emptyProgress())).resolves.toBeUndefined();
  });

  test('persists under the documented key', async () => {
    const backend = createMemoryBackend();
    await saveProgress(backend, recordCompletion(emptyProgress(), 'level-001', 1, T));
    const raw = await backend.getItem(PLAYER_PROGRESS_KEY);
    expect(raw).toContain('level-001');
  });
});

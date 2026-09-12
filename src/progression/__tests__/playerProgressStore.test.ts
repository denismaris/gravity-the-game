import { createMemoryBackend } from '../../storage';
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

  test('migrates a v1 record forward, keeping stars and defaulting the cursor and daily streak', () => {
    const v1 = JSON.stringify({
      version: 1,
      levels: { 'level-001': { completed: true, stars: 3, bestMoves: 1 } },
    });
    const parsed = parseProgress(v1);
    expect(parsed.version).toBe(3);
    expect(parsed.levels['level-001']).toEqual({ completed: true, stars: 3, bestMoves: 1 });
    expect(parsed.cursor).toBeNull();
    expect(parsed.daily).toEqual({ streak: 0, lastCompletedKey: null });
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

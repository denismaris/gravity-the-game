import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createMemoryBackend, StorageBackend } from '../../storage';
import { getDailyEntry } from '../../game/journey';
import { PLAYER_PROGRESS_KEY } from '../playerProgressStore';
import { CompletionOutcome, PlayerProgressProvider, usePlayerProgress } from '../PlayerProgressProvider';

/**
 * Constellation and Trajectory have no authored `StarThresholds` of their
 * own, so `recordCompletion` scores them off the hint count passed through
 * the `moves` slot instead. This is a regression test for a real bug: a
 * flawless (zero-hint) solve was scoring *worse* (1 star) than a solve that
 * used a hint (3 stars), because `computeStars` treats a move count under 1
 * as a defensive/invalid input - exactly the value a perfect hint-based
 * solve legitimately produces.
 */
describe('PlayerProgressProvider - hint-based scoring (Constellation/Trajectory)', () => {
  async function renderWithCapturedApi() {
    const api: { current: ReturnType<typeof usePlayerProgress> | null } = { current: null };

    function Capture() {
      api.current = usePlayerProgress();
      return null;
    }

    await act(async () => {
      ReactTestRenderer.create(
        <PlayerProgressProvider backend={createMemoryBackend()}>
          <Capture />
        </PlayerProgressProvider>,
      );
    });

    return api;
  }

  test('a zero-hint solve earns the maximum 3 stars, not the defensive minimum', async () => {
    const api = await renderWithCapturedApi();

    let outcome!: CompletionOutcome;
    await act(async () => {
      outcome = api.current!.recordCompletion('constellation-01', 0);
    });

    expect(outcome.runStars).toBe(3);
  });

  test('more hints never score better than fewer hints', async () => {
    const api = await renderWithCapturedApi();

    let zeroHints!: CompletionOutcome;
    let oneHint!: CompletionOutcome;
    let manyHints!: CompletionOutcome;
    await act(async () => {
      zeroHints = api.current!.recordCompletion('trajectory-01', 0);
      oneHint = api.current!.recordCompletion('trajectory-02', 1);
      manyHints = api.current!.recordCompletion('trajectory-03', 4);
    });

    expect(zeroHints.runStars).toBe(3);
    expect(oneHint.runStars).toBe(2);
    expect(manyHints.runStars).toBe(1);
  });
});

describe('PlayerProgressProvider - Daily streak', () => {
  async function renderWithCapturedApi() {
    const api: { current: ReturnType<typeof usePlayerProgress> | null } = { current: null };

    function Capture() {
      api.current = usePlayerProgress();
      return null;
    }

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PlayerProgressProvider backend={createMemoryBackend()}>
          <Capture />
        </PlayerProgressProvider>,
      );
    });

    return { api, renderer };
  }

  test('starts unplayed', async () => {
    const { api } = await renderWithCapturedApi();
    expect(api.current!.dailyStreak).toBe(0);
    expect(api.current!.dailyCompletedToday).toBe(false);
  });

  test('completing today’s Daily entry starts a streak and flips "completed today"', async () => {
    const { api } = await renderWithCapturedApi();
    const daily = getDailyEntry();

    await act(async () => {
      api.current!.recordCompletion(daily.puzzleId, 1);
    });

    expect(api.current!.dailyStreak).toBe(1);
    expect(api.current!.dailyCompletedToday).toBe(true);
  });

  test('completing a puzzle that is not today’s Daily leaves the streak untouched', async () => {
    const { api } = await renderWithCapturedApi();
    const daily = getDailyEntry();
    const other = daily.puzzleId === 'level-001' ? 'level-002' : 'level-001';

    await act(async () => {
      api.current!.recordCompletion(other, 1);
    });

    expect(api.current!.dailyStreak).toBe(0);
    expect(api.current!.dailyCompletedToday).toBe(false);
  });

  test('replaying today’s Daily again does not double the streak', async () => {
    const { api } = await renderWithCapturedApi();
    const daily = getDailyEntry();

    await act(async () => {
      api.current!.recordCompletion(daily.puzzleId, 2);
      api.current!.recordCompletion(daily.puzzleId, 0);
    });

    expect(api.current!.dailyStreak).toBe(1);
  });
});

/**
 * Regression test for a real race: `recordCompletion`/`markLevelOpened` read
 * and write through `progressRef.current`, which starts as `emptyProgress()`
 * until the initial `loadProgress()` call resolves. A mutation that landed in
 * that window used to be saved on top of an empty base (silently discarding
 * whatever was really on disk) and then, when the load's own `.then` finally
 * ran, unconditionally overwritten in memory by the stale pre-write data it
 * had read - so a fast tap right after a cold launch could both lose its own
 * effect in-session AND permanently wipe a returning player's real progress
 * on the next restart. Fixed by queuing mutations made before `ready` and
 * replaying them on top of the real loaded data once it arrives.
 */
describe('PlayerProgressProvider - mutation vs. initial load race', () => {
  test('a mutation before the load resolves survives, and never wipes what was already on disk', async () => {
    const seeded = {
      version: 3,
      levels: { 'level-001': { completed: true, stars: 3, bestMoves: 2 } },
      cursor: null,
      daily: { streak: 0, lastCompletedKey: null },
    };
    const backend = createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(seeded) });

    // Wraps the seeded backend so `getItem` doesn't resolve until the test
    // says so - this lets a mutation be deterministically landed inside the
    // load's async gap, exactly the window the race lived in.
    let releaseLoad!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseLoad = resolve;
    });
    const delayedBackend: StorageBackend = {
      getItem: async key => {
        await gate;
        return backend.getItem(key);
      },
      setItem: (key, value) => backend.setItem(key, value),
      removeItem: key => backend.removeItem(key),
    };

    const api: { current: ReturnType<typeof usePlayerProgress> | null } = { current: null };
    function Capture() {
      api.current = usePlayerProgress();
      return null;
    }

    act(() => {
      ReactTestRenderer.create(
        <PlayerProgressProvider backend={delayedBackend}>
          <Capture />
        </PlayerProgressProvider>,
      );
    });

    // The load is still in flight - nothing has resolved yet.
    expect(api.current!.ready).toBe(false);

    // A completion arrives in that window (e.g. a very fast tap right after
    // a cold launch, before storage has finished its first read).
    let outcome!: CompletionOutcome;
    act(() => {
      outcome = api.current!.recordCompletion('level-002', 3);
    });
    expect(outcome.best.stars).toBeGreaterThan(0);
    expect(api.current!.isCompleted('level-002')).toBe(true);

    // Now let the real load resolve, and flush the microtask chain it
    // triggers (its `.then`, plus the deferred save it fires).
    releaseLoad();
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    });

    expect(api.current!.ready).toBe(true);
    // The pre-load completion must survive, not be reverted by the load...
    expect(api.current!.isCompleted('level-002')).toBe(true);
    // ...and the completion that was already on disk before any of this
    // must still be there too - not wiped by a write based on an empty base.
    expect(api.current!.isCompleted('level-001')).toBe(true);

    // What's actually persisted must reflect both, not just this session's
    // in-memory state.
    const persistedRaw = await backend.getItem(PLAYER_PROGRESS_KEY);
    const persisted = JSON.parse(persistedRaw!);
    expect(persisted.levels['level-001']).toBeDefined();
    expect(persisted.levels['level-002']).toBeDefined();
  });
});

describe('PlayerProgressProvider - resetProgress', () => {
  test('wipes stars/completions in memory and on disk', async () => {
    const backend = createMemoryBackend();
    const api: { current: ReturnType<typeof usePlayerProgress> | null } = { current: null };
    function Capture() {
      api.current = usePlayerProgress();
      return null;
    }

    await act(async () => {
      ReactTestRenderer.create(
        <PlayerProgressProvider backend={backend}>
          <Capture />
        </PlayerProgressProvider>,
      );
    });

    await act(async () => {
      api.current!.recordCompletion('level-001', 2);
      api.current!.markLevelOpened('level-002');
    });
    expect(api.current!.isCompleted('level-001')).toBe(true);
    expect(api.current!.progress.cursor).not.toBeNull();

    await act(async () => {
      api.current!.resetProgress();
    });

    expect(api.current!.isCompleted('level-001')).toBe(false);
    expect(api.current!.progress.cursor).toBeNull();
    expect(api.current!.totalStars).toBe(0);

    // The reset must reach disk too, not just this session's memory - a
    // relaunch right after resetting should not bring the old stars back.
    const raw = await backend.getItem(PLAYER_PROGRESS_KEY);
    expect(raw).toBeNull();
  });
});

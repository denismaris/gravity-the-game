import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createMemoryBackend } from '../../storage';
import { getDailyEntry } from '../../game/journey';
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

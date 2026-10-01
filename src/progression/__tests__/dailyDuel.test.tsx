import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress, PLAYER_PROGRESS_KEY } from '../playerProgressStore';
import { PlayerProgressProvider, usePlayerProgress } from '../PlayerProgressProvider';
import { formatDuration, notePuzzleOpened, standing } from '../timing';
import { createMemoryBackend } from '../../storage';
import { dailyKeyOf, getDailyEntry } from '../../game/journey';

test('times read like a clock, and a time stands among its own', () => {
  expect(formatDuration(151_000)).toBe('2:31');
  expect(formatDuration(5_000)).toBe('0:05');
  expect(standing(90, [120, 90, 200, 150])).toEqual({ place: 1, of: 4, beat: 1 });
  expect(standing(150, [120, 90, 200, 150])).toEqual({ place: 3, of: 4, beat: 1 / 3 });
});

test("today's Daily is timed from the moment it opened, ranked, and kept - once", async () => {
  const today = dailyKeyOf(new Date());
  const save: PlayerProgress = { ...emptyProgress(), dailyTimes: { '2026-01-01': 300_000, '2026-01-02': 100_000 } };
  let api!: ReturnType<typeof usePlayerProgress>;
  function Probe(): null {
    api = usePlayerProgress();
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(
      <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(save) })}>
        <Probe />
      </PlayerProgressProvider>,
    );
  });
  const daily = getDailyEntry().puzzleId;
  notePuzzleOpened(daily, Date.now() - 150_000);
  let outcome!: ReturnType<typeof api.recordCompletion>;
  act(() => {
    outcome = api.recordCompletion(daily, 0);
  });
  expect(outcome.daily?.ms).toBeGreaterThanOrEqual(150_000);
  expect(outcome.daily).toMatchObject({ place: 2, of: 3, best: 100_000 });
  expect(api.progress.dailyTimes[today]).toBe(outcome.daily!.ms);
  // Solving it again the same day is not a new time.
  act(() => {
    outcome = api.recordCompletion(daily, 0);
  });
  expect(outcome.daily).toBeNull();
  expect(parseProgress(JSON.stringify(api.progress)).dailyTimes[today]).toBeGreaterThan(0);
});

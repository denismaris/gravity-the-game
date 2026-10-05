import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { cleanRunMultiplier, FIRST_SOLVE_COINS, GOLDEN_EVERY, GOLDEN_MULTIPLIER } from '../coins';
import { emptyProgress, PlayerProgress, recordCompletion } from '../playerProgress';
import { ROTATION } from '../../game/journey';
import { endlessId } from '../../game/endlessId';
import { generateBatch, replaceInBatch } from '../batches';
import { parseProgress, PLAYER_PROGRESS_KEY } from '../playerProgressStore';
import { PlayerProgressProvider, usePlayerProgress } from '../PlayerProgressProvider';
import { createMemoryBackend } from '../../storage';
import { BLOOM } from '../../game/bloom';
import { getDailyEntry } from '../../game/journey';

/**
 * The two coin bonuses: golden puzzles (a surprise, dealt about one in
 * eight, paying triple on a first solve) and the clean-run combo
 * (consecutive hint-free first solves multiply what each pays).
 */

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('the clean-run combo', () => {
  test('steps up at two, three and five clean solves in a row', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(cleanRunMultiplier)).toEqual([1, 1, 1.2, 1.5, 1.5, 2, 2]);
  });
});

/** A player every game has already reached, one generated board each. */
function everyGame(): PlayerProgress {
  return ROTATION.reduce((p, kind) => recordCompletion(p, endlessId(kind, 'medium', 900), 1, { two: 4, three: 2 }), emptyProgress());
}

describe('golden puzzles', () => {
  test('are dealt about one in eight, across every kind of slot', () => {
    let golden = 0;
    let dealt = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const batch = generateBatch(10 + (seed % 60), everyGame(), null, seeded(seed));
      dealt += batch.puzzles.length;
      golden += batch.puzzles.filter(p => p.golden).length;
    }
    expect(golden / dealt).toBeGreaterThan(0.6 / GOLDEN_EVERY);
    expect(golden / dealt).toBeLessThan(1.4 / GOLDEN_EVERY);
  });

  test('stay golden when swapped, and survive a save round-trip', () => {
    let found: ReturnType<typeof generateBatch> | null = null;
    for (let seed = 1; !found; seed += 1) {
      const batch = generateBatch(24, emptyProgress(), null, seeded(seed));
      if (batch.puzzles[0].golden) found = batch;
    }
    const swapped = replaceInBatch(found, [found.puzzles[0].puzzleId], emptyProgress(), seeded(5));
    expect(swapped.puzzles[0].golden).toBe(true);

    const saved: PlayerProgress = { ...emptyProgress(), currentBatch: found, cleanRun: 4 };
    const loaded = parseProgress(JSON.stringify(saved));
    expect(loaded.currentBatch?.puzzles[0].golden).toBe(true);
    expect(loaded.currentBatch?.puzzles.filter(p => p.golden).length).toBe(found.puzzles.filter(p => p.golden).length);
    expect(loaded.cleanRun).toBe(4);
    expect(parseProgress(JSON.stringify({ ...saved, cleanRun: undefined })).cleanRun).toBe(0);
  });
});

describe('through the provider', () => {
  // Never today's Daily, whose bonus would muddy the sums.
  const boards = BLOOM.filter(p => p.id !== getDailyEntry().puzzleId);

  async function mount(save: PlayerProgress) {
    let api!: ReturnType<typeof usePlayerProgress>;
    function Probe(): null {
      api = usePlayerProgress();
      return null;
    }
    const backend = createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(save) });
    await act(async () => {
      ReactTestRenderer.create(
        <PlayerProgressProvider backend={backend}>
          <Probe />
        </PlayerProgressProvider>,
      );
    });
    return () => api;
  }

  // A set of two, the first golden - so solving it does not also finish
  // the set and add that bonus.
  const save: PlayerProgress = {
    ...emptyProgress(),
    currentBatch: {
      levelNumber: 3,
      puzzles: [
        { kind: 'bloom', puzzleId: boards[0].id, golden: true },
        { kind: 'bloom', puzzleId: boards[1].id },
      ],
      completedPuzzleIds: [],
    },
  };

  test('a golden puzzle pays triple on its first solve, and says so', async () => {
    const api = await mount(save);
    let outcome!: ReturnType<ReturnType<typeof usePlayerProgress>['recordCompletion']>;
    act(() => {
      outcome = api().recordCompletion(boards[0].id, 0);
    });
    expect(outcome.golden).toBe(true);
    expect(outcome.coinsEarned).toBe(FIRST_SOLVE_COINS[3] * GOLDEN_MULTIPLIER);
    expect(api().lastBonus?.golden).toBe(true);
  });

  test('clean first solves build the combo; a hint breaks it; a replay leaves it be', async () => {
    const api = await mount(save);
    const runs: Array<[number, number, number]> = [];
    act(() => {
      for (const board of boards.slice(2, 7)) {
        const o = api().recordCompletion(board.id, 0);
        runs.push([o.cleanRun, o.comboMultiplier, o.coinsEarned]);
      }
    });
    expect(runs.map(r => r[0])).toEqual([1, 2, 3, 4, 5]);
    expect(runs.map(r => r[1])).toEqual([1, 1.2, 1.5, 1.5, 2]);
    expect(runs.map(r => r[2])).toEqual([1, 1.2, 1.5, 1.5, 2].map(m => Math.round(FIRST_SOLVE_COINS[3] * m)));

    act(() => {
      const hinted = api().recordCompletion(boards[7].id, 1);
      expect(hinted.cleanRun).toBe(0);
      expect(hinted.comboMultiplier).toBe(1);
    });
    act(() => {
      const replay = api().recordCompletion(boards[2].id, 0);
      expect(replay.cleanRun).toBe(0);
    });
    expect(api().progress.cleanRun).toBe(0);
  });
});

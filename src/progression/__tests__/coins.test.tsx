import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  coinsForSolve,
  DAILY_BONUS,
  emptyProgress,
  FIRST_SOLVE_COINS,
  parseProgress,
  SET_BONUS,
  STAR_UPGRADE_COINS,
  STARTING_COINS,
} from '..';
import { PlayerProgressProvider, usePlayerProgress } from '../PlayerProgressProvider';
import { createMemoryBackend } from '../../storage';
import { BLOOM } from '../../game/bloom';

describe('what a solve is worth', () => {
  test('a first solve pays by its stars', () => {
    for (const stars of [1, 2, 3] as const) {
      expect(coinsForSolve({ previousStars: 0, bestStars: stars, firstDailyToday: false, setCompleted: false })).toBe(
        FIRST_SOLVE_COINS[stars],
      );
    }
  });

  /** The anti-farming rule: a replay pays only for stars it newly earns. */
  test('a replay pays only for new stars, and nothing for none', () => {
    expect(coinsForSolve({ previousStars: 1, bestStars: 3, firstDailyToday: false, setCompleted: false })).toBe(2 * STAR_UPGRADE_COINS);
    expect(coinsForSolve({ previousStars: 3, bestStars: 3, firstDailyToday: false, setCompleted: false })).toBe(0);
  });

  test('the Daily and a finished set add their bonuses', () => {
    expect(coinsForSolve({ previousStars: 3, bestStars: 3, firstDailyToday: true, setCompleted: true })).toBe(DAILY_BONUS + SET_BONUS);
  });
});

describe('the saved balance', () => {
  test('a new player starts with the grant', () => {
    expect(emptyProgress().coins).toBe(STARTING_COINS);
  });

  /** Coins were added without a version bump - an existing save must load
   * with the grant rather than zero, and a stored balance must survive. */
  test('a save from before coins reads as the grant; a real balance round-trips', () => {
    const old = JSON.stringify({ ...emptyProgress(), coins: undefined });
    expect(parseProgress(old).coins).toBe(STARTING_COINS);
    expect(parseProgress(JSON.stringify({ ...emptyProgress(), coins: 137 })).coins).toBe(137);
  });

  test('a malformed balance falls back to the grant, never negative or fractional', () => {
    expect(parseProgress(JSON.stringify({ ...emptyProgress(), coins: -5 })).coins).toBe(STARTING_COINS);
    expect(parseProgress(JSON.stringify({ ...emptyProgress(), coins: 'lots' })).coins).toBe(STARTING_COINS);
    expect(parseProgress(JSON.stringify({ ...emptyProgress(), coins: 12.7 })).coins).toBe(12);
  });
});

describe('earning and spending through the provider', () => {
  function mount() {
    let api!: ReturnType<typeof usePlayerProgress>;
    function Probe(): null {
      api = usePlayerProgress();
      return null;
    }
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    return {
      async start() {
        await act(async () => {
          renderer = ReactTestRenderer.create(
            <PlayerProgressProvider backend={createMemoryBackend()}>
              <Probe />
            </PlayerProgressProvider>,
          );
        });
      },
      api: () => api,
      unmount: () => act(() => renderer.unmount()),
    };
  }

  test('a first solve pays out once; solving it again the same way pays nothing', async () => {
    const harness = mount();
    await harness.start();
    const before = harness.api().coins;
    let outcome!: ReturnType<ReturnType<typeof usePlayerProgress>['recordCompletion']>;
    act(() => {
      outcome = harness.api().recordCompletion(BLOOM[0].id, 0);
    });
    expect(outcome.coinsEarned).toBeGreaterThanOrEqual(FIRST_SOLVE_COINS[3]);
    expect(harness.api().coins).toBe(before + outcome.coinsEarned);

    const afterFirst = harness.api().coins;
    act(() => {
      outcome = harness.api().recordCompletion(BLOOM[0].id, 0);
    });
    expect(outcome.coinsEarned).toBe(0);
    expect(harness.api().coins).toBe(afterFirst);
    harness.unmount();
  });

  test('spending takes coins while they last, then refuses without going negative', async () => {
    // A fixed price, not HINT_COST: this is about how spending works, and
    // the hint price is set to 0 while the games are being playtested.
    const PRICE = 10;
    const harness = mount();
    await harness.start();
    const affordable = Math.floor(harness.api().coins / PRICE);
    for (let i = 0; i < affordable; i += 1) {
      let ok = false;
      act(() => {
        ok = harness.api().spendCoins(PRICE);
      });
      expect(ok).toBe(true);
    }
    const left = harness.api().coins;
    expect(left).toBeLessThan(PRICE);
    let refused = true;
    act(() => {
      refused = !harness.api().spendCoins(PRICE);
    });
    expect(refused).toBe(true);
    expect(harness.api().coins).toBe(left);
    harness.unmount();
  });
});

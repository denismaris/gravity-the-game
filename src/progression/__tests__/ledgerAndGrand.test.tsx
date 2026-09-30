import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { daysLeftInWeek, getWeeklyGrand, grandIdFor, grandWeekOf, puzzleDisplayInfo, ROTATION, weekIndexOf } from '../../game/journey';
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress, PLAYER_PROGRESS_KEY } from '../playerProgressStore';
import { GRAND_COINS, GRAND_REWARDS, nextGrandReward, recordGrand } from '../grand';
import { STAMP_COINS, STAMP_STEPS, claimStamp, ledgerOf, unclaimedStamps } from '../ledger';
import { buyCosmetic, owns } from '../shop';
import { endlessId } from '../../game/endlessId';
import { PlayerProgressProvider, usePlayerProgress } from '../PlayerProgressProvider';
import { createMemoryBackend } from '../../storage';
import { getTentsTreesById } from '../../game/tents';

const MONDAY = new Date('2026-09-28T09:00:00Z');
const SUNDAY = new Date('2026-10-04T22:00:00Z');
const NEXT_MONDAY = new Date('2026-10-05T01:00:00Z');

describe('the Weekly Grand', () => {
  test('weeks run Monday to Sunday, UTC', () => {
    expect(weekIndexOf(SUNDAY)).toBe(weekIndexOf(MONDAY));
    expect(weekIndexOf(NEXT_MONDAY)).toBe(weekIndexOf(MONDAY) + 1);
    expect(daysLeftInWeek(MONDAY)).toBe(7);
    expect(daysLeftInWeek(SUNDAY)).toBe(1);
  });

  test('is the same board all week, a new game each week, never a retired one', () => {
    const a = getWeeklyGrand(MONDAY);
    expect(getWeeklyGrand(SUNDAY)).toEqual({ ...a, daysLeft: 1 });
    const b = getWeeklyGrand(NEXT_MONDAY);
    expect(b.kind).not.toBe(a.kind);
    expect(grandWeekOf(a.puzzleId)).toBe(a.week);
    expect(getWeeklyGrand(MONDAY, [a.kind]).kind).not.toBe(a.kind);
    // Every game gets its turn over a rotation's worth of weeks.
    const kinds = new Set(Array.from({ length: ROTATION.length }, (_v, i) => getWeeklyGrand(new Date(MONDAY.getTime() + i * 7 * 86400000)).kind));
    expect(kinds.size).toBe(ROTATION.length);
  });

  test('is a real, hard, named board - and never one the dealer hands out', () => {
    const tents = grandIdFor(weekIndexOf(MONDAY), 'tents');
    const board = getTentsTreesById(tents);
    expect(board?.difficulty).toBe('hard');
    expect(puzzleDisplayInfo('tents', tents)?.name).toMatch(/^The Grand /);
    expect(grandWeekOf(endlessId('tents', 'hard', 40))).toBeNull();
  });

  test('pays once a week, and its exclusives at their milestones', () => {
    let p: PlayerProgress = emptyProgress();
    const coinsBefore = p.coins;
    const week = weekIndexOf(MONDAY);
    const first = recordGrand(p, grandIdFor(week, 'tents'), MONDAY)!;
    expect(first.progress.coins).toBe(coinsBefore + GRAND_COINS);
    expect(first.cosmetic).toBe(GRAND_REWARDS[0].cosmetic);
    expect(owns(first.progress, GRAND_REWARDS[0].cosmetic)).toBe(true);
    p = first.progress;
    expect(recordGrand(p, grandIdFor(week, 'tents'), SUNDAY)).toBeNull();
    // Finished just after midnight on Monday: last week's still counts.
    const late = recordGrand({ ...p, grandsSolved: [] }, grandIdFor(week, 'bloom'), NEXT_MONDAY);
    expect(late).not.toBeNull();
    // Older than that, or from the future, does not.
    expect(recordGrand(p, grandIdFor(week - 2, 'tents'), MONDAY)).toBeNull();
    expect(recordGrand(p, grandIdFor(week + 1, 'tents'), MONDAY)).toBeNull();
    expect(nextGrandReward(p)?.at).toBe(GRAND_REWARDS[1].at);
  });

  test('its exclusives cannot be bought, and are not owned until won', () => {
    const rich = { ...emptyProgress(), coins: 100000 };
    for (const { cosmetic } of GRAND_REWARDS) {
      expect(owns(rich, cosmetic)).toBe(false);
      expect(buyCosmetic(rich, cosmetic)).toBeNull();
    }
  });
});

describe('the ledger', () => {
  function withSolves(kind: 'tents' | 'bloom', count: number, stars: 1 | 2 | 3 = 3): PlayerProgress['levels'] {
    const levels: Record<string, { completed: true; stars: 1 | 2 | 3; bestMoves: number }> = {};
    for (let i = 0; i < count; i += 1) levels[endlessId(kind, i % 3 === 0 ? 'hard' : 'easy', i)] = { completed: true, stars, bestMoves: 1 };
    return levels;
  }

  test('counts each game from the save alone', () => {
    const p = { ...emptyProgress(), levels: { ...withSolves('tents', 12), ...withSolves('bloom', 3, 2) } };
    const ledger = ledgerOf(p);
    expect(ledger.tents.solved).toBe(12);
    expect(ledger.tents.perfect).toBe(12);
    expect(ledger.tents.byTier.hard).toBe(4);
    expect(ledger.bloom.stars).toBe(6);
    expect(ledger.gravity.solved).toBe(0);
  });

  test('a stamp is earned at its step, paid once, and never before', () => {
    const p = { ...emptyProgress(), levels: withSolves('tents', 26) };
    expect(unclaimedStamps(p).map(s => s.step)).toEqual([10, 25]);
    expect(claimStamp(p, 'tents', 50)).toBeNull();
    const paid = claimStamp(p, 'tents', 25)!;
    expect(paid.coins).toBe(p.coins + STAMP_COINS[1]);
    expect(claimStamp(paid, 'tents', 25)).toBeNull();
    expect(unclaimedStamps(paid).map(s => s.step)).toEqual([10]);
    expect(STAMP_STEPS).toEqual([10, 25, 50, 100]);
  });
});

describe('the save', () => {
  test('new fields round-trip, and default sensibly on an older save', () => {
    const p: PlayerProgress = { ...emptyProgress(), grandsSolved: [2900, 2901], stampsClaimed: ['tents:10'], introSeen: true };
    const back = parseProgress(JSON.stringify(p));
    expect(back.grandsSolved).toEqual([2900, 2901]);
    expect(back.stampsClaimed).toEqual(['tents:10']);
    expect(back.introSeen).toBe(true);

    const old = { ...emptyProgress(), grandsSolved: undefined, stampsClaimed: undefined, introSeen: undefined };
    expect(parseProgress(JSON.stringify(old)).introSeen).toBe(false);
    // Someone who has already played is not walked through the basics.
    const played = { ...old, levels: { 'tents-e-easy-0': { completed: true, stars: 3, bestMoves: 1 } } };
    expect(parseProgress(JSON.stringify(played)).introSeen).toBe(true);
  });
});

describe('through the provider', () => {
  test('solving this week\'s Grand pays and names its exclusive; stamps and the intro are recorded', async () => {
    let api!: ReturnType<typeof usePlayerProgress>;
    function Probe(): null {
      api = usePlayerProgress();
      return null;
    }
    const save = { ...emptyProgress(), levels: Object.fromEntries(Array.from({ length: 10 }, (_v, i) => [endlessId('tents', 'easy', i), { completed: true, stars: 3, bestMoves: 1 }])) };
    await act(async () => {
      ReactTestRenderer.create(
        <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(save) })}>
          <Probe />
        </PlayerProgressProvider>,
      );
    });
    const grand = getWeeklyGrand();
    let outcome!: ReturnType<typeof api.recordCompletion>;
    act(() => {
      outcome = api.recordCompletion(grand.puzzleId, 0);
    });
    expect(outcome.grand).toBe(true);
    expect(outcome.grandCosmetic).toBe(GRAND_REWARDS[0].cosmetic);
    expect(api.lastBonus?.grand).toBe(true);
    expect(api.progress.grandsSolved).toEqual([grand.week]);

    const before = api.coins;
    act(() => {
      expect(api.claimStamp('tents', 10)).toBe(true);
    });
    expect(api.coins).toBe(before + STAMP_COINS[0]);

    act(() => api.markIntroSeen());
    expect(api.progress.introSeen).toBe(true);
  });
});

import { emptyProgress, PlayerProgress } from '../../progression/playerProgress';
import { isFresh, mergeProgress } from '../merge';

const base = (over: Partial<PlayerProgress>): PlayerProgress => ({ ...emptyProgress(), ...over });
const solved = (stars: 1 | 2 | 3, bestMoves = 10) => ({ completed: true as const, stars, bestMoves });

describe('mergeProgress', () => {
  it('keeps every puzzle at its best from either copy', () => {
    const phone = base({ levels: { a: solved(1, 20), b: solved(3) } });
    const tablet = base({ levels: { a: solved(3, 25), c: solved(2) } });
    const merged = mergeProgress(phone, tablet);
    expect(merged.levels.a).toEqual({ completed: true, stars: 3, bestMoves: 20 });
    expect(Object.keys(merged.levels).sort()).toEqual(['a', 'b', 'c']);
  });

  it('takes running state whole from the copy further along, never adding purses', () => {
    const ahead = base({ currentLevel: 30, coins: 400, luckyCharges: 8 });
    const behind = base({ currentLevel: 12, coins: 9000 });
    const merged = mergeProgress(behind, ahead);
    expect(merged.currentLevel).toBe(30);
    expect(merged.coins).toBe(400);
    expect(merged.luckyCharges).toBe(8);
  });

  it('keeps everything owned or won on either device', () => {
    const merged = mergeProgress(
      base({ owned: ['ball-jade'], patron: true, grandsSolved: [3], bestDailyStreak: 9, setsClaimed: ['set-kiln'] }),
      base({ owned: ['confetti-gold', 'ball-jade'], grandsSolved: [4], bestDailyStreak: 4, setsClaimed: ['set-green'] }),
    );
    expect([...merged.owned].sort()).toEqual(['ball-jade', 'confetti-gold']);
    expect(merged.patron).toBe(true);
    expect([...merged.grandsSolved].sort()).toEqual([3, 4]);
    expect(merged.bestDailyStreak).toBe(9);
    expect([...merged.setsClaimed].sort()).toEqual(['set-green', 'set-kiln']);
  });

  it('never lets a reward be claimed twice', () => {
    // Chapter 2 and rank 7 were collected on the copy that is behind.
    const merged = mergeProgress(base({ currentLevel: 40, chaptersClaimed: [1], rankRewarded: 5 }), base({ currentLevel: 25, chaptersClaimed: [1, 2], rankRewarded: 7 }));
    expect([...merged.chaptersClaimed].sort()).toEqual([1, 2]);
    expect(merged.rankRewarded).toBe(7);
  });

  it("keeps the Daily streak of whichever copy solved the Daily last, and each day's best time", () => {
    const merged = mergeProgress(
      base({ currentLevel: 20, daily: { streak: 2, lastCompletedKey: '2026-10-01' }, dailyTimes: { '2026-10-01': 50000 } }),
      base({ currentLevel: 10, daily: { streak: 5, lastCompletedKey: '2026-10-02' }, dailyTimes: { '2026-10-01': 41000, '2026-10-02': 60000 } }),
    );
    expect(merged.daily).toEqual({ streak: 5, lastCompletedKey: '2026-10-02' });
    expect(merged.dailyTimes).toEqual({ '2026-10-01': 41000, '2026-10-02': 60000 });
  });

  it('knows a fresh install', () => {
    expect(isFresh(emptyProgress())).toBe(true);
    expect(isFresh(base({ levels: { a: solved(1) } }))).toBe(false);
    expect(isFresh(base({ patron: true }))).toBe(false);
  });
});

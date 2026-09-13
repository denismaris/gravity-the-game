import {
  emptyProgress,
  getCompletedCount,
  getDisplayDailyStreak,
  getLevelResult,
  getLevelStars,
  getTotalStars,
  isDailyCompleted,
  isLevelCompleted,
  recordCompletion,
  recordDaily,
  setCursor,
} from '../playerProgress';

const T = { two: 4, three: 2 };

describe('playerProgress (pure)', () => {
  test('empty progress has nothing completed', () => {
    const p = emptyProgress();
    expect(getCompletedCount(p)).toBe(0);
    expect(getTotalStars(p)).toBe(0);
    expect(isLevelCompleted(p, 'level-001')).toBe(false);
    expect(getLevelStars(p, 'level-001')).toBe(0);
  });

  test('recording a completion stores the merged result', () => {
    const p = recordCompletion(emptyProgress(), 'level-001', 2, T);
    expect(getLevelResult(p, 'level-001')).toEqual({
      completed: true,
      stars: 3,
      bestMoves: 2,
    });
    expect(isLevelCompleted(p, 'level-001')).toBe(true);
    expect(getLevelStars(p, 'level-001')).toBe(3);
  });

  test('replaying worse keeps the earlier stars and best move count', () => {
    let p = recordCompletion(emptyProgress(), 'level-001', 2, T); // 3 stars
    p = recordCompletion(p, 'level-001', 9, T); // 1 star this run
    expect(getLevelResult(p, 'level-001')).toEqual({
      completed: true,
      stars: 3,
      bestMoves: 2,
    });
  });

  test('replaying better upgrades the record', () => {
    let p = recordCompletion(emptyProgress(), 'level-001', 8, T); // 1 star
    p = recordCompletion(p, 'level-001', 3, T); // 2 stars
    expect(getLevelResult(p, 'level-001')).toEqual({
      completed: true,
      stars: 2,
      bestMoves: 3,
    });
  });

  test('total stars sums best stars across levels', () => {
    let p = emptyProgress();
    p = recordCompletion(p, 'level-001', 2, T); // 3
    p = recordCompletion(p, 'level-002', 4, T); // 2
    p = recordCompletion(p, 'level-003', 7, T); // 1
    expect(getTotalStars(p)).toBe(6);
    expect(getCompletedCount(p)).toBe(3);
  });

  test('recordCompletion does not mutate the input progress', () => {
    const p0 = emptyProgress();
    recordCompletion(p0, 'level-001', 2, T);
    expect(getCompletedCount(p0)).toBe(0);
  });

  test('recordCompletion preserves the cursor', () => {
    let p = setCursor(emptyProgress(), 'world-1', 'level-005');
    p = recordCompletion(p, 'level-001', 2, T);
    expect(p.cursor).toEqual({ worldId: 'world-1', levelId: 'level-005' });
  });
});

describe('setCursor', () => {
  test('sets and updates the resume cursor', () => {
    let p = emptyProgress();
    expect(p.cursor).toBeNull();

    p = setCursor(p, 'world-1', 'level-003');
    expect(p.cursor).toEqual({ worldId: 'world-1', levelId: 'level-003' });

    p = setCursor(p, 'world-1', 'level-004');
    expect(p.cursor).toEqual({ worldId: 'world-1', levelId: 'level-004' });
  });

  test('returns the same object when the cursor is unchanged (no needless re-render)', () => {
    const p = setCursor(emptyProgress(), 'world-1', 'level-003');
    expect(setCursor(p, 'world-1', 'level-003')).toBe(p);
  });
});

describe('the Daily streak', () => {
  const DAY1 = '2026-01-01';
  const DAY2 = '2026-01-02';
  const DAY3 = '2026-01-03';
  const NEXT_WEEK = '2026-01-10';

  test('starts at zero and unset', () => {
    const p = emptyProgress();
    expect(p.daily).toEqual({ streak: 0, lastCompletedKey: null });
    expect(isDailyCompleted(p, DAY1)).toBe(false);
    expect(getDisplayDailyStreak(p, DAY1)).toBe(0);
  });

  test('first completion starts a streak of one', () => {
    const p = recordDaily(emptyProgress(), DAY1);
    expect(p.daily).toEqual({ streak: 1, lastCompletedKey: DAY1 });
    expect(isDailyCompleted(p, DAY1)).toBe(true);
  });

  test('completing on consecutive days extends the streak', () => {
    let p = recordDaily(emptyProgress(), DAY1);
    p = recordDaily(p, DAY2);
    p = recordDaily(p, DAY3);
    expect(p.daily).toEqual({ streak: 3, lastCompletedKey: DAY3 });
  });

  test('replaying the same day again is idempotent', () => {
    let p = recordDaily(emptyProgress(), DAY1);
    p = recordDaily(p, DAY1);
    expect(p.daily).toEqual({ streak: 1, lastCompletedKey: DAY1 });
  });

  test('a missed day restarts the streak at one', () => {
    let p = recordDaily(emptyProgress(), DAY1);
    p = recordDaily(p, NEXT_WEEK);
    expect(p.daily).toEqual({ streak: 1, lastCompletedKey: NEXT_WEEK });
  });

  test('recordDaily does not mutate the input progress', () => {
    const p0 = emptyProgress();
    recordDaily(p0, DAY1);
    expect(p0.daily.streak).toBe(0);
  });

  describe('getDisplayDailyStreak', () => {
    test('shows the live streak on the day it was earned', () => {
      const p = recordDaily(emptyProgress(), DAY2);
      expect(getDisplayDailyStreak(p, DAY2)).toBe(1);
    });

    test('still shows it the day after, before that day is played', () => {
      const p = recordDaily(emptyProgress(), DAY2);
      expect(getDisplayDailyStreak(p, DAY3)).toBe(1);
    });

    test('reads as broken once a full day has been missed', () => {
      const p = recordDaily(emptyProgress(), DAY1);
      expect(getDisplayDailyStreak(p, NEXT_WEEK)).toBe(0);
      // and the stored number is untouched until something actually calls
      // recordDaily again - display and storage are deliberately separate.
      expect(p.daily.streak).toBe(1);
    });
  });

  describe('bestDailyStreak', () => {
    test('starts at zero and rises with the live streak', () => {
      let p = emptyProgress();
      expect(p.bestDailyStreak).toBe(0);
      p = recordDaily(p, DAY1);
      p = recordDaily(p, DAY2);
      p = recordDaily(p, DAY3);
      expect(p.bestDailyStreak).toBe(3);
    });

    test('survives a missed day that resets the live streak', () => {
      let p = recordDaily(emptyProgress(), DAY1);
      p = recordDaily(p, DAY2);
      p = recordDaily(p, DAY3); // live streak 3, best 3
      p = recordDaily(p, NEXT_WEEK); // missed days in between - live streak resets to 1
      expect(p.daily.streak).toBe(1);
      expect(p.bestDailyStreak).toBe(3); // the achievement-relevant number never drops
    });

    test('replaying the same day again does not touch it', () => {
      let p = recordDaily(emptyProgress(), DAY1);
      p = recordDaily(p, DAY1);
      expect(p.bestDailyStreak).toBe(1);
    });
  });
});

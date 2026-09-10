import {
  emptyProgress,
  getCompletedCount,
  getLevelResult,
  getLevelStars,
  getTotalStars,
  isLevelCompleted,
  recordCompletion,
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

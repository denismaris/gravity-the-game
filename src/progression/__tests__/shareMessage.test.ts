import { buildDailyShare, buildShareMessage, dailyNumber } from '../shareMessage';

describe('buildShareMessage', () => {
  test('leads with the streak when one exists', () => {
    expect(buildShareMessage({ dailyStreak: 12, totalStars: 161, solved: 64, totalPuzzles: 224 })).toBe(
      '🔥 12-day streak on Tessellatum. ★161, 64/224 solved.\nTwelve calm puzzle games, one app.',
    );
  });

  test('falls back to the solved count when there is no streak yet', () => {
    expect(buildShareMessage({ dailyStreak: 0, totalStars: 3, solved: 1, totalPuzzles: 224 })).toBe(
      '★3 · 1/224 puzzles solved on Tessellatum.\nTwelve calm puzzle games, one app.',
    );
  });

  test('never mentions the streak or solved count twice', () => {
    const withStreak = buildShareMessage({ dailyStreak: 5, totalStars: 20, solved: 10, totalPuzzles: 100 });
    expect(withStreak.match(/10\/100/g)).toHaveLength(1);
    expect(withStreak.match(/★20/g)).toHaveLength(1);

    const withoutStreak = buildShareMessage({ dailyStreak: 0, totalStars: 20, solved: 10, totalPuzzles: 100 });
    expect(withoutStreak.match(/10\/100/g)).toHaveLength(1);
    expect(withoutStreak.match(/★20/g)).toHaveLength(1);
  });

  test('never invents a URL', () => {
    const message = buildShareMessage({ dailyStreak: 1, totalStars: 1, solved: 1, totalPuzzles: 1 });
    expect(message).not.toMatch(/https?:\/\//);
  });
});

describe('buildDailyShare', () => {
  it('numbers the Daily from the first day of 2026', () => {
    expect(dailyNumber('2026-01-01')).toBe(1);
    expect(dailyNumber('2026-10-02')).toBe(275);
  });

  it('reads like a result card, with no spoilers', () => {
    expect(buildDailyShare({ dayKey: '2026-10-02', game: 'Gravity', stars: 3, ms: 48000, streak: 4 })).toBe(
      'Tessellatum Daily #275 · Gravity\n★★★ · 0:48\n🟧🟧🟧🟧⬜⬜⬜ 4-day streak',
    );
  });

  it('leaves out what it does not know, and caps the streak row at a week', () => {
    expect(buildDailyShare({ dayKey: '2026-10-02', game: 'Bloom', stars: 1, ms: null, streak: 0 })).toBe('Tessellatum Daily #275 · Bloom\n★☆☆\n⬜⬜⬜⬜⬜⬜⬜');
    expect(buildDailyShare({ dayKey: '2026-10-02', game: 'Bloom', stars: 2, ms: null, streak: 12 }).split('\n')[2]).toBe('🟧🟧🟧🟧🟧🟧🟧 12-day streak');
  });
});

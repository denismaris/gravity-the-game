import { buildShareMessage } from '../shareMessage';

describe('buildShareMessage', () => {
  test('leads with the streak when one exists', () => {
    expect(buildShareMessage({ dailyStreak: 12, totalStars: 161, solved: 64, totalPuzzles: 224 })).toBe(
      '🔥 12-day streak on Tessera — ★161, 64/224 solved.\nEight calm puzzle games, one app.',
    );
  });

  test('falls back to the solved count when there is no streak yet', () => {
    expect(buildShareMessage({ dailyStreak: 0, totalStars: 3, solved: 1, totalPuzzles: 224 })).toBe(
      '★3 · 1/224 puzzles solved on Tessera.\nEight calm puzzle games, one app.',
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

import { getDailyEntry, setDailyRoster } from '../daily';
import { getWeeklyGrand } from '../weekly';
import { puzzleDisplayInfo } from '../gameKind';

afterEach(() => setDailyRoster(null));

describe('while games are still arriving', () => {
  test('the Daily is one of the player’s own games, never hard, and not the shared one when that is out of reach', () => {
    for (let day = 0; day < 60; day += 1) {
      const date = new Date(Date.UTC(2026, 9, 1 + day));
      setDailyRoster(null);
      const shared = getDailyEntry(date);
      expect(shared.shared).toBe(true);
      setDailyRoster(['gravity', 'lightsout']);
      const own = getDailyEntry(date);
      expect(['gravity', 'lightsout']).toContain(own.kind);
      expect(puzzleDisplayInfo(own.kind, own.puzzleId)?.difficulty).not.toBe('hard');
      if (own.puzzleId !== shared.puzzleId) expect(own.shared).toBe(false);
      // Stable through the day.
      expect(getDailyEntry(date).puzzleId).toBe(own.puzzleId);
    }
  });

  test('the Weekly Grand is one of the player’s games, at medium; hard once all have arrived', () => {
    for (let week = 0; week < 12; week += 1) {
      const date = new Date(Date.UTC(2026, 0, 5 + week * 7));
      const newcomer = getWeeklyGrand(date, [], ['gravity', 'lightsout', 'adjacent']);
      expect(['gravity', 'lightsout', 'adjacent']).toContain(newcomer.kind);
      expect(newcomer.tier).toBe('medium');
      expect(getWeeklyGrand(date).tier).toBe('hard');
    }
  });
});

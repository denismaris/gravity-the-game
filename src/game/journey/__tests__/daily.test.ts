import { getBinairoById } from '../../binairo';
import { getLevelById } from '../../levels';
import { getMirrorMazeById } from '../../mirror';
import { getTentsTreesById } from '../../tents';
import { getTowersById } from '../../towers';
import { dailyKeyOf, getDailyEntry } from '../daily';

describe('dailyKeyOf', () => {
  test('formats as YYYY-MM-DD in UTC', () => {
    expect(dailyKeyOf(new Date('2026-01-05T23:30:00Z'))).toBe('2026-01-05');
    expect(dailyKeyOf(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

/** Resolves inside its own game module - the same check `getDailyEntry`
 * itself does internally, verified here from the outside so a broken
 * reference (a puzzle id that doesn't actually exist in its own game's
 * pool) fails a test instead of silently falling back to a placeholder
 * name. */
function realPuzzleExists(entry: ReturnType<typeof getDailyEntry>): boolean {
  switch (entry.kind) {
    case 'gravity':
      return getLevelById(entry.puzzleId) !== undefined;
    case 'mirror':
      return getMirrorMazeById(entry.puzzleId) !== undefined;
    case 'tents':
      return getTentsTreesById(entry.puzzleId) !== undefined;
    case 'towers':
      return getTowersById(entry.puzzleId) !== undefined;
    case 'binairo':
      return getBinairoById(entry.puzzleId) !== undefined;
  }
}

describe('getDailyEntry', () => {
  test('is deterministic for the same calendar day', () => {
    const a = getDailyEntry(new Date('2026-03-14T02:00:00Z'));
    const b = getDailyEntry(new Date('2026-03-14T21:45:00Z'));
    expect(a).toEqual(b);
  });

  test('always resolves to a real puzzle in its own game', () => {
    for (const iso of ['2026-01-01', '2026-06-15', '2027-12-31', '2030-02-28']) {
      const entry = getDailyEntry(new Date(`${iso}T12:00:00Z`));
      expect(realPuzzleExists(entry)).toBe(true);
    }
  });

  test('different days usually land on different puzzles', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2026-01-01T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return getDailyEntry(d).puzzleId;
    });
    // Not a strict no-repeats guarantee (it's a hash into a fixed-size
    // pool), but 30 consecutive days landing on only a handful of distinct
    // puzzles would mean the spread is broken.
    expect(new Set(days).size).toBeGreaterThan(10);
  });
});

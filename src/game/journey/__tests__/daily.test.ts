import { getArukoneById } from '../../arukone';
import { getBinairoById } from '../../binairo';
import { glassCuratedInfo } from '../../glass';
import { getLightsOutById } from '../../lightsout';
import { getAdjacentById } from '../../adjacent';
import { getBloomById } from '../../bloom';
import { getMosaicById } from '../../mosaic';
import { getBridgesById } from '../../bridges';
import { getLevelById } from '../../levels';
import { getMirrorMazeById } from '../../mirror';
import { lilyCuratedInfo } from '../../lilypads';
import { vaneCuratedInfo } from '../../vanes';
import { dailyKeyOf, getDailyEntry, nextDayStart } from '../daily';

describe('dailyKeyOf', () => {
  // The player's own calendar: the day turns at local midnight.
  test('formats as YYYY-MM-DD on the local calendar', () => {
    expect(dailyKeyOf(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(dailyKeyOf(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
    expect(dailyKeyOf(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(dailyKeyOf(new Date(2026, 0, 6, 0, 0))).toBe('2026-01-06');
  });

  test('the next day starts at local midnight', () => {
    expect(nextDayStart(new Date(2026, 0, 5, 23, 30))).toBe(new Date(2026, 0, 6).getTime());
    expect(nextDayStart(new Date(2026, 0, 31, 0, 0))).toBe(new Date(2026, 1, 1).getTime());
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
    case 'lilypads':
      return lilyCuratedInfo(entry.puzzleId) !== null;
    case 'vanes':
      return vaneCuratedInfo(entry.puzzleId) !== null;
    case 'binairo':
      return getBinairoById(entry.puzzleId) !== undefined;
    case 'arukone':
      return getArukoneById(entry.puzzleId) !== undefined;
    case 'glass':
      return glassCuratedInfo(entry.puzzleId) !== null;
    case 'lightsout':
      return getLightsOutById(entry.puzzleId) !== undefined;
    case 'adjacent':
      return getAdjacentById(entry.puzzleId) !== undefined;
    case 'bloom':
      return getBloomById(entry.puzzleId) !== undefined;
    case 'mosaic':
      return getMosaicById(entry.puzzleId) !== undefined;
    case 'bridges':
      return getBridgesById(entry.puzzleId) !== undefined;
  }
}

describe('getDailyEntry', () => {
  test('is deterministic for the same calendar day', () => {
    const a = getDailyEntry(new Date(2026, 2, 14, 2, 0));
    const b = getDailyEntry(new Date(2026, 2, 14, 21, 45));
    expect(a).toEqual(b);
  });

  test('always resolves to a real puzzle in its own game', () => {
    for (const iso of ['2026-01-01', '2026-06-15', '2027-12-31', '2030-02-28']) {
      const [y, m, d] = iso.split('-').map(Number);
      const entry = getDailyEntry(new Date(y, m - 1, d, 12));
      expect(realPuzzleExists(entry)).toBe(true);
    }
  });

  test('different days usually land on different puzzles', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2026, 0, 1, 12, 0);
      d.setUTCDate(d.getUTCDate() + i);
      return getDailyEntry(d).puzzleId;
    });
    // Not a strict no-repeats guarantee (it's a hash into a fixed-size
    // pool), but 30 consecutive days landing on only a handful of distinct
    // puzzles would mean the spread is broken.
    expect(new Set(days).size).toBeGreaterThan(10);
  });
});

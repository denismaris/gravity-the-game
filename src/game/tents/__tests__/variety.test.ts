import { TENTS_TREES } from '../puzzles';

/**
 * The first pool was ten hand-drawn boards, every one symmetric and mostly
 * empty lines - players called them "too similar". These keep that from
 * coming back.
 */
describe('Tents boards are varied', () => {
  test('no board is symmetric - mirrored left-right, top-bottom, or turned a half-turn', () => {
    for (const puzzle of TENTS_TREES) {
      const at = new Set(puzzle.trees.map(t => `${t.row}:${t.col}`));
      const n = puzzle.rows;
      const same = (map: (r: number, c: number) => [number, number]) =>
        puzzle.trees.every(t => at.has(map(t.row, t.col).join(':')));
      expect(same((r, c) => [r, n - 1 - c])).toBe(false);
      expect(same((r, c) => [n - 1 - r, c])).toBe(false);
      expect(same((r, c) => [n - 1 - r, n - 1 - c])).toBe(false);
    }
  });

  test('at most a quarter of any board\'s row and column counts are zero', () => {
    for (const puzzle of TENTS_TREES) {
      const lines = [...puzzle.rowCounts, ...puzzle.colCounts];
      expect(lines.filter(count => count === 0).length).toBeLessThanOrEqual(lines.length / 4);
    }
  });
});

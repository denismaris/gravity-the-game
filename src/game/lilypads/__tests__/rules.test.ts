import { getLilyById, hop, hopsFrom, initialLilyState, isLilySolved, LilyPuzzle, lilyIdsFor, padsLeft, solveLily } from '..';

const RULED = ['lily-medium-s01', 'lily-medium-s02', 'lily-medium-s03', 'lily-hard-s01', 'lily-hard-s02'];

describe('Lily Pads: stepping stones', () => {
  test('a stone never sinks and never counts', () => {
    // Frog at the left, a stone in the middle, a pad at the right.
    const pond: LilyPuzzle = { id: 't', name: 't', difficulty: 'easy', size: 3, pads: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }], stones: [false, true, false], solution: [1, 2] };
    let s = initialLilyState(pond);
    expect(padsLeft(s)).toBe(2);
    s = hop(pond, s, 1);
    expect(s.afloat).toEqual([false, true, true]);
    expect(isLilySolved(s)).toBe(false);
    s = hop(pond, s, 2);
    expect(s.afloat).toEqual([false, true, true]);
    expect(isLilySolved(s)).toBe(true);
  });

  test('ruled ponds are dealt among the plain ones and can be cleared, by their own way and the solver', () => {
    expect(lilyIdsFor('medium')).toContain('lily-medium-s01');
    expect(lilyIdsFor('medium').filter(id => /-\d+$/.test(id))).toHaveLength(10);
    for (const id of RULED) {
      const p = getLilyById(id)!;
      expect(p.stones?.some(Boolean)).toBe(true);
      let s = initialLilyState(p);
      for (const next of p.solution) {
        expect(hopsFrom(p, s)).toContain(next);
        s = hop(p, s, next);
      }
      expect(isLilySolved(s)).toBe(true);
      expect(solveLily(p, initialLilyState(p))).not.toBeNull();
    }
  });

  test('endless ponds sometimes bring them, and every one clears', () => {
    const ponds = [0, 1, 2, 3, 4, 5, 6, 7].flatMap(i => (['medium', 'hard'] as const).map(tier => getLilyById(`lily-e-${tier}-${i}`, { name: 'E', tier })!));
    expect(ponds.some(p => p.stones?.some(Boolean))).toBe(true);
    for (const p of ponds) expect(solveLily(p, initialLilyState(p))).not.toBeNull();
  });
});

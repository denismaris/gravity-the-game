import { clashes, getCuratedGlass, getGlassWindow, glassHint, glassIdsFor, initialGlassState, isGlassSolved, paint, reasoned, solveGlass, GlassState } from '..';

const RULED = ['glass-medium-g01', 'glass-medium-g02', 'glass-medium-g03', 'glass-hard-g01', 'glass-hard-g02'];

describe('Stained Glass: vines', () => {
  test('vine windows are dealt among the plain ones, and no plain id moved', () => {
    expect(glassIdsFor('medium')).toContain('glass-medium-g01');
    expect(glassIdsFor('medium').filter(id => /-\d+$/.test(id))).toEqual(Array.from({ length: 10 }, (_v, i) => `glass-medium-${String(i + 1).padStart(2, '0')}`));
  });

  test('each vine window has one answer, read pane by pane, with exactly one emerald per vine', () => {
    let firsts = 0;
    for (const id of RULED) {
      const w = getCuratedGlass(id)!;
      expect(w.vines!.length).toBeGreaterThan(0);
      expect(solveGlass(w.touching, w.given, 2, w)).toEqual([w.solution]);
      expect(reasoned(w.touching, w.given, w)).toBe(w.panes);
      const leaves = new Set(w.vines!.flat());
      w.solution.forEach((c, p) => c === 3 && expect(leaves.has(p)).toBe(true));
      for (const [a, b] of w.vines!) {
        expect((w.solution[a] === 3) !== (w.solution[b] === 3)).toBe(true);
        if (w.solution[a] === 3) firsts += 1;
      }
    }
    // Which half is emerald is a toss-up, not always the first.
    const total = RULED.reduce((n, id) => n + getCuratedGlass(id)!.vines!.length, 0);
    expect(firsts).toBeGreaterThan(0);
    expect(firsts).toBeLessThan(total);
  });

  test('emerald goes only in a leaf pane, and a vine with two emeralds, or none, clashes', () => {
    const w = getCuratedGlass('glass-medium-g01')!;
    const leaves = new Set(w.vines!.flat());
    const plain = w.given.findIndex((g, p) => g === null && !leaves.has(p));
    const s = initialGlassState(w);
    expect(paint(w, s, plain, 3)).toBe(s);
    const [a, b] = w.vines![0];
    const both: GlassState = { colors: w.solution.map((c, p) => (p === a || p === b ? 3 : c)) };
    expect(clashes(w, both)).toContainEqual(a < b ? [a, b] : [b, a]);
    expect(isGlassSolved(w, { colors: [...w.solution] })).toBe(true);
  });

  test('hints alone finish every vine window and a few endless ones', () => {
    const endless = ['medium', 'hard'].flatMap(tier => [0, 1, 2, 3, 4, 5].map(i => getGlassWindow(`glass-e-${tier}-${i}`, { name: 'E', tier: tier as 'medium' | 'hard' })!));
    expect(endless.some(w => w.vines?.length)).toBe(true);
    for (const w of [...RULED.map(id => getCuratedGlass(id)!), ...endless]) {
      expect(solveGlass(w.touching, w.given, 2, w)).toHaveLength(1);
      let s = initialGlassState(w);
      for (let i = 0; i < w.panes && !isGlassSolved(w, s); i += 1) s = glassHint(w, s)!.state;
      expect(isGlassSolved(w, s)).toBe(true);
    }
  });
});

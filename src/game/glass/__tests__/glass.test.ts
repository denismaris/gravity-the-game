import { clashes, getCuratedGlass, GLASS_TEST_WINDOWS, GLASS_WINDOWS, generateGlass, glassHint, initialGlassState, isGlassSolved, paint, panesLeft, reasoned, solveGlass } from '..';

describe('Stained Glass', () => {
  test('every window has exactly one way to finish it, and its clues are part of it', () => {
    for (const w of GLASS_TEST_WINDOWS) {
      const answers = solveGlass(w.touching, w.given, 2);
      expect(answers).toHaveLength(1);
      expect(answers[0]).toEqual(w.solution);
      w.given.forEach((c, i) => c !== null && expect(c).toBe(w.solution[i]));
      // Every cell is in a pane, and every pane has cells.
      const seen = new Set(w.paneOf.flat());
      expect(seen.size).toBe(w.panes);
    }
  });

  test('the same id always makes the same window', () => {
    expect(generateGlass('glass-easy-01', 'x', 'easy').paneOf).toEqual(generateGlass('glass-easy-01', 'x', 'easy').paneOf);
  });

  test('harder windows give away fewer of their panes', () => {
    const share = (d: string) => {
      const ws = GLASS_TEST_WINDOWS.filter(w => w.difficulty === d);
      return ws.reduce((t, w) => t + w.given.filter(c => c !== null).length / w.panes, 0) / ws.length;
    };
    expect(share('hard')).toBeLessThan(share('easy'));
  });

  test('a clash is two touching panes alike; givens cannot be repainted; hints walk to the end', () => {
    const w = GLASS_TEST_WINDOWS[0];
    let s = initialGlassState(w);
    const given = w.given.findIndex(c => c !== null);
    expect(paint(w, s, given, ((w.given[given]! + 1) % 3) as 0 | 1 | 2)).toBe(s);
    const free = w.given.findIndex(c => c === null);
    const neighbour = w.touching[free][0];
    const color = (s.colors[neighbour] ?? 0) as 0 | 1 | 2;
    if (s.colors[neighbour] === null) s = paint(w, s, neighbour, color);
    expect(clashes(w, paint(w, s, free, color)).length).toBeGreaterThan(0);
    s = initialGlassState(w);
    for (let i = 0; i < w.panes && !isGlassSolved(w, s); i += 1) {
      const h = glassHint(w, s)!;
      expect(h.reason.length).toBeGreaterThan(10);
      s = h.state;
    }
    expect(isGlassSolved(w, s)).toBe(true);
    expect(panesLeft(s)).toBe(0);
  });
});

describe('the curated windows', () => {
  test('each has one answer, read out pane by pane without a guess, easy ones small', () => {
    for (const { id, difficulty } of GLASS_WINDOWS) {
      const w = getCuratedGlass(id)!;
      expect(solveGlass(w.touching, w.given, 2)).toHaveLength(1);
      expect(reasoned(w.touching, w.given)).toBe(w.panes);
      if (difficulty === 'easy') expect(w.rows).toBeLessThanOrEqual(7);
    }
    expect(getCuratedGlass('glass-easy-01')!.rows).toBe(5);
  });
});

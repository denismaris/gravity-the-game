import { getCuratedGlass, getGlassWindow, glassHint, glassIdsFor, GlassColor, initialGlassState, isGlassSolved, outlineMask, paint, placedCounts, reasoned, solveGlass } from '..';

/** Counted glass and shaped windows: every one fair, and played right. */
const LATER = (['easy', 'medium', 'hard'] as const).flatMap(tier => glassIdsFor(tier).filter(id => /-[cs]\d\d$/.test(id)));

describe('counted glass and shaped windows', () => {
  test('there are counted and shaped windows in each tier that has them', () => {
    expect(LATER.filter(id => id.includes('-c')).length).toBeGreaterThanOrEqual(5);
    expect(LATER.filter(id => id.includes('-s')).length).toBeGreaterThanOrEqual(5);
  });

  test.each(LATER)('%s has one answer, reads out pane by pane, and keeps to its outline and counts', id => {
    const puzzle = getCuratedGlass(id)!;
    expect(puzzle).toBeDefined();
    expect(solveGlass(puzzle.touching, puzzle.given, 2, puzzle)).toHaveLength(1);
    expect(reasoned(puzzle.touching, puzzle.given, puzzle)).toBe(puzzle.panes);
    if (puzzle.counts) expect(puzzle.counts).toEqual(placedCounts(puzzle.solution));
    if (puzzle.outline) {
      const mask = outlineMask(puzzle.rows, puzzle.outline);
      puzzle.paneOf.forEach((row, r) => row.forEach((p, c) => expect(p >= 0).toBe(mask[r][c])));
    }
    // Every pane holds at least one square.
    const used = new Set(puzzle.paneOf.flat().filter(p => p >= 0));
    expect(used.size).toBe(puzzle.panes);
  });

  test('a counted window gives fewer panes away than its count-free twin needs', () => {
    const counted = LATER.map(id => getCuratedGlass(id)!).filter(p => p.counts);
    const given = counted.reduce((t, p) => t + p.given.filter(c => c !== null).length, 0) / counted.length;
    expect(given).toBeLessThan(5);
  });

  test('a counted window is not solved with the wrong mix, even with no clashes', () => {
    const puzzle = getCuratedGlass(LATER.find(id => id.includes('-c'))!)!;
    // The answer is solved.
    let state = initialGlassState(puzzle);
    puzzle.solution.forEach((c, p) => (state = paint(puzzle, state, p, c)));
    expect(isGlassSolved(puzzle, state)).toBe(true);
    // Any other clash-free colouring with a different mix is not.
    const others = solveGlass(puzzle.touching, puzzle.given, 40, {}).filter(a => a.some((c, i) => c !== puzzle.solution[i]));
    for (const other of others.slice(0, 5)) {
      let s = initialGlassState(puzzle);
      other.forEach((c, p) => (s = paint(puzzle, s, p, c as GlassColor)));
      expect(isGlassSolved(puzzle, s)).toBe(false);
    }
  });

  test('hints walk a counted window to its end', () => {
    for (const id of LATER.filter(x => x.includes('-c'))) {
      const puzzle = getCuratedGlass(id)!;
      let state = initialGlassState(puzzle);
      for (let guard = 0; guard < puzzle.panes + 2 && !isGlassSolved(puzzle, state); guard += 1) {
        const hint = glassHint(puzzle, state);
        expect(hint).not.toBeNull();
        expect(hint!.reason).not.toMatch(/—| - /);
        state = hint!.state;
      }
      expect(isGlassSolved(puzzle, state)).toBe(true);
    }
  });

  test('endless windows with the new rolls are fair too', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 12; i += 1) {
        const puzzle = getGlassWindow(`glass-e-${tier}-${i}`, { name: 'Endless', tier })!;
        expect(solveGlass(puzzle.touching, puzzle.given, 2, puzzle)).toHaveLength(1);
        expect(reasoned(puzzle.touching, puzzle.given, puzzle)).toBe(puzzle.panes);
        expect(puzzle.vines?.length && puzzle.counts).toBeFalsy();
      }
    }
  });
});

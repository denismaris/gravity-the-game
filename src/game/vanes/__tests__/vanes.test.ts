import { getVanesById, neighboursOf, VANE_ROOFS, readable, getVaneTrial, initialVaneState, isVaneSolved, loops, solveVanes, troubles, turn, VANE_TRIAL_IDS, vaneHint } from '..';

describe('Weathervanes', () => {
  test('every trial roof has exactly one way to set the wind, and starts unset', () => {
    VANE_TRIAL_IDS.forEach((_id, i) => {
      const p = getVaneTrial(i);
      const answers = solveVanes(p, p.vanes, p.fixed, 2);
      expect(answers).toEqual([p.solution]);
      expect(readable(p, p.vanes, p.fixed)).toBe(true);
      expect(isVaneSolved(p, { dirs: p.solution })).toBe(true);
      expect(isVaneSolved(p, initialVaneState(p))).toBe(false);
      // Loops of three or more cover every vane.
      const ls = loops(p, { dirs: p.solution });
      expect(ls.flat().length).toBe(p.vanes.length);
      ls.forEach(l => expect(l.length).toBeGreaterThanOrEqual(3));
    });
  });

  test('a turn is a quarter clockwise, and fixed vanes stay', () => {
    const p = getVaneTrial(2);
    const s = initialVaneState(p);
    const free = p.fixed.findIndex(f => f === null);
    expect(turn(p, s, free).dirs[free]).toBe((s.dirs[free] + 1) % 4);
    const pinned = p.fixed.findIndex(f => f !== null);
    if (pinned >= 0) expect(turn(p, s, pinned)).toBe(s);
  });

  test('troubles name air, pairs and crowding; hints finish the roof', () => {
    const p = getVaneTrial(3);
    let s = initialVaneState(p);
    expect(troubles(p, s).some(t => t !== null)).toBe(true);
    for (let k = 0; k < 100 && !isVaneSolved(p, s); k += 1) {
      const h = vaneHint(p, s)!;
      expect(h.reason.length).toBeGreaterThan(10);
      s = h.state;
    }
    expect(isVaneSolved(p, s)).toBe(true);
  });

  test('a chimney stops the wind', () => {
    const vanes = [{ row: 0, col: 0 }, { row: 0, col: 3 }];
    expect(neighboursOf({ size: 4 }, vanes)[0][1]).toBe(1);
    expect(neighboursOf({ size: 4, chimneys: [{ row: 0, col: 1 }] }, vanes)[0][1]).toBe(-1);
  });

  test('curated roofs: one answer each, read without a guess, chimneys from the middle tier', () => {
    for (const { id, difficulty } of VANE_ROOFS) {
      const p = getVanesById(id)!;
      expect(solveVanes(p, p.vanes, p.fixed, 2)).toEqual([p.solution]);
      expect(readable(p, p.vanes, p.fixed)).toBe(true);
      if (difficulty === 'easy') expect(p.chimneys ?? []).toHaveLength(0);
    }
    expect(getVanesById('vanes-medium-01')!.chimneys).toHaveLength(1);
  });
});

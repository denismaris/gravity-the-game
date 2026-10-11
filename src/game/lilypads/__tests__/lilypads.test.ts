import { cutOff, getLilyById, LILY_PONDS, getLilyTrial, hop, hopsFrom, initialLilyState, isLilySolved, isStranded, LILY_TRIAL_IDS, lilyHint, solveLily } from '..';

describe('Lily Pads', () => {
  test('every trial pond replays its own walk to a cleared pond', () => {
    LILY_TRIAL_IDS.forEach((_id, i) => {
      const p = getLilyTrial(i);
      let s = initialLilyState(p);
      for (const next of p.solution) {
        expect(hopsFrom(p, s)).toContain(next);
        s = hop(p, s, next);
      }
      expect(isLilySolved(s)).toBe(true);
    });
  });

  test('ponds are the same every time and grow through the trial', () => {
    const a = getLilyTrial(0);
    expect(a.pads.length).toBeLessThan(getLilyTrial(LILY_TRIAL_IDS.length - 1).pads.length);
    expect(solveLily(a, initialLilyState(a))).not.toBeNull();
  });

  test('a hop to a pad out of line does nothing; the pad left behind sinks', () => {
    const p = getLilyTrial(1);
    const s = initialLilyState(p);
    const reachable = hopsFrom(p, s);
    const unreachable = p.pads.map((_c, i) => i).find(i => i !== 0 && !reachable.includes(i));
    if (unreachable !== undefined) expect(hop(p, s, unreachable)).toBe(s);
    const next = hop(p, s, reachable[0]);
    expect(next.afloat[0]).toBe(false);
    expect(next.at).toBe(reachable[0]);
  });

  test('hints walk a pond to the end, backing out of a stranded frog', () => {
    const p = getLilyTrial(3);
    // Strand the frog by always taking the last hop offered.
    let s = initialLilyState(p);
    const history = [];
    while (!isStranded(p, s) && !isLilySolved(s)) {
      history.push(s);
      const options = hopsFrom(p, s);
      s = hop(p, s, options[options.length - 1]);
    }
    let steps = 0;
    while (!isLilySolved(s) && steps < 100) {
      const h = lilyHint(p, history, s)!;
      expect(h.reason.length).toBeGreaterThan(10);
      for (let k = 0; k < h.back; k += 1) s = history.pop()!;
      history.push(s);
      s = hop(p, s, h.pad);
      steps += 1;
    }
    expect(isLilySolved(s)).toBe(true);
  });

  test('a pad alone in its row and column is cut off', () => {
    const p = { id: 'c', name: 'c', difficulty: 'easy' as const, size: 4, pads: [{ row: 1, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 2 }, { row: 3, col: 2 }], solution: [] };
    // Right, then down: the pad on the left is alone.
    let s = initialLilyState(p);
    s = hop(p, s, 2);
    expect(cutOff(p, s)).toEqual([]);
    s = hop(p, s, 3);
    expect(cutOff(p, s)).toEqual([1]);
  });

  test('a lotus pad survives its first departure, and sinks on its second', () => {
    const p = { id: 'l', name: 'l', difficulty: 'easy' as const, size: 4, pads: [{ row: 0, col: 0 }, { row: 0, col: 2 }, { row: 2, col: 2 }], lotus: [false, true, false], solution: [] };
    let s = initialLilyState(p);
    s = hop(p, s, 1);
    s = hop(p, s, 2);
    expect(s.afloat[1]).toBe(true);
    expect(s.lotus?.[1]).toBe(false);
    expect(isLilySolved(s)).toBe(false);
    s = hop(p, s, 1);
    expect(s.afloat[2]).toBe(false);
    expect(isLilySolved(s)).toBe(true);
  });

  test('curated ponds: each replays its walk, lotus pads arrive at the seventh easy pond', () => {
    for (const { id } of LILY_PONDS) {
      const p = getLilyById(id)!;
      let s = initialLilyState(p);
      for (const next of p.solution) s = hop(p, s, next);
      expect(isLilySolved(s)).toBe(true);
    }
    expect(getLilyById('lily-easy-06')!.lotus?.some(Boolean)).toBe(false);
    expect(getLilyById('lily-easy-07')!.lotus?.filter(Boolean)).toHaveLength(1);
  });
});

import { effectOf, getLightsOutById, initialLightsOutState, isLightsOutSolved, press, solveLightsOut } from '..';

describe('Lanterns: twin lanterns', () => {
  test('a twin switches its partner too, from either end', () => {
    const rules = { twins: [[{ row: 0, col: 0 }, { row: 4, col: 4 }]] as const };
    expect(effectOf(5, 0, 0, rules).some(c => c.row === 4 && c.col === 4)).toBe(true);
    expect(effectOf(5, 4, 4, rules).some(c => c.row === 0 && c.col === 0)).toBe(true);
    expect(effectOf(5, 2, 2, rules)).toHaveLength(5);
  });

  // Twins were taken out of the game (2026-10-20): the boards that had
  // them still open, as plain boards, and still solve at their par.
  test('the old twin boards open plain, and endless boards carry no twins', () => {
    const ids = ['lightsout-medium-t01', 'lightsout-medium-t02', 'lightsout-hard-t01', 'lightsout-hard-t02', 'lightsout-hard-t03', 'lightsout-e-hard-7', 'lightsout-e-medium-3'];
    for (const id of ids) {
      const p = getLightsOutById(id)!;
      expect(p.twins?.length ?? 0).toBe(0);
      let s = initialLightsOutState(p);
      const solution = solveLightsOut(p, s)!;
      expect(solution.length).toBe(p.par);
      for (const cell of solution) s = press(s, p.size, cell.row, cell.col, p);
      expect(isLightsOutSolved(s)).toBe(true);
    }
  });
});

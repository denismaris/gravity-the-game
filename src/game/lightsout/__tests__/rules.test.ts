import { effectOf, getLightsOutById, initialLightsOutState, isLightsOutSolved, press, solveLightsOut } from '..';

describe('Lanterns: twin lanterns', () => {
  test('a twin switches its partner too, from either end', () => {
    const rules = { twins: [[{ row: 0, col: 0 }, { row: 4, col: 4 }]] as const };
    expect(effectOf(5, 0, 0, rules).some(c => c.row === 4 && c.col === 4)).toBe(true);
    expect(effectOf(5, 4, 4, rules).some(c => c.row === 0 && c.col === 0)).toBe(true);
    expect(effectOf(5, 2, 2, rules)).toHaveLength(5);
  });

  test('every twin board, curated and endless, is solved by its own solver at its par', () => {
    const ids = ['lightsout-medium-t01', 'lightsout-medium-t02', 'lightsout-hard-t01', 'lightsout-hard-t02', 'lightsout-hard-t03', 'lightsout-e-hard-7'];
    for (const id of ids) {
      const p = getLightsOutById(id)!;
      expect(p.twins?.length).toBeTruthy();
      let s = initialLightsOutState(p);
      const solution = solveLightsOut(p, s)!;
      expect(solution.length).toBe(p.par);
      for (const cell of solution) s = press(s, p.size, cell.row, cell.col, p);
      expect(isLightsOutSolved(s)).toBe(true);
    }
  });
});

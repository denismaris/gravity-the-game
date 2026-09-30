import { landingCurve } from '../useAnimatedMovables';

describe('landingCurve', () => {
  test('starts at rest, ends exactly on the target', () => {
    expect(landingCurve(0, 3)).toBe(0);
    expect(landingCurve(1, 3)).toBe(1);
  });

  test('accelerates into the wall - the second half of the fall covers more than the first', () => {
    const quarter = landingCurve(0.21, 4);
    const half = landingCurve(0.42, 4);
    expect(half - quarter).toBeGreaterThan(quarter);
  });

  /** The landing: it reaches the wall, rebounds a little, and settles -
   * never past the wall, and by the same distance in squares whether the
   * fall was long or short. */
  test('rebounds a fixed, small distance off the wall and never passes it', () => {
    for (const squares of [1, 3, 7]) {
      let lowestAfterImpact = 1;
      for (let t = 0; t <= 1; t += 0.005) {
        const p = landingCurve(t, squares);
        expect(p).toBeLessThanOrEqual(1 + 1e-9);
        if (t > 0.9) lowestAfterImpact = Math.min(lowestAfterImpact, p);
      }
      const reboundSquares = (1 - lowestAfterImpact) * squares;
      expect(reboundSquares).toBeGreaterThan(0.04);
      expect(reboundSquares).toBeLessThan(0.07);
    }
  });
});

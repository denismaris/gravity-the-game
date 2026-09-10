import { computeStars } from '../stars';

describe('computeStars', () => {
  const thresholds = { two: 4, three: 2 };

  test('3 stars at or under the 3-star threshold', () => {
    expect(computeStars(1, thresholds)).toBe(3);
    expect(computeStars(2, thresholds)).toBe(3);
  });

  test('2 stars between the two thresholds (inclusive of the 2-star bound)', () => {
    expect(computeStars(3, thresholds)).toBe(2);
    expect(computeStars(4, thresholds)).toBe(2);
  });

  test('1 star for any completion beyond the 2-star threshold', () => {
    expect(computeStars(5, thresholds)).toBe(1);
    expect(computeStars(50, thresholds)).toBe(1);
  });

  test('a completed level is always worth at least one star', () => {
    expect(computeStars(1, { two: 1, three: 1 })).toBe(3);
    expect(computeStars(2, { two: 1, three: 1 })).toBe(1);
  });

  test('more moves never award more stars, even with mis-authored thresholds', () => {
    // three > two is invalid, but the function must still be monotonic.
    const broken = { two: 2, three: 5 };
    const ratings = [1, 2, 3, 4, 5, 6].map(m => computeStars(m, broken));
    for (let i = 1; i < ratings.length; i += 1) {
      expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1]);
    }
  });

  test('defensively returns 1 star for a non-positive / non-finite move count', () => {
    expect(computeStars(0, thresholds)).toBe(1);
    expect(computeStars(-3, thresholds)).toBe(1);
    expect(computeStars(NaN, thresholds)).toBe(1);
  });
});

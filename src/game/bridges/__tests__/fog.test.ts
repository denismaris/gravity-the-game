import { BRIDGES, countBridgesSolutions, getBridgesById, getBridgesByDifficulty, isBridgesSolved, isSolvableByLogic } from '..';

describe('Bridges: islands in fog', () => {
  test('a fog island takes any number of bridges, so long as it is joined in', () => {
    const p = getBridgesById('bridges-medium-m01')!;
    expect(p.islands.some(i => i.fog)).toBe(true);
    expect(isBridgesSolved(p, { bridges: p.solution })).toBe(true);
  });

  test('fog boards are dealt among the rest, have one answer, and reason out without a guess', () => {
    expect(getBridgesByDifficulty('medium').map(p => p.id)).toContain('bridges-medium-m02');
    const foggy = BRIDGES.filter(b => b.islands.some(i => i.fog));
    expect(foggy).toHaveLength(4);
    for (const p of foggy) {
      expect(countBridgesSolutions(p, 2)).toBe(1);
      expect(isSolvableByLogic(p)).toBe(true);
      // The hidden numbers are real numbers, not ones: each says something.
      for (const island of p.islands.filter(i => i.fog)) expect(island.need).toBeGreaterThanOrEqual(2);
    }
  });

  test('endless boards sometimes bring them', () => {
    const boards = [0, 1, 2, 3, 4, 5, 6, 7].map(i => getBridgesById(`bridges-e-hard-${i}`)!);
    expect(boards.some(b => b.islands.some(i => i.fog))).toBe(true);
  });
});

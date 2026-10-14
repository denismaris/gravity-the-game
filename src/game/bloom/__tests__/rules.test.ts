import { BLOOM, countBloomSolutions, getBloomById, initialBloomState, isBloomSolved, isSolvableByLogic, revealBloomHint, rotateTile } from '..';

describe('Bloom: twin tiles', () => {
  test('a twin turns its other half the same way', () => {
    const p = getBloomById('bloom-medium-t01')!;
    const { a, b, offset } = p.twins![0];
    let s = initialBloomState(p);
    expect((s.rotations[b.row][b.col] - s.rotations[a.row][a.col] + 4) % 4).toBe(offset);
    s = rotateTile(p, s, a.row, a.col);
    expect((s.rotations[b.row][b.col] - s.rotations[a.row][a.col] + 4) % 4).toBe(offset);
  });

  test('every ruled board has one answer, reasons out, and hints finish it', () => {
    const ruled = BLOOM.filter(b => b.twins?.length);
    expect(ruled.map(b => b.id)).toEqual(expect.arrayContaining(['bloom-medium-t01', 'bloom-hard-t01', 'bloom-hard-t02']));
    for (const p of ruled) {
      expect(countBloomSolutions(p, 2)).toBe(1);
      expect(isSolvableByLogic(p)).toBe(true);
      let s = initialBloomState(p);
      for (let i = 0; i < 80 && !isBloomSolved(p, s); i += 1) s = revealBloomHint(p, s)!.state;
      expect(isBloomSolved(p, s)).toBe(true);
    }
  });
});

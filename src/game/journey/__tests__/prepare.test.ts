import { endlessId } from '../../endlessId';
import { ROTATION } from '../gameKind';
import { buildPuzzle } from '../prepare';

describe('buildPuzzle', () => {
  test('builds an endless board of every game without throwing', () => {
    for (const kind of ROTATION) expect(() => buildPuzzle(kind, endlessId(kind, 'easy', 3))).not.toThrow();
  });

  test('a board built ahead opens from the cache: the second build is near free', () => {
    const id = endlessId('gravity', 'hard', 102);
    const t0 = Date.now();
    buildPuzzle('gravity', id);
    const first = Date.now() - t0;
    const t1 = Date.now();
    buildPuzzle('gravity', id);
    expect(Date.now() - t1).toBeLessThanOrEqual(Math.max(5, first));
  });
});

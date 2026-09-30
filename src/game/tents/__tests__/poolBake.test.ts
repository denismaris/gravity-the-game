import { buildTentsPool, TENTS_TREES } from '../puzzles';

/** The pool is baked into `pool.generated.ts` so the app does no generation
 * at startup; this keeps that file honest. If it fails, re-bake. */
test('the baked pool is exactly what the generator builds', () => {
  expect(buildTentsPool()).toEqual(TENTS_TREES);
});

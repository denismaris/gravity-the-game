import { BAKED_BINAIRO } from '../pool.generated';
import { buildBinairoPool } from '../puzzles';

/** The generated part of the pool is baked into `pool.generated.ts` so the
 * app does no generation at startup; this keeps that file honest - it must
 * be exactly what the generator builds today. If this fails, re-bake. */
test('the baked pool is exactly what the generator builds', () => {
  expect(buildBinairoPool()).toEqual(BAKED_BINAIRO);
});

import { buildArukonePool, ARUKONE } from '../puzzles';

/**
 * The shipped pool is baked into `pool.generated.ts` so the app does no
 * generation at startup. This is what keeps that file honest: it must be
 * exactly what the generator builds today. If this fails, the generator (or
 * its inputs) changed - re-bake the file rather than editing it by hand.
 */
test('the baked pool is exactly what the generator builds', () => {
  expect(buildArukonePool()).toEqual(ARUKONE);
});

import { applyTap, groupAt, isAdjacentSolved } from '../../../game/adjacent';
import { isArukoneSolved, mirrorPairOf } from '../../../game/arukone';
import { bridgeLinks, isBridgesSolved } from '../../../game/bridges';
import { applyGravity, isPuzzleSolved } from '../../../game/engine';
import { initialGlassState, isGlassSolved, solveGlass } from '../../../game/glass';
import { initialMosaicState, isMosaicSolved, placePiece } from '../../../game/mosaic';
import { isVaneSolved } from '../../../game/vanes';
import { ADJ_FREE, BRIDGES_FREE, GRAVITY_FREE, gravityStillSolvable, MOSAIC_FREE, TWIN_FREE } from '../moreLessons';
import { FREE_WINDOW } from '../glassLesson';
import { ROOF_FREE } from '../trialLessons';

/**
 * Every lesson ends with a board the player solves on their own. Each of
 * those boards must be solvable by the game's own rules, from where it
 * starts, and must not already be solved.
 */
describe("lesson 'Your turn' boards", () => {
  test('Weathervanes: the roof has its loop, and does not start set', () => {
    expect(isVaneSolved(ROOF_FREE, { dirs: [...ROOF_FREE.solution] })).toBe(true);
    expect(isVaneSolved(ROOF_FREE, { dirs: [...ROOF_FREE.start] })).toBe(false);
  });

  test('Stained Glass: the window has exactly one way to finish it', () => {
    expect(isGlassSolved(FREE_WINDOW, { colors: [...FREE_WINDOW.solution] })).toBe(true);
    expect(isGlassSolved(FREE_WINDOW, initialGlassState(FREE_WINDOW))).toBe(false);
    expect(solveGlass(FREE_WINDOW.touching, FREE_WINDOW.given, 2)).toHaveLength(1);
  });

  test('Adjacent: the target is reachable, and takes more than one tap', () => {
    let best = 0;
    let oneTap = 0;
    const go = (state: { grid: ReadonlyArray<ReadonlyArray<number | null>>; score: number; cascades: number }, depth: number) => {
      best = Math.max(best, state.score);
      const tried = new Set<string>();
      for (let r = 0; r < ADJ_FREE.size; r += 1) {
        for (let c = 0; c < ADJ_FREE.size; c += 1) {
          if (state.grid[r][c] === null) continue;
          const group = groupAt(state.grid as never, r, c);
          if (group.length < 2) continue;
          const key = group.map(g => `${g.row},${g.col}`).sort().join(';');
          if (tried.has(key)) continue;
          tried.add(key);
          const move = applyTap(state as never, r, c);
          if (!move) continue;
          if (depth === 0) oneTap = Math.max(oneTap, move.state.score);
          go(move.state as never, depth + 1);
        }
      }
    };
    go({ grid: ADJ_FREE.initial, score: 0, cascades: 0 }, 0);
    expect(best).toBeGreaterThanOrEqual(ADJ_FREE.targetScore);
    expect(oneTap).toBeLessThan(ADJ_FREE.targetScore);
    expect(isAdjacentSolved(ADJ_FREE, { grid: ADJ_FREE.initial, score: 0, cascades: 0 } as never)).toBe(false);
  });

  test('Bridges: its answer meets every number', () => {
    expect(isBridgesSolved(BRIDGES_FREE, { bridges: [...BRIDGES_FREE.solution] })).toBe(true);
    expect(isBridgesSolved(BRIDGES_FREE, { bridges: bridgeLinks(BRIDGES_FREE).map(() => 0) })).toBe(false);
  });

  test('Twinpath: its answer fills the fold, and its pairs mirror', () => {
    expect(isArukoneSolved(TWIN_FREE, { paths: TWIN_FREE.solution })).toBe(true);
    for (const pair of TWIN_FREE.pairs) expect(mirrorPairOf(TWIN_FREE, pair)).toBeDefined();
  });

  test('Mosaic: the pieces tile the picture as its answer says', () => {
    let state = initialMosaicState(MOSAIC_FREE);
    MOSAIC_FREE.solution.forEach((place, index) => {
      state = { pieces: state.pieces.map((p, i) => (i === index ? { ...p, rotation: place.rotation, flipped: place.flipped } : p)) };
      state = placePiece(MOSAIC_FREE, state, index, place.row, place.col);
    });
    expect(isMosaicSolved(MOSAIC_FREE, state)).toBe(true);
    expect(isMosaicSolved(MOSAIC_FREE, initialMosaicState(MOSAIC_FREE))).toBe(false);
  });

  test('Gravity: two swipes finish it, one does not', () => {
    expect(isPuzzleSolved(GRAVITY_FREE)).toBe(false);
    for (const dir of ['up', 'down', 'left', 'right'] as const) expect(isPuzzleSolved(applyGravity(GRAVITY_FREE, dir))).toBe(false);
    expect(isPuzzleSolved(applyGravity(applyGravity(GRAVITY_FREE, 'down'), 'right'))).toBe(true);
    expect(gravityStillSolvable(GRAVITY_FREE)).toBe(true);
  });
});

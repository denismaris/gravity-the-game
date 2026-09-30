import { emptyProgress, recordCompletion } from '../playerProgress';
import { applyGravity, findShortestSolution, isPuzzleSolved } from '../../game/engine';
import { createGameStateFromLevel, LEVELS } from '../../game/levels';

describe('Gravity hints', () => {
  /** Following hints plays the optimal line, so without a ceiling a hinted
   * solve would score a free three. It tops out at two - and the move
   * count stored is still the true one. */
  test('a solve that used a hint scores at most two stars, keeping its real move count', () => {
    const thresholds = { three: 5, two: 8 };
    const plain = recordCompletion(emptyProgress(), 'level-x', 5, thresholds);
    expect(plain.levels['level-x']).toEqual({ stars: 3, bestMoves: 5, completed: true });
    const hinted = recordCompletion(emptyProgress(), 'level-x', 5, thresholds, 2);
    expect(hinted.levels['level-x']).toEqual({ stars: 2, bestMoves: 5, completed: true });
  });

  /** The hint shows `findShortestSolution(board)[0]`. This is the promise
   * that makes it a hint and not a guess: from any deep board, taking the
   * hinted move and then following hints again always reaches the solve,
   * in exactly the level's par. */
  test('taking the hinted move again and again solves every World 8 level in par', () => {
    for (const level of LEVELS.filter(l => l.order >= 171)) {
      let state = createGameStateFromLevel(level);
      let moves = 0;
      while (!isPuzzleSolved(state)) {
        const path = findShortestSolution(state, 16);
        expect(path && path.length > 0).toBe(true);
        const next = applyGravity(state, path![0]);
        expect(next).not.toEqual(state);
        state = next;
        moves += 1;
        expect(moves).toBeLessThanOrEqual(level.metadata!.minMoves!);
      }
      expect(moves).toBe(level.metadata!.minMoves);
    }
  });
});

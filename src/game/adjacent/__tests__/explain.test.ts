import { ADJACENT, applyTap, explainAdjacentHint, groupAt, initialAdjacentState, isAdjacentSolved, legalMoves } from '..';

describe('Insight for Adjacent', () => {
  test('always suggests a legal tap with a reason, and lights its whole group', () => {
    for (const puzzle of ADJACENT.slice(0, 8)) {
      const state = initialAdjacentState(puzzle);
      const hint = explainAdjacentHint(puzzle, state)!;
      expect(hint).not.toBeNull();
      expect(legalMoves(state.grid).length).toBeGreaterThan(0);
      expect(groupAt(state.grid, hint.tap.row, hint.tap.col).length).toBeGreaterThanOrEqual(2);
      expect(hint.group.length).toBe(groupAt(state.grid, hint.tap.row, hint.tap.col).length);
      expect(hint.reason.length).toBeGreaterThan(40);
    }
  });

  test('following Insight all the way wins the board', () => {
    for (const puzzle of ADJACENT.slice(0, 6)) {
      let state = initialAdjacentState(puzzle);
      for (let step = 0; step < 60 && !isAdjacentSolved(puzzle, state); step += 1) {
        const hint = explainAdjacentHint(puzzle, state);
        if (!hint) break;
        state = applyTap(state, hint.tap.row, hint.tap.col)!.state;
      }
      expect(isAdjacentSolved(puzzle, state)).toBe(true);
    }
  });

  test('is quick enough to run on a phone while the player waits', () => {
    const puzzle = ADJACENT[ADJACENT.length - 1];
    const started = Date.now();
    explainAdjacentHint(puzzle, initialAdjacentState(puzzle));
    expect(Date.now() - started).toBeLessThan(400);
  });
});

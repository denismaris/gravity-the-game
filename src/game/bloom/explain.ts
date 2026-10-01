import { HintReason } from '../hints';
import { isRotatable, neighbourAcross, setRotation } from './logic';
import { BloomCell, BloomPuzzle, BloomState } from './types';

/**
 * Turns the wrongly-facing tile that is easiest to see: the one with the
 * most neighbours already facing the right way, so the hint lands where
 * the garden is nearly closed rather than at the top-left corner.
 */
export function explainBloomHint(puzzle: BloomPuzzle, state: BloomState): ({ state: BloomState; cell: BloomCell } & HintReason) | null {
  const right = (r: number, c: number) => !isRotatable(puzzle, r, c) || state.rotations[r][c] % 4 === puzzle.solution[r][c] % 4;
  let best: { cell: BloomCell; settled: number } | null = null;
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (!isRotatable(puzzle, row, col) || right(row, col)) continue;
      let settled = 0;
      for (const e of [0, 1, 2, 3] as const) {
        const n = neighbourAcross(puzzle, row, col, e);
        if (!n || right(n.row, n.col)) settled += 1;
      }
      if (!best || settled > best.settled) best = { cell: { row, col }, settled };
    }
  }
  if (!best) return null;
  const { cell, settled } = best;
  return {
    state: setRotation(state, cell.row, cell.col, puzzle.solution[cell.row][cell.col]),
    cell,
    kind: settled >= 3 ? 'rule' : 'nudge',
    reason:
      settled >= 3
        ? 'Its neighbours are already set. Only one turn joins every line here.'
        : 'Turn this one so no line runs loose into its neighbours.',
  };
}

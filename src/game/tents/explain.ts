import { count, HintReason, place } from '../hints';

const TIPS = {
  touch: 'Tents never touch each other, not even corner to corner. Every square around a tent stays grass.',
  partner: 'Every tent belongs to its own tree, right beside it (not diagonally).',
  lonely: 'A tree with only one free square beside it: its tent has to go there.',
  count: 'Compare each row and column number with the free squares left. When they are equal, every free square is a tent.',
  nudge: 'Mark grass on squares that cannot hold a tent (no tree beside them, or touching a tent). The tents left over become obvious.',
};
import { allNeighbors, colTentCount, isEligible, isTreeCell, orthogonalNeighbors, rowTentCount, setMark } from './logic';
import { solveTentsAndTrees } from './solver';
import { TentsTreesCell, TentsTreesPuzzle, TentsTreesState } from './types';

/**
 * A hint that reads the board as it is. A tent that should not be there
 * comes up first (saying why, when it touches another); otherwise the
 * clearest forced tent - a tree with one free spot left beside it, then a
 * row or column needing exactly as many tents as it has spots - and only
 * if neither shows yet, the tent in the tightest line.
 */
export function explainTentsHint(puzzle: TentsTreesPuzzle, state: TentsTreesState): ({ state: TentsTreesState; cell: TentsTreesCell } & HintReason) | null {
  const [solution] = solveTentsAndTrees(puzzle, 1);
  if (!solution) return null;
  const tentAt = (r: number, c: number) => state.marks[r]?.[c] === 'tent';

  // 1. A wrong tent.
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (tentAt(r, c) && solution.marks[r][c] !== 'tent') {
        const touching = allNeighbors(puzzle, r, c).some(n => tentAt(n.row, n.col));
        return {
          state: setMark(state, puzzle, r, c, 'empty'),
          cell: { row: r, col: c },
          kind: 'fix',
          reason: touching
            ? `The tent at ${place(r, c)} touches another tent, and tents never touch, not even corner to corner. It comes down.`
            : `The tent at ${place(r, c)} has no tree of its own left: every tree beside it is already paired. It comes down.`,
          tip: touching ? TIPS.touch : TIPS.partner,
        };
      }
    }
  }

  // A spot a tent could still go: next to a tree, empty, touching no tent,
  // in a row and column not yet full.
  const free = (r: number, c: number) =>
    isEligible(puzzle, r, c) &&
    state.marks[r][c] === 'empty' &&
    !allNeighbors(puzzle, r, c).some(n => tentAt(n.row, n.col)) &&
    rowTentCount(state, r) < puzzle.rowCounts[r] &&
    colTentCount(state, c) < puzzle.colCounts[c];
  const isAnswer = (r: number, c: number) => solution.marks[r][c] === 'tent' && !tentAt(r, c);
  const pitch = (r: number, c: number, reason: string, tip: string) => ({ state: setMark(state, puzzle, r, c, 'tent'), cell: { row: r, col: c }, kind: 'rule' as const, reason, tip });

  // 2a. A tree with a single free spot, still waiting for its tent.
  for (const tree of puzzle.trees) {
    const around = orthogonalNeighbors(puzzle, tree.row, tree.col);
    if (around.some(n => tentAt(n.row, n.col))) continue;
    const spots = around.filter(n => !isTreeCell(puzzle, n.row, n.col) && free(n.row, n.col));
    if (spots.length === 1 && isAnswer(spots[0].row, spots[0].col))
      return pitch(spots[0].row, spots[0].col, `The tree at ${place(tree.row, tree.col)} has only one free square left beside it (${place(spots[0].row, spots[0].col)}). Every tree needs its own tent, so it goes there.`, TIPS.lonely);
  }
  // 2b. A line with exactly as many spots as tents still wanted.
  for (let r = 0; r < puzzle.rows; r += 1) {
    const need = puzzle.rowCounts[r] - rowTentCount(state, r);
    const spots = Array.from({ length: puzzle.cols }, (_v, c) => c).filter(c => free(r, c));
    if (need > 0 && spots.length === need && isAnswer(r, spots[0]))
      return pitch(r, spots[0], `Row ${r + 1} still needs ${count(need, 'tent')} and has exactly ${count(need, 'free square')} left that could take one, so they are all tents. Start at ${place(r, spots[0])}.`, TIPS.count);
  }
  for (let c = 0; c < puzzle.cols; c += 1) {
    const need = puzzle.colCounts[c] - colTentCount(state, c);
    const spots = Array.from({ length: puzzle.rows }, (_v, r) => r).filter(r => free(r, c));
    if (need > 0 && spots.length === need && isAnswer(spots[0], c))
      return pitch(spots[0], c, `Column ${c + 1} still needs ${count(need, 'tent')} and has exactly ${count(need, 'free square')} left that could take one, so they are all tents. Start at ${place(spots[0], c)}.`, TIPS.count);
  }

  // 3. The missing tent in the line closest to finished.
  let best: TentsTreesCell | null = null;
  let bestScore = -Infinity;
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (!isAnswer(r, c)) continue;
      const score = -(puzzle.rowCounts[r] - rowTentCount(state, r)) - (puzzle.colCounts[c] - colTentCount(state, c));
      if (score > bestScore) {
        bestScore = score;
        best = { row: r, col: c };
      }
    }
  }
  if (!best) return null;
  return {
    state: setMark(state, puzzle, best.row, best.col, 'tent'),
    cell: best,
    kind: 'nudge',
    reason: `Nothing is forced on its own yet, so here is the tightest spot: a tent at ${place(best.row, best.col)} is the only way every nearby tree still gets a partner while the row and column counts still add up.`,
    tip: TIPS.nudge,
  };
}

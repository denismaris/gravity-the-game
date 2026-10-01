import { count, HintReason } from '../hints';
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
          reason: touching ? 'Tents never touch, not even corner to corner, so this one comes down.' : "No tree here is missing this tent. It comes down.",
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
  const place = (r: number, c: number, reason: string) => ({ state: setMark(state, puzzle, r, c, 'tent'), cell: { row: r, col: c }, kind: 'rule' as const, reason });

  // 2a. A tree with a single free spot, still waiting for its tent.
  for (const tree of puzzle.trees) {
    const around = orthogonalNeighbors(puzzle, tree.row, tree.col);
    if (around.some(n => tentAt(n.row, n.col))) continue;
    const spots = around.filter(n => !isTreeCell(puzzle, n.row, n.col) && free(n.row, n.col));
    if (spots.length === 1 && isAnswer(spots[0].row, spots[0].col)) return place(spots[0].row, spots[0].col, 'This tree has only one free spot left beside it - its tent goes there.');
  }
  // 2b. A line with exactly as many spots as tents still wanted.
  for (let r = 0; r < puzzle.rows; r += 1) {
    const need = puzzle.rowCounts[r] - rowTentCount(state, r);
    const spots = Array.from({ length: puzzle.cols }, (_v, c) => c).filter(c => free(r, c));
    if (need > 0 && spots.length === need && isAnswer(r, spots[0])) return place(r, spots[0], `This row needs ${count(need, 'more tent')} and has exactly ${count(need, 'spot')} left.`);
  }
  for (let c = 0; c < puzzle.cols; c += 1) {
    const need = puzzle.colCounts[c] - colTentCount(state, c);
    const spots = Array.from({ length: puzzle.rows }, (_v, r) => r).filter(r => free(r, c));
    if (need > 0 && spots.length === need && isAnswer(spots[0], c)) return place(spots[0], c, `This column needs ${count(need, 'more tent')} and has exactly ${count(need, 'spot')} left.`);
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
    reason: 'Match each tree to its own tent along this row. This is the only spot that leaves every tree a partner.',
  };
}

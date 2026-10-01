import { count, HintReason } from '../hints';
import { clueValue, clueWindow } from './logic';
import { FillaPixCell, FillaPixPuzzle, FillaPixState } from './types';

/**
 * A hint that reads the board as it is. It looks for the clue the player
 * is closest to finishing - the one with the fewest squares around it
 * still wrong - and fixes one square there, saying what that clue needs:
 * squares to stay empty once it is satisfied, or every remaining square
 * filled when that is the only way to reach its number.
 */
export function explainFillaPixHint(puzzle: FillaPixPuzzle, state: FillaPixState): ({ state: FillaPixState; cell: FillaPixCell } & HintReason) | null {
  const n = puzzle.size;
  const wrongAt = (r: number, c: number) => state.filled[r][c] !== puzzle.solution[r][c];
  const set = (r: number, c: number) => ({ filled: state.filled.map((line, ri) => (ri === r ? line.map((x, ci) => (ci === c ? puzzle.solution[r][c] : x)) : line)) });

  let best: { clue: FillaPixCell; cell: FillaPixCell; wrongCount: number } | null = null;
  for (const clue of puzzle.clues) {
    const window = clueWindow(n, clue.row, clue.col);
    const wrong = window.filter(c => wrongAt(c.row, c.col));
    if (wrong.length === 0) continue;
    if (!best || wrong.length < best.wrongCount) best = { clue, cell: wrong[0], wrongCount: wrong.length };
  }
  if (best) {
    const { clue, cell } = best;
    const value = clueValue(puzzle, clue.row, clue.col);
    const window = clueWindow(n, clue.row, clue.col);
    const filledNow = window.filter(c => state.filled[c.row][c.col]).length;
    const shouldFill = puzzle.solution[cell.row][cell.col];
    const reason = shouldFill
      ? value === window.length
        ? `This ${value} needs every square around it filled.`
        : `This ${value} has ${count(filledNow, 'square')} filled around it and needs ${value} - fill this one.`
      : filledNow > value
        ? `This ${value} has too many squares filled around it - clear this one.`
        : `This ${value} already has its squares. This one stays empty.`;
    return { state: set(cell.row, cell.col), cell, kind: filledNow > value || (!shouldFill && state.filled[cell.row][cell.col]) ? 'fix' : 'rule', reason };
  }

  // No clue's neighbourhood is wrong - a square outside every clue window.
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (wrongAt(r, c)) return { state: set(r, c), cell: { row: r, col: c }, kind: 'nudge', reason: puzzle.solution[r][c] ? 'The picture continues through this square.' : 'This square is outside the picture.' };
    }
  }
  return null;
}

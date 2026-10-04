import { count, HintReason, place } from '../hints';

const TIPS = {
  all: 'A number counts the filled squares in the 3x3 block around it, itself included. A 9 (or a corner 4, an edge 6) fills its whole block.',
  done: 'Once a number has all its squares filled, every other square around it stays empty.',
  need: 'If a number needs exactly as many squares as are still blank around it, fill them all.',
  over: 'Count the filled squares around each number: never more than the number itself.',
};
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
    const at = place(clue.row, clue.col);
    const reason = shouldFill
      ? value === window.length
        ? `The ${value} at ${at} counts its whole block of ${window.length} squares, so every one of them is filled, including ${place(cell.row, cell.col)}.`
        : `The ${value} at ${at} has ${count(filledNow, 'square')} filled around it and needs ${value}. The only way to reach it is to fill ${place(cell.row, cell.col)}.`
      : filledNow > value
        ? `The ${value} at ${at} has ${filledNow} squares filled around it, more than ${value}. ${place(cell.row, cell.col).replace(/^./, ch => ch.toUpperCase())} must be cleared.`
        : `The ${value} at ${at} already has all ${value} of its squares filled, so ${place(cell.row, cell.col)} stays empty.`;
    const tip = shouldFill ? (value === window.length ? TIPS.all : TIPS.need) : filledNow > value ? TIPS.over : TIPS.done;
    return { state: set(cell.row, cell.col), cell, kind: filledNow > value || (!shouldFill && state.filled[cell.row][cell.col]) ? 'fix' : 'rule', reason, tip };
  }

  // No clue's neighbourhood is wrong - a square outside every clue window.
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (wrongAt(r, c)) return { state: set(r, c), cell: { row: r, col: c }, kind: 'nudge', reason: puzzle.solution[r][c] ? 'The picture continues through this square.' : 'This square is outside the picture.' };
    }
  }
  return null;
}

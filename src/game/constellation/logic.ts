import { CellMark, ConstellationCell, ConstellationPuzzle, ConstellationState } from './types';

/** A fresh, empty board for `puzzle`. */
export function emptyConstellationState(puzzle: ConstellationPuzzle): ConstellationState {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    marks: Array.from({ length: puzzle.rows }, () =>
      Array.from({ length: puzzle.cols }, () => 'blank' as CellMark),
    ),
  };
}

function inBounds(state: ConstellationState, row: number, col: number): boolean {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

/**
 * Returns a new state with `(row, col)` set to `mark`. Pure - the input is
 * never mutated; an out-of-bounds cell or a no-op returns the same state.
 */
export function setMark(
  state: ConstellationState,
  row: number,
  col: number,
  mark: CellMark,
): ConstellationState {
  if (!inBounds(state, row, col) || state.marks[row][col] === mark) return state;
  const marks = state.marks.map((line, r) =>
    r === row ? line.map((m, c) => (c === col ? mark : m)) : line,
  );
  return { ...state, marks };
}

/** The next mark in the tap cycle: blank -> filled -> marked -> blank. */
export function nextMark(mark: CellMark): CellMark {
  return mark === 'blank' ? 'filled' : mark === 'filled' ? 'marked' : 'blank';
}

/**
 * A puzzle is solved when the set of `filled` cells is exactly the set of
 * solution cells. Player `marked` notes and stray blanks never matter; only
 * a missing fill or an extra fill keeps it unsolved.
 */
export function isConstellationSolved(
  state: ConstellationState,
  puzzle: ConstellationPuzzle,
): boolean {
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const shouldFill = puzzle.solution[r][c];
      const isFilled = state.marks[r][c] === 'filled';
      if (shouldFill !== isFilled) return false;
    }
  }
  return true;
}

/**
 * Solver-backed hint: finds the first cell (row-major) the player has wrong
 * and corrects exactly that one - fills a missing cell, or crosses out an
 * over-fill. Returns `null` when the board already matches the solution.
 */
export function revealHint(
  state: ConstellationState,
  puzzle: ConstellationPuzzle,
): { state: ConstellationState; cell: ConstellationCell } | null {
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const shouldFill = puzzle.solution[r][c];
      const isFilled = state.marks[r][c] === 'filled';
      if (shouldFill && !isFilled) {
        return { state: setMark(state, r, c, 'filled'), cell: { row: r, col: c } };
      }
      if (!shouldFill && isFilled) {
        return { state: setMark(state, r, c, 'marked'), cell: { row: r, col: c } };
      }
    }
  }
  return null;
}

/** Count of cells the player still has to fill correctly (for progress UI). */
export function remainingCells(state: ConstellationState, puzzle: ConstellationPuzzle): number {
  let remaining = 0;
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (puzzle.solution[r][c] && state.marks[r][c] !== 'filled') remaining += 1;
    }
  }
  return remaining;
}

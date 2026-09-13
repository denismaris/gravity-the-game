/**
 * Sudoku - the fourth game in the app. Classic rules: fill the 9x9 grid so
 * every row, column and 3x3 box contains each of 1-9 exactly once. Pure
 * data and functions, no React - tested on its own like the other engines.
 */

export const SIZE = 9;
export const BOX_SIZE = 3;

/** 0 means blank. */
export type SudokuValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface SudokuCell {
  readonly row: number;
  readonly col: number;
}

export interface SudokuPuzzle {
  readonly id: string;
  readonly name?: string;
  /**
   * The starting grid, 9x9, 0 for a blank cell the player fills in. The
   * single source of truth - there is no separately-authored "solution"
   * field. `solveSudoku` derives the answer from these givens on demand
   * (for hints, and for the authoring-time uniqueness check), the same way
   * Constellation derives its clues from the picture rather than
   * hand-writing them - the puzzle can never disagree with itself.
   */
  readonly givens: ReadonlyArray<ReadonlyArray<SudokuValue>>;
}

/** The player's current grid - starts equal to `givens`; only non-given
 * cells ever change. */
export interface SudokuState {
  readonly values: ReadonlyArray<ReadonlyArray<SudokuValue>>;
}

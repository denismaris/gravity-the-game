/**
 * Binairo (Takuzu). Fill every cell 0 or 1 so that no row or column ever
 * has three of the same value in a row, every row and column ends up with
 * an equal split of 0s and 1s, and no two rows - or two columns - are
 * identical. Zero dependency on React / Skia - pure data and functions,
 * tested on their own.
 */

/** `null` = blank. Unlike Sudoku's `0`, both real values (`0` and `1`) are
 * legitimate board values here, so blank needs its own, third state. */
export type BinairoValue = 0 | 1 | null;

export interface BinairoPuzzle {
  readonly id: string;
  readonly name?: string;
  /** Board is `size` x `size`. Always even - a row/column can't split
   * evenly between 0s and 1s otherwise. */
  readonly size: number;
  /** Pre-filled cells; `null` where the player must fill it in. */
  readonly givens: ReadonlyArray<ReadonlyArray<BinairoValue>>;
}

export interface BinairoState {
  readonly values: ReadonlyArray<ReadonlyArray<BinairoValue>>;
}

export interface BinairoCell {
  readonly row: number;
  readonly col: number;
}

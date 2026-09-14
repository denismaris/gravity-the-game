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

/** `'same'`: the two cells must end up equal. `'different'`: they must end
 * up opposite. */
export type BinairoConstraintKind = 'same' | 'different';

/**
 * A marker between two orthogonally-adjacent cells. Anchored at the
 * upper-left of the pair with a direction to its neighbour, so every
 * constraint has exactly one canonical shape - `(row, col, 'right')` means
 * "this cell and the one to its right", `(row, col, 'down')` means "this
 * cell and the one below" - rather than needing two mirrored entries per
 * pair or a separate `(row2, col2)` that could point anywhere.
 */
export interface BinairoConstraint {
  readonly row: number;
  readonly col: number;
  readonly direction: 'right' | 'down';
  readonly kind: BinairoConstraintKind;
}

export interface BinairoPuzzle {
  readonly id: string;
  readonly name?: string;
  /** Board is `size` x `size`. Always even - a row/column can't split
   * evenly between 0s and 1s otherwise. */
  readonly size: number;
  /** Pre-filled cells; `null` where the player must fill it in. */
  readonly givens: ReadonlyArray<ReadonlyArray<BinairoValue>>;
  /** `=`/`x` markers between adjacent cells - absent (or empty) on every
   * puzzle authored before this mechanic existed. An additional rule
   * layered on top of the base ruleset, not a replacement for any of it. */
  readonly constraints?: ReadonlyArray<BinairoConstraint>;
}

export interface BinairoState {
  readonly values: ReadonlyArray<ReadonlyArray<BinairoValue>>;
}

export interface BinairoCell {
  readonly row: number;
  readonly col: number;
}

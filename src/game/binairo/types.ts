/**
 * Binairo (Takuzu). Fill every cell 0 or 1 so that no row or column ever
 * has three of the same value in a row, every row and column ends up with
 * an equal split of 0s and 1s, and no two rows - or two columns - are
 * identical. Zero dependency on React / Skia - pure data and functions,
 * tested on their own.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

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

/**
 * A numeric clue printed on a given cell: exactly `count` of that cell's
 * orthogonal neighbours hold `1` (the circle) in the finished grid.
 *
 * The clue cell is an ordinary given and keeps its own `0`/`1` value - the
 * digit is drawn *on top of* its symbol rather than replacing it. That is
 * load-bearing, not cosmetic: every cell on this board has to hold a value
 * for `isBalancedAndFull`, the duplicate-line keys and the solver's quota
 * rule to mean anything, so a valueless "clue-only" cell would make its
 * row and column permanently unsolvable. A board with genuine holes is a
 * different puzzle, not an extra rule on this one.
 */
export interface BinairoCountClue {
  readonly row: number;
  readonly col: number;
  /** Bounded by how many orthogonal neighbours the cell actually has - 2
   * at a corner, 3 along an edge, 4 in the interior. */
  readonly count: number;
}

export interface BinairoPuzzle {
  readonly id: string;
  readonly name?: string;
  /** See `PuzzleDifficulty`'s own comment. Assigned by hand, not derived
   * from `size` alone - unlike this game's other three sibling games, the
   * size ramp here has one deliberate exception (the last, smallest
   * puzzle introduces `twinCells` in isolation on a 6x6 board rather than
   * continuing the size progression, so it's tagged by its actual
   * complexity, not its position). */
  readonly difficulty: PuzzleDifficulty;
  /** Board is `size` x `size`. Always even - a row/column can't split
   * evenly between 0s and 1s otherwise. */
  readonly size: number;
  /** Pre-filled cells; `null` where the player must fill it in. */
  readonly givens: ReadonlyArray<ReadonlyArray<BinairoValue>>;
  /** `=`/`x` markers between adjacent cells - absent (or empty) on every
   * puzzle authored before this mechanic existed. An additional rule
   * layered on top of the base ruleset, not a replacement for any of it. */
  readonly constraints?: ReadonlyArray<BinairoConstraint>;
  /**
   * Cells twinned with their 180-degree mirror opposite - `(row, col)` is
   * always twinned with `(size-1-row, size-1-col)`, a fixed relationship
   * derived from board geometry, never stored per-pair. Only one of the
   * two cells in a pair is ever listed here (see `twinPartner`), always
   * whichever one comes first in row-major order - `size` is always even
   * (see above), so `row === size-1-row` can never happen and this
   * canonical choice never has to break a tie. Absent (or empty) on every
   * puzzle authored before this mechanic existed, same as `constraints`.
   */
  readonly twinCells?: ReadonlyArray<BinairoCell>;
  /**
   * Numbered neighbour-count clues (see `BinairoCountClue`). Every entry's
   * cell must also be a given, since a clue cell carries a real value like
   * any other. Absent (or empty) on every puzzle authored before this
   * mechanic existed, same as `constraints` and `twinCells`.
   */
  readonly countClues?: ReadonlyArray<BinairoCountClue>;
}

export interface BinairoState {
  readonly values: ReadonlyArray<ReadonlyArray<BinairoValue>>;
}

export interface BinairoCell {
  readonly row: number;
  readonly col: number;
}

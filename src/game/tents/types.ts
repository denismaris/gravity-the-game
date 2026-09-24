/**
 * Tents and Trees. Every tree hides exactly one adjacent tent; find them all
 * without ever placing two tents next to each other (including diagonally),
 * matching the row and column counts along the way. Zero dependency on
 * React / Skia - pure data and functions, tested on their own.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

export interface TentsTreesCell {
  readonly row: number;
  readonly col: number;
}

export interface TentsTreesPuzzle {
  readonly id: string;
  readonly name?: string;
  /** See `PuzzleDifficulty`'s own comment. Assigned by grid size (this
   * game's own complexity ramp): 5x5 easy, 6x6 and the first 7x7 medium,
   * the second 7x7 and both 8x8s hard. */
  readonly difficulty: PuzzleDifficulty;
  readonly rows: number;
  readonly cols: number;
  readonly trees: ReadonlyArray<TentsTreesCell>;
  /** Tents required in each row, top to bottom - derived from an authored
   * placement at puzzle-creation time, never hand-counted (see puzzles.ts). */
  readonly rowCounts: ReadonlyArray<number>;
  /** Tents required in each column, left to right. */
  readonly colCounts: ReadonlyArray<number>;
}

/** What the player has put in a non-tree cell. `marked` is a "definitely not
 * a tent" note - bookkeeping only, it never affects solving. */
export type TentMark = 'empty' | 'tent' | 'marked';

export interface TentsTreesState {
  readonly marks: ReadonlyArray<ReadonlyArray<TentMark>>;
}

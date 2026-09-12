/**
 * Constellation - a nonogram / picross puzzle. The second game in the app.
 *
 * You are handed run-length clues for every row and column and must fill
 * the cells that form the hidden picture (a small "star pattern"). Zero
 * dependency on React / Skia - pure data and functions, tested on their
 * own, exactly like the gravity engine.
 */

/** What the player has put in a cell. Only `filled` counts toward solving;
 * `marked` is the player's own "this one is definitely empty" note. */
export type CellMark = 'blank' | 'filled' | 'marked';

export interface ConstellationPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly rows: number;
  readonly cols: number;
  /** `solution[r][c] === true` when the cell is part of the picture. */
  readonly solution: ReadonlyArray<ReadonlyArray<boolean>>;
  /** Run lengths per row, top to bottom. An empty row is `[]`. */
  readonly rowClues: ReadonlyArray<ReadonlyArray<number>>;
  /** Run lengths per column, left to right. */
  readonly colClues: ReadonlyArray<ReadonlyArray<number>>;
}

export interface ConstellationState {
  readonly rows: number;
  readonly cols: number;
  readonly marks: ReadonlyArray<ReadonlyArray<CellMark>>;
}

export interface ConstellationCell {
  readonly row: number;
  readonly col: number;
}

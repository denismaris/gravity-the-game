/**
 * Skyscrapers (Towers). An NxN Latin square - every row and column holds
 * each height 1..N exactly once - where edge clues tell you how many
 * towers are visible looking straight in from that side (a taller tower
 * hides every shorter one behind it). Zero dependency on React / Skia -
 * pure data and functions, tested on their own.
 */

/** `0` is safe as "blank" here: a real tower height is always 1..N and a
 * real visibility clue is always >=1, so `0` is never a legitimate value
 * for either. */
export type TowerHeight = number;

export interface TowersPuzzle {
  readonly id: string;
  readonly name?: string;
  /** Board is `size` x `size`. This pass only ships 4 and 5. */
  readonly size: number;
  /** Clue above column `c`, looking down into it. `0` = unclued. */
  readonly topClues: ReadonlyArray<number>;
  /** Clue below column `c`, looking up into it. */
  readonly bottomClues: ReadonlyArray<number>;
  /** Clue left of row `r`, looking right into it. */
  readonly leftClues: ReadonlyArray<number>;
  /** Clue right of row `r`, looking left into it. */
  readonly rightClues: ReadonlyArray<number>;
}

export interface TowersState {
  readonly values: ReadonlyArray<ReadonlyArray<TowerHeight>>;
}

export interface TowersCell {
  readonly row: number;
  readonly col: number;
}

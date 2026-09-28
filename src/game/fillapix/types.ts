/**
 * Fill-a-Pix - a small hand-drawn picture, hidden behind a grid of number
 * clues. Each clue counts how many of a cell's 8 neighbours (not the cell
 * itself - see the doc comment on `clueValue` in `logic.ts`) are filled;
 * only some cells carry a clue at all.
 *
 * `solution` is not an optional extra kept around for a hint button - it
 * *is* the picture. There is no separate "hidden image" asset: the cells
 * the player fills in are literally the same grid as `solution`, so
 * solving the puzzle and drawing the picture are the same act, visible
 * incrementally throughout play rather than revealed only at the end.
 *
 * Zero dependency on React / Skia - pure data and functions, tested on
 * their own, like every other game module here.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

export interface FillaPixCell {
  readonly row: number;
  readonly col: number;
}

export interface FillaPixPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  /** Board is `size` x `size`. */
  readonly size: number;
  /** The picture. `solution[row][col] === true` means that cell is
   * filled in the finished picture. */
  readonly solution: ReadonlyArray<ReadonlyArray<boolean>>;
  /** Which cells show their clue number to the player - a subset of all
   * `size * size` cells, chosen at authoring time to be just enough (or,
   * for easier tiers, more than just enough) to pin the picture down to
   * exactly one solution. See `generator.ts` for how this subset is
   * chosen and verified. */
  readonly clues: ReadonlyArray<FillaPixCell>;
}

export interface FillaPixState {
  /** The player's own fill grid, same shape as `solution`, starting all
   * `false`. Every cell is always in a definite filled/empty state -
   * there is no third "unknown" mark, unlike Binairo/Tents. */
  readonly filled: ReadonlyArray<ReadonlyArray<boolean>>;
}

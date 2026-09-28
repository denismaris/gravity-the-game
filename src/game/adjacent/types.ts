/**
 * Adjacent - a grid of coloured tiles. Tap any tile that touches at least
 * one more of its own colour and the whole connected run clears; whatever
 * sat above it falls into the gap. Reach the board's target score (or
 * clear it outright) to finish.
 *
 * The one game here that is **not** a deduction puzzle. Every other game
 * in this app has a unique solution its own solver can prove; this one has
 * a *score*, and many orderings that reach it. That difference shapes the
 * whole module:
 *
 *  - There is no `solveAdjacent(puzzle, limit)` returning solutions to
 *    count, because "how many ways" is not a meaningful question here.
 *    `solver.ts` instead searches for a line of play that *reaches the
 *    target*, which is the property that actually has to hold for a
 *    shipped board to be fair - and it proves it by finding one, never by
 *    asserting it.
 *  - Difficulty is banded on grid size, colour count and fill, and then
 *    every candidate board is checked against that search before it ships
 *    (see `generator.ts`), the same way Lights Out bands on par and then
 *    verifies it.
 *
 * Zero dependency on React / Skia - pure data and functions, tested on
 * their own, like every other game module here.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * A tile's colour, as an index into the board's palette rather than a hex
 * string: the engine has no business knowing what `2` looks like, and the
 * renderer is free to retune the palette without touching a single shipped
 * puzzle. `null` is an empty square.
 */
export type AdjacentColor = number;
export type AdjacentCell = AdjacentColor | null;

export interface AdjacentCoord {
  readonly row: number;
  readonly col: number;
}

/** One tile's journey during a single gravity settle - what the renderer
 * needs to animate a fall, emitted by the engine rather than recovered by
 * diffing two grids (a diff cannot tell which of two same-coloured tiles
 * in a column moved where, and guessing produces tiles that visibly swap
 * places). Columns never change, so only the rows are given. */
export interface AdjacentFall {
  readonly col: number;
  readonly fromRow: number;
  readonly toRow: number;
}

/** The result of one tap: what cleared, what it scored, and where
 * everything landed. */
export interface AdjacentMove {
  /** The board after the group cleared *and* gravity settled. */
  readonly state: AdjacentState;
  /** Every tile that was removed, for the fade-and-shrink. */
  readonly removed: ReadonlyArray<AdjacentCoord>;
  /** Every tile that then fell, for the drop. */
  readonly falls: ReadonlyArray<AdjacentFall>;
  /** Points this tap was worth on its own. */
  readonly gained: number;
  /** The bonus band this group landed in - 1 for an ordinary pair, more
   * for a run big enough to be worth calling out ("3x"). */
  readonly multiplier: number;
}

export interface AdjacentPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  /** Board is `size` x `size`. */
  readonly size: number;
  /** How many distinct colours this board was dealt from. Stored rather
   * than derived from `initial`, so a board that happens to have lost a
   * colour to the shuffle still declares the palette it was built for. */
  readonly colors: number;
  /** The board as dealt, already settled under gravity. */
  readonly initial: ReadonlyArray<ReadonlyArray<AdjacentCell>>;
  /**
   * The score that finishes this board.
   *
   * Verified reachable before the puzzle ships - `generator.ts` only
   * accepts a board once `searchBestScore` has actually *found* a line of
   * play that beats it with room to spare, so this is a proven lower
   * bound on what the board can give up, not an authored guess. A target
   * no line of play can reach would be an unwinnable puzzle, and unlike a
   * deduction puzzle there is no contradiction to notice - the player
   * would simply run the board out and be told they failed.
   */
  readonly targetScore: number;
}

export interface AdjacentState {
  readonly grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>;
  readonly score: number;
  /** How many groups have been cleared - the "cascades" the finish card
   * reports, and the only other number this game keeps. */
  readonly cascades: number;
}

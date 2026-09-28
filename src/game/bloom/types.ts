import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * Bloom: a board of curved tiles. Every piece of line on it is a quarter
 * circle wrapping one corner of its cell, so any loop you close is made of
 * nothing but quarter arcs - which is why a closed loop comes out lobed and
 * scalloped, the silhouette of a blossom, rather than a rectangle.
 *
 * - `empty`: no line.
 * - `arc`: one quarter arc. The player rotates these.
 * - `knot`: two quarter arcs in opposite corners. A knot touches all four
 *   edges whichever way it is turned, so no rule could ever tell the player
 *   which way it should face - it is therefore fixed, drawn pinned, and
 *   doubles as a clue.
 */
export type BloomTileKind = 'empty' | 'arc' | 'knot';

/**
 * Edges of a cell, clockwise from the top: 0 = north, 1 = east, 2 = south,
 * 3 = west. An arc at rotation `r` joins edge `r` to edge `r + 1`, wrapping
 * the corner between them (0 = NE, 1 = SE, 2 = SW, 3 = NW), so turning a
 * tile a quarter clockwise is simply `r + 1`. A knot's rotation is 0 (NE +
 * SW arcs) or 1 (SE + NW arcs).
 */
export type BloomEdge = 0 | 1 | 2 | 3;

export interface BloomCell {
  readonly row: number;
  readonly col: number;
}

export interface BloomPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  readonly rows: number;
  readonly cols: number;
  readonly kinds: ReadonlyArray<ReadonlyArray<BloomTileKind>>;
  /** The one arrangement that closes every loop. */
  readonly solution: ReadonlyArray<ReadonlyArray<number>>;
  /** Where every tile starts. */
  readonly start: ReadonlyArray<ReadonlyArray<number>>;
  /** Arcs shown already turned the right way and pinned, as clues. Knots
   * and empty cells are fixed by nature and are not listed here. */
  readonly pinned: ReadonlyArray<ReadonlyArray<boolean>>;
}

export interface BloomState {
  readonly rotations: ReadonlyArray<ReadonlyArray<number>>;
}

import { PuzzleDifficulty } from '../puzzleDifficulty';
import type { MosaicTheme } from './silhouettes';

/**
 * Mosaic: a silhouette - a vase, a bird, a blossom - drawn on the paper as
 * a bed of empty grout, and a tray of coloured pieces that fill it
 * exactly. Place every piece, cover every square, and the silhouette
 * becomes a finished mosaic picture.
 */

export interface MosaicCell {
  readonly row: number;
  readonly col: number;
}

/** One piece: its squares in its *solution* orientation, normalised so the
 * smallest row and column are 0. */
export interface MosaicPiece {
  readonly id: string;
  readonly cells: ReadonlyArray<MosaicCell>;
  /** Index into the palette the board draws with - chosen so neighbours in
   * the finished picture never share a colour. */
  readonly color: number;
}

/** How a piece is turned: `rotation` quarter-turns clockwise, applied after
 * an optional mirror across its vertical axis. */
export interface MosaicOrientation {
  readonly rotation: number;
  readonly flipped: boolean;
}

/** Where a piece sits on the board: its oriented shape's top-left corner. */
export interface MosaicPlacement extends MosaicOrientation {
  readonly row: number;
  readonly col: number;
}

export interface MosaicPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  /** What the picture is of - 'vase', 'bird' - for the finished card. */
  readonly subject: string;
  /** The glaze the pieces are drawn in - see the board's palettes. */
  readonly theme: MosaicTheme;
  readonly rows: number;
  readonly cols: number;
  /** `true` for every square of the picture. */
  readonly silhouette: ReadonlyArray<ReadonlyArray<boolean>>;
  readonly pieces: ReadonlyArray<MosaicPiece>;
  /** The one arrangement that fills the picture, piece by piece. */
  readonly solution: ReadonlyArray<MosaicPlacement>;
  /** How each piece is turned in the tray when the puzzle opens. */
  readonly start: ReadonlyArray<MosaicOrientation>;
  /** Hard boards let pieces be mirrored as well as turned. */
  readonly allowFlip: boolean;
  /** Pieces already set in the picture when it opens - clues, locked in
   * their solution place. Per piece, in `pieces` order. */
  readonly fixed: ReadonlyArray<boolean>;
}

/** Per piece, in `puzzle.pieces` order: its current orientation, and where
 * it sits on the board - or `null` while it is in the tray. */
export interface MosaicPieceState extends MosaicOrientation {
  readonly at: MosaicCell | null;
}

export interface MosaicState {
  readonly pieces: ReadonlyArray<MosaicPieceState>;
}

export type { MosaicCell, MosaicOrientation, MosaicPiece, MosaicPieceState, MosaicPlacement, MosaicPuzzle, MosaicState } from './types';
export type { MosaicTheme, Silhouette } from './silhouettes';
export {
  canPlace,
  chooseFixedPieces,
  FIXED_SHARE,
  cellKey,
  distinctOrientations,
  flipPiece,
  initialMosaicState,
  isMosaicSolved,
  liftPiece,
  normalise,
  occupancy,
  orient,
  placedCells,
  piecesLeft,
  placePiece,
  rotatePiece,
  shapeKey,
  silhouetteSize,
  squaresLeft,
} from './logic';
export { assertValidMosaic, countTilings, revealMosaicHint } from './solver';
export { generateMosaic, PALETTE_SIZE, shapeForDifficulty } from './generator';
export type { MosaicShape } from './generator';
export { SILHOUETTES, silhouetteGrid } from './silhouettes';
export { getMosaicByDifficulty, getMosaicById, MOSAIC } from './puzzles';

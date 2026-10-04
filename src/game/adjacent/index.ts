export type { AdjacentCell, AdjacentColor, AdjacentCoord, AdjacentFall, AdjacentMove, AdjacentPuzzle, AdjacentState } from './types';
export {
  applyTap,
  cascadeScore,
  groupAt,
  hasLegalMove,
  initialAdjacentState,
  isAdjacentSolved,
  isAdjacentStuck,
  isLegalTap,
  legalMoves,
  MIN_GROUP,
  multiplierFor,
  settle,
  tileCount,
} from './logic';
export type { AdjacentLine, AdjacentSearch, SearchOptions, ValidationOptions } from './solver';
export { assertValidAdjacent, reachesTargetWithin, replayLine, searchAdjacent, searchBestScore } from './solver';
export type { AdjacentHint } from './explain';
export { explainAdjacentHint } from './explain';
export type { AdjacentShape } from './generator';
export { generateAdjacent, minTapsToTargetFor, shapeForDifficulty } from './generator';
export { ADJACENT, getAdjacentByDifficulty, getAdjacentById } from './puzzles';

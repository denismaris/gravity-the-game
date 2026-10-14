export type { AdjacentCell, AdjacentColor, AdjacentCoord, AdjacentFall, AdjacentMove, AdjacentPuzzle, AdjacentState } from './types';
export { GOLD, STONE } from './types';
export {
  applyTap,
  cascadeScore,
  crumbling,
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
  STONE_BONUS,
  tileCount,
} from './logic';
export type { AdjacentLine, AdjacentSearch, SearchOptions, ValidationOptions } from './solver';
export { assertValidAdjacent, reachesTargetWithin, replayLine, searchAdjacent, searchBestScore } from './solver';
export type { AdjacentHint } from './explain';
export { explainAdjacentHint } from './explain';
export type { AdjacentRules, AdjacentShape } from './generator';
export { ADJACENT_RULED, generateAdjacent, minTapsToTargetFor, shapeForDifficulty, targetWithRules } from './generator';
export { ADJACENT, getAdjacentByDifficulty, getAdjacentById } from './puzzles';

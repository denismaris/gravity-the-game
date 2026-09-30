export type { BridgeLink, BridgesIsland, BridgesPuzzle, BridgesState } from './types';
export {
  blockingLink,
  bridgeLinks,
  bridgesLeft,
  bridgesShapeKey,
  canBuild,
  components,
  cycleBridge,
  emptyBridgesState,
  isBridgesSolved,
  islandLoads,
  linkBetween,
  linkFrom,
  linksByIsland,
  setBridges,
} from './logic';
export type { BridgeBounds, Deduction } from './solver';
export { assertValidBridges, countBridgesSolutions, deduceBridges, isSolvableByLogic, revealBridgesHint } from './solver';
export { generateBridges, shapeForDifficulty } from './generator';
export type { BridgesShape } from './generator';
export { BRIDGES, getBridgesByDifficulty, getBridgesById } from './puzzles';

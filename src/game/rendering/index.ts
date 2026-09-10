export { BoardView } from './BoardView';
export type { BoardViewProps } from './BoardView';
export { computeBoardLayout, getCellCenter, getCellOrigin } from './layout';
export type { BoardLayout } from './layout';
export {
  AnchoredPiece,
  CellBackground,
  MovablePiece,
  ObstacleBlock,
  TargetMarker,
} from './shapes';
export { useAnimatedMovables } from './useAnimatedMovables';
export type { AnimatedMovablesResult } from './useAnimatedMovables';
export { setHapticsEnabled, triggerHaptic } from './haptics';
export type { HapticKind } from './haptics';

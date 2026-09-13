export { BoardView } from './BoardView';
export type { BoardViewProps } from './BoardView';
export { computeBoardLayout, getCellCenter, getCellOrigin } from './layout';
export type { BoardLayout } from './layout';
export {
  AnchoredPiece,
  CellBackground,
  DestroyedPieceMark,
  GravityZoneOverlay,
  HazardMarker,
  MovablePiece,
  ObstacleBlock,
  PortalMark,
  TargetMarker,
} from './shapes';
export { useAnimatedMovables } from './useAnimatedMovables';
export type { AnimatedMovablesResult } from './useAnimatedMovables';
export { useAnimatedBeamReveal } from './useAnimatedBeamReveal';
export type { AnimatedBeamRevealResult } from './useAnimatedBeamReveal';
export { useAnimationClock } from './useAnimationClock';
export { setHapticsEnabled, triggerHaptic } from './haptics';
export type { HapticKind } from './haptics';
export { setSoundEnabled, triggerSound } from './sound';
export { triggerFeedback } from './feedback';

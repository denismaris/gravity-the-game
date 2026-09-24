export { BoardView } from './BoardView';
export type { BoardViewProps } from './BoardView';
export { hexToRgb, shade } from './color';
export type { Rgb } from './color';
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
export { INTRO_STAGGER_MS, INTRO_TILE_MS, INTRO_TOTAL_MS, introCellProgress, isIntroActive, useIntroWave } from './introWave';
export { useAnimationClock } from './useAnimationClock';
export { useReducedMotion } from './useReducedMotion';
export { setHapticsEnabled, triggerHaptic } from './haptics';
export type { HapticKind } from './haptics';
export { setSoundEnabled, triggerSound } from './sound';
export { triggerFeedback } from './feedback';

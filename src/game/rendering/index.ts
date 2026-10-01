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
export { IDLE_MOTION_FPS, INTRO_STAGGER_MS, INTRO_TILE_MS, INTRO_TOTAL_MS, introCellProgress, isIntroActive, useIntroWave } from './introWave';
export { useAnimationClock } from './useAnimationClock';
export { useReducedMotion } from './useReducedMotion';
export { useScreenReader } from './useScreenReader';
export { playHapticEvents, setHapticsEnabled, stopHaptics, triggerHaptic } from './haptics';
export type { HapticKind } from './haptics';
export { previewChime, setSoundEnabled, setSolveChime, triggerSound } from './sound';
export { triggerFeedback } from './feedback';

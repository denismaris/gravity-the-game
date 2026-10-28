export { BoardView } from './BoardView';
export type { BoardViewProps } from './BoardView';
export { contrastRatio, hexToRgb, readableOn, shade } from './color';
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
export { useSlidePlan } from './useAnimatedMovables';
export type { SlidePlan } from './useAnimatedMovables';
export { useAnimatedBeamReveal } from './useAnimatedBeamReveal';
export type { AnimatedBeamRevealResult } from './useAnimatedBeamReveal';
export { IDLE_MOTION_FPS, INTRO_STAGGER_MS, INTRO_TILE_MS, INTRO_TOTAL_MS, introCellProgress, isIntroActive, useIntroWave } from './introWave';
export { useAnimationClock } from './useAnimationClock';
export { isReducedMotion, reducedMotionFlag, useReducedMotion } from './useReducedMotion';
export { useScreenReader } from './useScreenReader';
export { playHapticEvents, setHapticsEnabled, stopHaptics, triggerHaptic } from './haptics';
export type { HapticKind } from './haptics';
export { previewChime, setSoundEnabled, setSolveChime, triggerSound } from './sound';
export { setMusicEnabled } from './music';
export { triggerFeedback } from './feedback';
export { DealIn, dealDelay, useDealing, DEAL_MS, DEAL_SPREAD_MS } from './DealIn';
export type { DealClock } from './DealIn';
export { holdDeals, releaseDeals } from './dealGate';
export { REFUSE_MS, REFUSE_PX, RefuseMark, refuseFade, refuseShake } from './Refusal';
export { announce } from './announce';

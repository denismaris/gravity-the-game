export type { Cell, Direction, GameState, GravityZone, MovableObject, PortalPair } from './types';
export { ALL_DIRECTIONS, StaticCellType } from './types';
export { applyGravity, gravityChangesState } from './gravity';
export { createGameStateFromBoard } from './fromBoard';
export { isPuzzleSolved } from './completion';
export { findShortestSolution } from './solver';
export type { GameAction, GameSession } from './session';
export { canUndo, createGameSession, gameSessionReducer, getCurrentState } from './session';

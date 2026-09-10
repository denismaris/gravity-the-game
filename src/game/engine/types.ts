/**
 * Core domain types for the Gravity puzzle engine.
 *
 * This file has ZERO dependencies on React, React Native or Skia. It is
 * pure TypeScript so it can be tested and reused completely independently
 * of how (or whether) it is ever rendered.
 */

/** One of the four directions gravity can be applied in. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Convenience list of every direction, useful for iteration in tests/UI. */
export const ALL_DIRECTIONS: ReadonlyArray<Direction> = ['up', 'down', 'left', 'right'];

/**
 * The non-moving contents of a board cell. Movable objects are tracked
 * separately (see `MovableObject`) so the engine can slide them around
 * without having to rewrite a whole grid on every move.
 */
export enum StaticCellType {
  Empty = 'empty',
  Target = 'target',
  Obstacle = 'obstacle',
}

/**
 * A single object on the board.
 *
 * Most objects are moved by gravity. An `anchored` object is the exception:
 * it never moves, and every other object collides with it exactly as it would
 * with a static obstacle. It is still tracked here (not in `staticGrid`)
 * because it is conceptually a game piece - it has a stable identity, it is
 * placed by a level's object data, and the renderer draws it as a piece.
 *
 * An anchored object is NOT a candidate for covering a target (see
 * `isPuzzleSolved`); its only role is to occupy a cell and block movement.
 */
export interface MovableObject {
  /** Stable identity, used for tracking a piece across gravity calls (e.g. for animation). */
  readonly id: string;
  readonly row: number;
  readonly col: number;
  /**
   * When true, gravity never moves this object. It acts as a permanent
   * blocker (identical to an obstacle for collision purposes) and does not
   * count towards solving the puzzle. Absent/false means a normal movable
   * object, which behaves exactly as it always has.
   */
  readonly anchored?: boolean;
}

/** One cell on the board. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

/**
 * A linked pair of portal cells. An object that would slide *onto* either
 * endpoint is instead moved to the other endpoint and keeps sliding in the
 * current gravity direction (see `applyGravity`). Portals are static level
 * geometry - like obstacles, they never change and are carried unchanged
 * through every `GameState` snapshot, so undo/restart need no portal-specific
 * handling. The pair is symmetric: `[0] -> [1]` and `[1] -> [0]`.
 */
export type PortalPair = readonly [Cell, Cell];

/**
 * A rectangular region of the board (rows `minRow..maxRow`, cols
 * `minCol..maxCol`, all inclusive) inside which gravity always pulls in
 * `direction`, regardless of the global direction the player pressed. An
 * object's direction is decided cell by cell as it slides: inside the
 * rectangle it uses `direction`, outside it uses the global direction (see
 * `applyGravity`). Static level geometry - carried unchanged through every
 * snapshot, so undo/restart need no zone-specific handling.
 */
export interface GravityZone {
  readonly minRow: number;
  readonly maxRow: number;
  readonly minCol: number;
  readonly maxCol: number;
  readonly direction: Direction;
}

/**
 * A full snapshot of the puzzle board at a point in time.
 *
 * `staticGrid` and `portals` never change as a result of gravity - only
 * `movables` does. `staticGrid` is indexed as `staticGrid[row][col]`.
 */
export interface GameState {
  readonly rows: number;
  readonly cols: number;
  readonly staticGrid: ReadonlyArray<ReadonlyArray<StaticCellType>>;
  readonly movables: ReadonlyArray<MovableObject>;
  /** Linked portal-cell pairs. Empty when a level has no portals. */
  readonly portals: ReadonlyArray<PortalPair>;
  /** The single gravity zone, or `null` when the level has none. */
  readonly zone: GravityZone | null;
}

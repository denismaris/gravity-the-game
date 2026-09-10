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

/**
 * A full snapshot of the puzzle board at a point in time.
 *
 * `staticGrid` never changes as a result of gravity - only `movables` does.
 * `staticGrid` is indexed as `staticGrid[row][col]`.
 */
export interface GameState {
  readonly rows: number;
  readonly cols: number;
  readonly staticGrid: ReadonlyArray<ReadonlyArray<StaticCellType>>;
  readonly movables: ReadonlyArray<MovableObject>;
}

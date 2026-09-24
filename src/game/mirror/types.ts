/**
 * Core domain types for Mirror Maze.
 *
 * Defined locally rather than importing `Direction` from `src/game/engine`
 * (Gravity's own engine) - every game module in this app is independently
 * self-contained, so one game is never a compile-time dependency of another,
 * even where the underlying concept (four cardinal directions) is identical.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** `/` reflects like the line row+col=const ("fwd"); `\` reflects like
 * row=col+const ("back"). See `reflect` in logic.ts for the exact mapping. */
export type MirrorKind = 'fwd' | 'back';

export interface MirrorMazeCell {
  readonly row: number;
  readonly col: number;
}

export interface MirrorMazePuzzle {
  readonly id: string;
  readonly name?: string;
  /** See `PuzzleDifficulty`'s own comment. Assigned by grid size (this
   * game's own complexity ramp): the four 4x4s easy, the four 5x5s medium,
   * the four 6x6s hard. */
  readonly difficulty: PuzzleDifficulty;
  readonly rows: number;
  readonly cols: number;
  /** Must be on an edge cell (row 0/rows-1 or col 0/cols-1). */
  readonly source: MirrorMazeCell;
  /** Must point inward from `source` - validated by `assertValidMirrorMaze`. */
  readonly sourceDirection: Direction;
  /** Where the beam must end up. Acts as a sink: the trace always stops the
   * instant it reaches this cell, whatever mirror (if any) sits there. */
  readonly target: MirrorMazeCell;
  /** Cells the beam's path must pass through, in any order. A gem may also
   * hold a player-placed mirror - it is a checkpoint, not a placement
   * restriction. */
  readonly gems: ReadonlyArray<MirrorMazeCell>;
  /** Fixed, permanent blockers - never player-editable. The beam stops the
   * cell before an obstacle, exactly like it stops at the board edge. */
  readonly obstacles: ReadonlyArray<MirrorMazeCell>;
}

/** Player-placed mirrors only. Same `rows x cols` shape as the puzzle grid;
 * `null` = no mirror. Cells that aren't eligible for a mirror (source,
 * target, obstacles) are always `null` and never change. */
export interface MirrorMazeState {
  readonly mirrors: ReadonlyArray<ReadonlyArray<MirrorKind | null>>;
}

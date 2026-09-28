/**
 * Lights Out - a grid of lights, where pressing one flips it *and* its
 * four orthogonal neighbours. Turn every light off to win.
 *
 * No `solution` is stored on a puzzle, unlike Arukone+/Fill-a-Pix. It
 * would be the wrong shape here: a press is its own inverse and presses
 * commute, so "the solution" is a *set* of cells rather than a sequence,
 * and the set that solves the board the player is looking at right now
 * changes with every press they make. `solver.ts` derives it from the
 * current state instead - which is what a hint actually needs, and what
 * makes solvability something this module can check rather than assert.
 *
 * Zero dependency on React / Skia - pure data and functions, tested on
 * their own, like every other game module here.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

export interface LightsOutCell {
  readonly row: number;
  readonly col: number;
}

export interface LightsOutPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  /** Board is `size` x `size`. */
  readonly size: number;
  /** The lights that start on. `true` is lit. */
  readonly initial: ReadonlyArray<ReadonlyArray<boolean>>;
  /**
   * The fewest presses that can clear this board - its par, shown to the
   * player the way Gravity shows its own.
   *
   * This is what difficulty is actually banded on (see `generator.ts`),
   * and it is stored rather than derived for the same reason Gravity
   * stores `metadata.minMoves`: the screen reads it every render, and
   * recomputing a Gaussian elimination that often to learn a fixed
   * property of a fixed board would be silly. Like `minMoves`, it is
   * verified against the real solver in the test suite, so it cannot
   * quietly drift out of step with the board it describes.
   */
  readonly par: number;
}

export interface LightsOutState {
  /** Which lights are currently on, same shape as `puzzle.initial`. */
  readonly lights: ReadonlyArray<ReadonlyArray<boolean>>;
}

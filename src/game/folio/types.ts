/**
 * Folio - a sheet of paper squares, each painted on both sides. Fold it
 * along its creases, the smaller side over onto the larger, until the
 * squares facing up are the ones the target shows.
 *
 * A board is only its sheet and its target; the state is the list of
 * folds made so far, so the sheet in the player's hands is always that
 * list replayed (`sheetOf`). That keeps undo, saves and hints trivial:
 * a fold is never edited, only added or taken back.
 *
 * Zero dependency on React / Skia, like every other game module here.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

/** The four colours a square can be painted. `paper` is the bare sheet. */
export type FolioInk = 'paper' | 'vermilion' | 'indigo' | 'saffron';

export const FOLIO_INKS: ReadonlyArray<FolioInk> = ['paper', 'vermilion', 'indigo', 'saffron'];

/** One square of the sheet as dealt: its top face, and the face under it. */
export interface FolioSquare {
  readonly front: FolioInk;
  readonly back: FolioInk;
}

/** A square somewhere in a stack, and which way up it lies. */
export interface FolioLayer {
  /** Index into `FolioPuzzle.squares`. */
  readonly square: number;
  /** True while its front faces up. */
  readonly up: boolean;
}

/**
 * A crease: `v` runs top to bottom between columns `at - 1` and `at`,
 * `h` runs side to side between rows `at - 1` and `at`.
 */
export interface FolioFold {
  readonly axis: 'v' | 'h';
  readonly at: number;
}

/** The sheet as it lies now, folded or not. */
export interface FolioSheet {
  readonly width: number;
  readonly height: number;
  /** Where its top-left square sat on the flat sheet, in squares - only
   * for drawing, so a fold is seen to happen in place. */
  readonly left: number;
  readonly top: number;
  /** Row-major, `width * height` stacks, each listed bottom to top. */
  readonly stacks: ReadonlyArray<ReadonlyArray<FolioLayer>>;
}

export interface FolioTarget {
  readonly width: number;
  readonly height: number;
  /** Row-major: the ink each square must show on top. */
  readonly inks: ReadonlyArray<FolioInk>;
}

export interface FolioPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  readonly width: number;
  readonly height: number;
  /** Row-major, `width * height`. */
  readonly squares: ReadonlyArray<FolioSquare>;
  readonly target: FolioTarget;
  /** The fewest folds that make the target - shown to the player as the
   * fold count, and verified by the real search in the tests. */
  readonly par: number;
}

export interface FolioState {
  readonly folds: ReadonlyArray<FolioFold>;
}

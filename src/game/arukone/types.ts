/**
 * Arukone+ - connect each pair of matching numbers with a path, around
 * obstacles, where the whole set of paths is mirror-symmetric.
 *
 * The symmetry is not a rule the player has to remember and can fail: a
 * path drawn in one half is mirrored into the other half as it is drawn
 * (see `mirrorCell` and the board's own drawing code). That is a
 * deliberate reading of the mechanic rather than a shortcut. If the puzzle
 * is symmetric and the solution must be symmetric, then the mirrored half
 * is *completely determined* by the half you draw - so asking a player to
 * draw both halves is asking for redundant work, and then failing them
 * when the two halves disagree, with nothing useful to say about which one
 * was wrong. Mirroring as they draw makes the constraint impossible to
 * break and turns it into the thing that makes the game feel good.
 *
 * Zero dependency on React / Skia - pure data and functions, tested on
 * their own, like every other game module here.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

export interface ArukoneCell {
  readonly row: number;
  readonly col: number;
}

/**
 * Which way the board folds onto itself. Every puzzle's obstacles and
 * endpoints are placed symmetrically under its own axis, so a symmetric
 * solution is guaranteed to exist by construction.
 */
export type ArukoneAxis = 'vertical' | 'horizontal' | 'rotational';

/** One number, and the two cells it appears in. */
export interface ArukonePair {
  /** The digit shown in both endpoint cells. */
  readonly value: number;
  readonly a: ArukoneCell;
  readonly b: ArukoneCell;
}

export interface ArukonePuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  /** Board is `size` x `size`. */
  readonly size: number;
  readonly axis: ArukoneAxis;
  /** Cells no path may enter. Always a symmetric set under `axis`. */
  readonly obstacles: ReadonlyArray<ArukoneCell>;
  readonly pairs: ReadonlyArray<ArukonePair>;
  /**
   * One known symmetric solution, keyed by pair value - the very paths
   * the generator grew before throwing away everything but their
   * endpoints (see `generator.ts`).
   *
   * Kept rather than discarded for two reasons. It is what the hint
   * button hands out, so a stuck player gets a path that genuinely
   * belongs to a complete solution rather than a locally-plausible guess.
   * And it turns "a symmetric solution exists" from a claim about the
   * generation algorithm into something the test suite can actually run:
   * feeding this straight into `isArukoneSolved` either solves the board
   * or it does not.
   *
   * Not a claim of uniqueness - other symmetric solutions usually exist,
   * and the player is never checked against this one.
   */
  readonly solution: Readonly<Record<number, ReadonlyArray<ArukoneCell>>>;
}

export interface ArukoneState {
  /**
   * The path drawn for each pair value, as an ordered run of orthogonally
   * adjacent cells starting at one endpoint. A value missing from here has
   * no path yet; a value present but not yet reaching its other endpoint
   * is a path mid-draw, which is legal and simply unfinished.
   */
  readonly paths: Readonly<Record<number, ReadonlyArray<ArukoneCell>>>;
}

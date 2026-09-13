/**
 * Trajectory - a flow / connect puzzle. The third game in the app.
 *
 * The board has pairs of matching endpoints. Draw a path between each pair
 * so that no two paths cross and every cell is covered. Pure data and
 * functions, no React / Skia - tested on its own like the other engines.
 */

export interface TrajectoryCell {
  readonly row: number;
  readonly col: number;
}

/** One matched pair of endpoints, identified by a small integer colour id. */
export interface TrajectoryPair {
  readonly color: number;
  readonly a: TrajectoryCell;
  readonly b: TrajectoryCell;
}

export interface TrajectoryPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly rows: number;
  readonly cols: number;
  readonly pairs: ReadonlyArray<TrajectoryPair>;
  /**
   * Cells no path may ever enter - unlike an endpoint or another colour's
   * path (which are merely off-limits to a *different* colour), a blocked
   * cell is off-limits to everyone, permanently, and doesn't count toward
   * "every cell covered". Optional - a puzzle without this field plays
   * exactly as before, covering the full `rows * cols` board.
   */
  readonly blocked?: ReadonlyArray<TrajectoryCell>;
}

/**
 * The player's current drawing: for each colour, the ordered list of cells
 * of its path (empty when nothing is drawn yet). A path always starts at
 * one of the colour's endpoints.
 */
export interface TrajectoryState {
  readonly rows: number;
  readonly cols: number;
  readonly paths: Readonly<Record<number, ReadonlyArray<TrajectoryCell>>>;
}

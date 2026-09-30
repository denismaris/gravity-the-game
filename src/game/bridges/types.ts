import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * Bridges (Hashi): numbered islands on open water. Join them with straight
 * horizontal or vertical bridges - one or two between any pair - so that
 * every island carries exactly as many bridges as its number, no two
 * bridges cross, and the whole archipelago is one connected network.
 */

export interface BridgesIsland {
  readonly row: number;
  readonly col: number;
  /** How many bridges must end at this island, 1-8. */
  readonly need: number;
}

export interface BridgesPuzzle {
  readonly id: string;
  readonly name?: string;
  readonly difficulty: PuzzleDifficulty;
  readonly rows: number;
  readonly cols: number;
  /** In reading order (row, then column) - an island's index is its id. */
  readonly islands: ReadonlyArray<BridgesIsland>;
  /** The one answer: bridges per link, indexed like `bridgeLinks(puzzle)`. */
  readonly solution: ReadonlyArray<number>;
}

/**
 * Two islands that can see each other across open water - the only places
 * a bridge may go. `a` is always the upper/left island, `b` the one it
 * looks at to the right or below.
 */
export interface BridgeLink {
  readonly index: number;
  readonly a: number;
  readonly b: number;
  readonly horizontal: boolean;
  /** Indexes of the links this one would cross. */
  readonly crosses: ReadonlyArray<number>;
}

export interface BridgesState {
  /** Bridges on each link, 0-2, indexed like `bridgeLinks(puzzle)`. */
  readonly bridges: ReadonlyArray<number>;
}

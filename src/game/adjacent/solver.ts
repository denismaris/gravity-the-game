import { applyTap, cascadeScore, groupAt, hasLegalMove, initialAdjacentState, legalMoves, tileCount } from './logic';
import { AdjacentCell, AdjacentCoord, AdjacentPuzzle, AdjacentState } from './types';

/**
 * Adjacent's answer to the question every other game in this app settles
 * with a real solver: **is this board actually winnable?**
 *
 * It cannot be settled the same way. The other seven games have a unique
 * solution, so their solvers enumerate and count. Here the board has a
 * target score and an enormous number of orderings, most of them bad, and
 * "is there an ordering worth at least N" is - in general - the kind of
 * question you do not get to answer exactly in reasonable time.
 *
 * So this does not try to. It *searches*, and reports the best line it
 * actually found. That asymmetry is the whole point and is what makes it
 * safe to ship on: a line the search found is a line that exists, so a
 * board accepted by `assertValidAdjacent` is provably beatable - the
 * proof is the sequence itself, which the test suite replays move for
 * move rather than taking this module's word for the number. The failure
 * direction is a board wrongly *rejected* as too hard, which costs a
 * regenerated seed and nothing else.
 */

/** A line of play the search actually walked, kept so it can be replayed
 * and independently checked. */
export interface AdjacentLine {
  readonly score: number;
  /** One representative tap per run cleared, in order. */
  readonly taps: ReadonlyArray<AdjacentCoord>;
  /** Whether this line emptied the board outright. */
  readonly cleared: boolean;
  /**
   * How many taps this line needed before its running total first
   * reached the target, or `null` if it never did.
   *
   * The generator rejects boards where this can be very small, and that
   * check earns its place: the first board built without it shipped a
   * medium tray holding a five-tile run worth exactly its 800 target, so
   * the entire puzzle was won by one tap on the opening position. A
   * score target is only a puzzle if reaching it takes a sequence.
   */
  readonly tapsToTarget: number | null;
}

/** What a search found: the highest-scoring line, and the fewest taps any
 * line needed to reach the target. */
export interface AdjacentSearch {
  readonly best: AdjacentLine;
  readonly fewestTapsToTarget: number | null;
}

/** Picks which of the available runs to take next. */
type Strategy = (grid: AdjacentState['grid'], moves: ReadonlyArray<AdjacentCoord>) => AdjacentCoord;

function bySize(grid: AdjacentState['grid'], moves: ReadonlyArray<AdjacentCoord>, largest: boolean): AdjacentCoord {
  let best = moves[0];
  let bestSize = groupAt(grid, best.row, best.col).length;
  for (const move of moves.slice(1)) {
    const size = groupAt(grid, move.row, move.col).length;
    if (largest ? size > bestSize : size < bestSize) {
      best = move;
      bestSize = size;
    }
  }
  return best;
}

/**
 * Plays a board to a standstill under one strategy.
 *
 * Every run is worth strictly more per tile the bigger it is, so there is
 * a real tension the strategies below explore from both ends: taking the
 * biggest run now banks points, but taking the *smallest* first often
 * drops two separated blocks of one colour into each other and sets up
 * something much larger later. Neither dominates, which is exactly why
 * this searches instead of picking one and calling it optimal.
 */
function playout(puzzle: AdjacentPuzzle, strategy: Strategy): AdjacentLine {
  let state = initialAdjacentState(puzzle);
  const taps: AdjacentCoord[] = [];
  let tapsToTarget: number | null = null;

  while (hasLegalMove(state.grid)) {
    const moves = legalMoves(state.grid);
    const choice = strategy(state.grid, moves);
    const move = applyTap(state, choice.row, choice.col);
    // `legalMoves` only ever returns runs of two or more, so `applyTap`
    // cannot refuse one - but a strategy returning something off-board
    // would otherwise loop forever here rather than failing.
    if (!move) break;
    taps.push(choice);
    state = move.state;
    if (tapsToTarget === null && state.score >= puzzle.targetScore) tapsToTarget = taps.length;
  }

  return { score: state.score, taps, cleared: tileCount(state.grid) === 0, tapsToTarget };
}

export interface ValidationOptions extends SearchOptions {
  /**
   * Fewest taps the target is allowed to take. Defaults to 2 - the
   * universal floor, since a board won by a single tap on the opening
   * position is not a puzzle at all. Each tier sets a stricter value of
   * its own (see `MIN_TAPS_TO_TARGET` in `generator.ts`); this default
   * is only the line nothing may cross.
   */
  readonly minTapsToTarget?: number;
}

export interface SearchOptions {
  /** Random playouts to run alongside the two deterministic strategies.
   * Each one is cheap (a board is at most 49 tiles and every tap removes
   * at least two), so this can afford to be generous. */
  readonly attempts?: number;
  /** Injected so the generator can seed it from a puzzle id and the tests
   * can be deterministic - this module owns no randomness of its own. */
  readonly rng?: () => number;
}

const DEFAULT_ATTEMPTS = 120;

/**
 * The best line this search can find for `puzzle`: largest-run-first,
 * smallest-run-first, and a spread of random playouts, keeping whichever
 * scored highest.
 *
 * A board that was cleared outright wins ties over one that merely
 * scored the same, since clearing is the better outcome and the
 * generator uses this to check that claim is achievable at all.
 */
export function searchAdjacent(puzzle: AdjacentPuzzle, options: SearchOptions = {}): AdjacentSearch {
  const { attempts = DEFAULT_ATTEMPTS, rng = Math.random } = options;

  let best = playout(puzzle, (grid, moves) => bySize(grid, moves, true));
  let fewest = best.tapsToTarget;
  const consider = (line: AdjacentLine): void => {
    if (line.score > best.score || (line.score === best.score && line.cleared && !best.cleared)) best = line;
    if (line.tapsToTarget !== null && (fewest === null || line.tapsToTarget < fewest)) fewest = line.tapsToTarget;
  };

  consider(playout(puzzle, (grid, moves) => bySize(grid, moves, false)));
  for (let i = 0; i < attempts; i += 1) {
    consider(playout(puzzle, (_grid, moves) => moves[Math.floor(rng() * moves.length)]));
  }

  return { best, fewestTapsToTarget: fewest };
}

/** The highest-scoring line alone - the common case, and what the tests
 * replay. */
export function searchBestScore(puzzle: AdjacentPuzzle, options: SearchOptions = {}): AdjacentLine {
  return searchAdjacent(puzzle, options).best;
}

/**
 * The most any single clear could possibly be worth from here.
 *
 * A run cannot be larger than the number of tiles sharing its colour, so
 * scoring the most common colour as if every one of its tiles were
 * connected is a true upper bound - loose, but sound, which is the only
 * property that matters for pruning. Anything tighter would need to know
 * the shape of the board after moves that have not been made yet.
 */
function bestSingleClearBound(grid: ReadonlyArray<ReadonlyArray<AdjacentCell>>): number {
  const counts = new Map<number, number>();
  for (const line of grid) {
    for (const cell of line) {
      if (cell === null) continue;
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
  }
  let most = 0;
  for (const count of counts.values()) most = Math.max(most, count);
  return cascadeScore(most);
}

/**
 * Whether the target can be reached in `maxTaps` clears or fewer.
 *
 * **Exhaustive, not sampled** - and that distinction is the whole reason
 * this function exists rather than reusing the random search above. The
 * first version of the "not winnable in one tap" rule asked the sampled
 * search how few taps it had happened to need, which meant the generator
 * and the test suite ran different random streams, found different
 * lines, and disagreed about whether the same shipped board was legal.
 * A heuristic can prove a board *is* fast (it found a fast line); only
 * an exhaustive one can prove it is *not*, which is the direction this
 * rule needs.
 *
 * Affordable because the depth is tiny - no tier asks for more than four
 * - and because two things prune hard: branches are tried largest-run
 * first, so a line that can reach the target usually does so
 * immediately, and any branch whose remaining taps could not close the
 * gap even at `bestSingleClearBound` every time is abandoned.
 */
export function reachesTargetWithin(puzzle: AdjacentPuzzle, maxTaps: number): boolean {
  const walk = (state: AdjacentState, remaining: number): boolean => {
    if (state.score >= puzzle.targetScore) return true;
    if (remaining <= 0) return false;
    if (state.score + remaining * bestSingleClearBound(state.grid) < puzzle.targetScore) return false;

    const moves = [...legalMoves(state.grid)].sort(
      (a, b) => groupAt(state.grid, b.row, b.col).length - groupAt(state.grid, a.row, a.col).length,
    );
    for (const move of moves) {
      const next = applyTap(state, move.row, move.col);
      if (next && walk(next.state, remaining - 1)) return true;
    }
    return false;
  };

  return walk(initialAdjacentState(puzzle), maxTaps);
}

/**
 * Replays a line of taps against a fresh board and returns where it ends
 * up, or `null` if any tap in it is not a legal move at the point it is
 * reached.
 *
 * Exists for the test suite rather than for the app: it is how a claimed
 * score gets checked against the real rules instead of against the search
 * that produced it. A search bug that inflated its own score would
 * otherwise sail through a suite that only ever asks the search.
 */
export function replayLine(puzzle: AdjacentPuzzle, taps: ReadonlyArray<AdjacentCoord>): AdjacentState | null {
  let state = initialAdjacentState(puzzle);
  for (const tap of taps) {
    const move = applyTap(state, tap.row, tap.col);
    if (!move) return null;
    state = move.state;
  }
  return state;
}

/**
 * Structural and fairness validation for one shipped board, thrown rather
 * than returned so a broken puzzle fails loudly at module load or in the
 * pool test, never quietly in front of a player.
 *
 * The last check is the expensive one and the one that matters: it runs
 * the search and refuses any board whose target it could not actually
 * reach.
 */
export function assertValidAdjacent(puzzle: AdjacentPuzzle, options: ValidationOptions = {}): void {
  const { id, size, colors, initial, targetScore } = puzzle;

  if (size < 2) throw new Error(`Adjacent ${id}: size ${size} is too small for a board.`);
  if (colors < 2) throw new Error(`Adjacent ${id}: ${colors} colours cannot make a connectable board.`);
  if (initial.length !== size) throw new Error(`Adjacent ${id}: has ${initial.length} rows, expected ${size}.`);

  for (let row = 0; row < size; row += 1) {
    if (initial[row].length !== size) {
      throw new Error(`Adjacent ${id}: row ${row} has ${initial[row].length} cells, expected ${size}.`);
    }
    for (let col = 0; col < size; col += 1) {
      const cell = initial[row][col];
      if (cell === null) continue;
      if (!Number.isInteger(cell) || cell < 0 || cell >= colors) {
        throw new Error(`Adjacent ${id}: cell ${row},${col} is colour ${cell}, outside the 0-${colors - 1} palette.`);
      }
      // A floating tile would fall the instant the board was touched,
      // which means the board a player is shown is not the board they
      // get - and every `fromRow`/`toRow` the renderer animates would be
      // measured from a position that never really existed.
      if (row + 1 < size && initial[row + 1][col] === null) {
        throw new Error(`Adjacent ${id}: tile ${row},${col} is floating - the board as dealt must already be settled.`);
      }
    }
  }

  if (targetScore <= 0) throw new Error(`Adjacent ${id}: target score ${targetScore} must be positive.`);
  if (!hasLegalMove(initial)) throw new Error(`Adjacent ${id}: has no legal move at all - every tile is isolated.`);

  const best = searchBestScore(puzzle, options);
  if (best.score < targetScore) {
    throw new Error(
      `Adjacent ${id}: target ${targetScore} is unreachable - the best line found scores ${best.score}.`,
    );
  }

  const minTaps = options.minTapsToTarget ?? 2;
  if (reachesTargetWithin(puzzle, minTaps - 1)) {
    throw new Error(
      `Adjacent ${id}: target ${targetScore} falls in fewer than the ${minTaps} taps this board must take.`,
    );
  }
}

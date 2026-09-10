import { StarRating } from './stars';

/**
 * The player's best recorded outcome for a single level.
 *
 * There is no "not completed" variant: the absence of a `LevelResult` for a
 * level id *is* the "never completed" state. Once a `LevelResult` exists,
 * `completed` is always `true`.
 */
export interface LevelResult {
  readonly completed: true;
  /** Best (highest) star rating ever earned on this level. */
  readonly stars: StarRating;
  /** Fewest gravity moves the level has ever been solved in. */
  readonly bestMoves: number;
}

/**
 * Folds a fresh completion into the player's existing best result for that
 * level. Monotonic by design: stars only ever go up, `bestMoves` only ever
 * goes down. Replaying a level and doing worse changes nothing; doing better
 * updates the record. Pure - returns a new object, never mutates `previous`.
 */
export function mergeLevelResult(
  previous: LevelResult | undefined,
  incoming: { stars: StarRating; moves: number },
): LevelResult {
  if (!previous) {
    return { completed: true, stars: incoming.stars, bestMoves: incoming.moves };
  }

  return {
    completed: true,
    stars: (Math.max(previous.stars, incoming.stars) as StarRating),
    bestMoves: Math.min(previous.bestMoves, incoming.moves),
  };
}

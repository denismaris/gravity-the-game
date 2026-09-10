import { StarThresholds } from '../levels/level';

/**
 * Star ratings are 1, 2 or 3. Zero is represented by "no result recorded"
 * (the level has never been completed), never by a `StarRating` of 0.
 */
export type StarRating = 1 | 2 | 3;

/**
 * How many stars a *completed* level is worth for a given move count.
 *
 * Pure and deterministic. Completion alone is always worth one star; the 2nd
 * and 3rd come from beating this level's own `StarThresholds`. Written so it
 * still behaves sensibly if a level's thresholds are ever mis-authored
 * (e.g. `three > two`): more moves can never award more stars.
 */
export function computeStars(moves: number, thresholds: StarThresholds): StarRating {
  if (!Number.isFinite(moves) || moves < 1) {
    // Defensive: a "solved in zero moves" only happens for a level that was
    // already solved at authoring time, which the level suite forbids.
    return 1;
  }

  if (moves <= thresholds.three && moves <= thresholds.two) return 3;
  if (moves <= thresholds.two) return 2;
  return 1;
}

import { GameState, StaticCellType } from './types';

function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Determines whether a puzzle is solved: every movable object must be
 * resting on a target cell, and every target cell must be covered by
 * exactly one movable object (a perfect 1:1 match between objects and
 * targets).
 *
 * This is the single source of truth for puzzle completion. The rendering
 * layer and UI must never re-implement this check themselves - they only
 * ever call this function with the current `GameState`.
 *
 * Pure and deterministic. Guards against common false positives:
 * - A movable sitting next to (but not on) a target does not count.
 * - Having MORE (non-anchored) movables than targets can never be "solved"
 *   (at least one cannot be on a distinct target cell, since objects cannot
 *   overlap).
 * - Having FEWER movables than targets is not solved either, because at
 *   least one target is left uncovered.
 * - A board with zero targets is never considered solved.
 * - Anchored objects are ignored entirely: they never cover a target, and a
 *   normal object still has to reach every target itself.
 * - A destroyed object (see `isPuzzleFailed`) is ignored the same way - it
 *   can never cover a target again, so a puzzle with one is never solved
 *   until the player undoes/restarts past that death.
 */
export function isPuzzleSolved(state: GameState): boolean {
  const targetPositions = new Set<string>();

  state.staticGrid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === StaticCellType.Target) {
        targetPositions.add(positionKey(rowIndex, colIndex));
      }
    });
  });

  if (targetPositions.size === 0) return false;

  const coveredTargets = new Set<string>();

  for (const movable of state.movables) {
    if (movable.anchored || movable.destroyed) continue; // neither fills a target

    const key = positionKey(movable.row, movable.col);

    if (!targetPositions.has(key)) {
      // This movable is not resting on any target cell - can't be solved.
      return false;
    }

    coveredTargets.add(key);
  }

  // Every movable is on *some* target at this point. The puzzle is only
  // solved if every target is covered too - otherwise a level with more
  // targets than movables would incorrectly report as solved.
  return coveredTargets.size === targetPositions.size;
}

/**
 * Whether the puzzle has been lost: at least one object has been destroyed
 * by a hazard (see `applyGravity`). Mutually exclusive with `isPuzzleSolved`
 * - a level always starts with exactly as many objects as targets, so once
 * one is destroyed the rest can never cover every target.
 *
 * The single source of truth for the "you failed" UI, exactly as
 * `isPuzzleSolved` is for "you won" - the rendering/UI layer never inspects
 * `movable.destroyed` directly.
 */
export function isPuzzleFailed(state: GameState): boolean {
  return state.movables.some(movable => movable.destroyed);
}

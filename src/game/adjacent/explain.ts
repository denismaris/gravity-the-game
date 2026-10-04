import { applyTap, groupAt, legalMoves, multiplierFor } from './logic';
import { searchAdjacent } from './solver';
import { AdjacentCoord, AdjacentPuzzle, AdjacentState } from './types';

/**
 * Insight for Adjacent - the one game here with no single right answer, so
 * the hint is a look-ahead rather than a deduction: every tap on the board
 * is tried, the search plays on from each to see how far a good line can
 * still go, and the tap with the best future wins. The explanation says
 * which of the game's three ideas the tap is about - take the big run,
 * clear small to make a big run fall together, or (when the target is out
 * of reach) get as close as possible.
 */
export interface AdjacentHint {
  /** The tap to make - any tile of the recommended group. */
  readonly tap: AdjacentCoord;
  /** Every tile of that group, for the board to light up. */
  readonly group: ReadonlyArray<AdjacentCoord>;
  readonly reason: string;
  readonly tip: string;
}

/** Deterministic, so the same position always gets the same advice. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function explainAdjacentHint(puzzle: AdjacentPuzzle, state: AdjacentState, attempts = 30): AdjacentHint | null {
  const moves = legalMoves(state.grid);
  if (moves.length === 0) return null;
  const remaining = Math.max(0, puzzle.targetScore - state.score);
  const sizes = moves.map(m => groupAt(state.grid, m.row, m.col).length);
  const biggest = Math.max(...sizes);

  let best: { index: number; total: number; reaches: boolean; tapsToTarget: number } | null = null;
  moves.forEach((move, index) => {
    const after = applyTap(state, move.row, move.col);
    if (!after) return;
    const gained = after.gained;
    // Look ahead from the board this tap leaves.
    const rest = searchAdjacent({ ...puzzle, initial: after.state.grid, targetScore: Math.max(1, remaining - gained) }, { attempts, rng: seeded(index + 1) }).best;
    const total = gained + rest.score;
    const reaches = total >= remaining;
    const tapsToTarget = gained >= remaining ? 1 : rest.tapsToTarget === null ? Infinity : rest.tapsToTarget + 1;
    const better =
      !best ||
      (reaches && !best.reaches) ||
      (reaches && best.reaches && (tapsToTarget < best.tapsToTarget || (tapsToTarget === best.tapsToTarget && total > best.total))) ||
      (!reaches && !best.reaches && total > best.total);
    if (better) best = { index, total, reaches, tapsToTarget };
  });
  if (!best) return null;
  const chosen = best as { index: number; total: number; reaches: boolean; tapsToTarget: number };

  const tap = moves[chosen.index];
  const group = groupAt(state.grid, tap.row, tap.col);
  const size = group.length;
  const multiplier = multiplierFor(size);
  const bonus = multiplier > 1 ? `, and a run this big earns \u00d7${multiplier}` : '';

  let reason: string;
  if (!chosen.reaches) {
    reason = `No line from here quite reaches the target, so this is the tap that gets closest: clearing these ${size} first leads to about ${chosen.total} more points. Undo is free if you want to try another way.`;
  } else if (size === biggest) {
    reason = `Clear these ${size}: it is the biggest group on the board${bonus}, and the board it leaves still has a clear line to the target.`;
  } else {
    reason = `Not the biggest group, but clearing these ${size} first lets the tiles above fall together into a bigger run next. Saving the large groups until they grow is how the high scores are made.`;
  }
  return { tap, group, reason, tip: 'Points grow fast with the size of a run. Clear small groups first so big ones fall together, then take them whole.' };
}

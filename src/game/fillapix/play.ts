import { FillaPixCell, FillaPixPuzzle, FillaPixState } from './types';

/**
 * Reveals one cell of the picture, matching `state.filled` up to
 * `puzzle.solution` at the first cell where they disagree. Reads the
 * solution directly rather than re-solving at runtime - `puzzle.solution`
 * is already the one verified-unique answer (see `solver.ts`), so there
 * is nothing left to compute, the same shortcut `revealArukoneHint` takes
 * in `src/game/arukone/play.ts`.
 *
 * Returns `null` once the picture already matches the solution
 * completely - a screen can call this freely without checking first.
 */
export function revealFillaPixHint(state: FillaPixState, puzzle: FillaPixPuzzle): { state: FillaPixState; cell: FillaPixCell } | null {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (state.filled[row][col] !== puzzle.solution[row][col]) {
        const filled = state.filled.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? puzzle.solution[row][col] : v)) : r));
        return { state: { filled }, cell: { row, col } };
      }
    }
  }
  return null;
}

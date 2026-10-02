import { HintReason } from '../hints';
import { isEligible, setMirror, traceBeam } from './logic';
import { solveFewestMirrors, solveMirrorMaze } from './solver';
import { MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState } from './types';

/**
 * A hint that follows the player's own beam. It walks the light from the
 * source through the mirrors as they stand and fixes the first square
 * where it goes astray - so the hint lands exactly where the player's
 * reasoning broke down, not in a corner the beam never reaches.
 */
export function explainMirrorHint(puzzle: MirrorMazePuzzle, state: MirrorMazeState): ({ state: MirrorMazeState; cell: MirrorMazeCell } & HintReason) | null {
  // Toward the answer with the fewest mirrors, keeping the player's own
  // where they fit - never a longer route than the board needs.
  const solution = solveFewestMirrors(puzzle, state) ?? solveMirrorMaze(puzzle, 1, state)[0];
  if (!solution) return null;
  const differs = (r: number, c: number) => isEligible(puzzle, r, c) && state.mirrors[r][c] !== solution.mirrors[r][c];
  const fix = (cell: MirrorMazeCell, kind: HintReason['kind'], reason: string) => ({
    state: setMirror(state, puzzle, cell.row, cell.col, solution.mirrors[cell.row][cell.col]),
    cell,
    kind,
    reason,
  });
  for (const cell of traceBeam(puzzle, state)) {
    if (!differs(cell.row, cell.col)) continue;
    const had = state.mirrors[cell.row][cell.col];
    const wants = solution.mirrors[cell.row][cell.col];
    if (wants === null) return fix(cell, 'fix', 'Follow your beam: it should pass straight through here. This mirror sends it astray.');
    if (had === null) return fix(cell, 'rule', 'Follow your beam: this is where it has to turn to reach the gems and the target.');
    return fix(cell, 'fix', 'Follow your beam: this mirror faces the wrong way. Turn it.');
  }
  // The beam is right as far as it goes; a stray mirror off its path.
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (differs(r, c)) return fix({ row: r, col: c }, 'nudge', solution.mirrors[r][c] === null ? 'The beam never needs a mirror here.' : 'The beam needs a mirror here further along its path.');
    }
  }
  return null;
}

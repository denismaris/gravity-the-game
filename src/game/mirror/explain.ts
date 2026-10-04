import { HintReason, place } from '../hints';

const TIP_FOLLOW = 'Trace the beam with your finger from the source. Each mirror turns it a quarter turn; plan the route through every gem, then to the target.';
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
    tip: TIP_FOLLOW,
  });
  for (const cell of traceBeam(puzzle, state)) {
    if (!differs(cell.row, cell.col)) continue;
    const had = state.mirrors[cell.row][cell.col];
    const wants = solution.mirrors[cell.row][cell.col];
    if (wants === null) return fix(cell, 'fix', `Follow your beam to ${place(cell.row, cell.col)}: it should pass straight through there, but this mirror turns it off course.`);
    if (had === null) return fix(cell, 'rule', `Follow your beam to ${place(cell.row, cell.col)}: this is where it has to turn to collect the gems and still reach the target.`);
    return fix(cell, 'fix', `Follow your beam to ${place(cell.row, cell.col)}: this mirror faces the wrong way and sends the light off course. Flip it.`);
  }
  // The beam is right as far as it goes; a stray mirror off its path.
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (differs(r, c)) return fix({ row: r, col: c }, 'nudge', solution.mirrors[r][c] === null ? `The beam never passes ${place(r, c)}, so the mirror there only gets in the way.` : `Further along its path, the beam needs a mirror at ${place(r, c)}.`);
    }
  }
  return null;
}

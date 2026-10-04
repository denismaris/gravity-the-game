import { count, HintReason, place } from '../hints';
import { pressedCells } from './logic';
import { solveLightsOut } from './solver';
import { LightsOutCell, LightsOutPuzzle, LightsOutState } from './types';

/**
 * A press on the way out from the board as it stands, chosen to do the
 * most good right now: of the presses the remaining solution needs, the
 * one that puts out the most lamps.
 */
export function explainLightsOutHint(puzzle: LightsOutPuzzle, state: LightsOutState): ({ state: LightsOutState; cell: LightsOutCell } & HintReason) | null {
  const solution = solveLightsOut(puzzle, state);
  if (!solution || solution.length === 0) return null;
  const effect = (cell: LightsOutCell) => pressedCells(puzzle.size, cell.row, cell.col).reduce((net, c) => net + (state.lights[c.row][c.col] ? 1 : -1), 0);
  const cell = [...solution].sort((a, b) => effect(b) - effect(a))[0];
  const flipped = new Set(pressedCells(puzzle.size, cell.row, cell.col).map(c => `${c.row}:${c.col}`));
  const net = effect(cell);
  return {
    cell,
    state: { lights: state.lights.map((line, r) => line.map((lit, c) => (flipped.has(`${r}:${c}`) ? !lit : lit))) },
    kind: 'rule',
    reason:
      net > 0
        ? `Press ${place(cell.row, cell.col)}: it flips that lantern and its four neighbours, and puts out ${count(net, 'lantern')} overall. It is one of the presses on the way out, with ${count(solution.length - 1, 'press', 'presses')} to go after it.`
        : `Press ${place(cell.row, cell.col)}: it lights a few lanterns first, but it is on the only way out, with ${count(solution.length - 1, 'press', 'presses')} to go after it.`,
    tip: 'Pressing a lantern twice undoes it, so each one is pressed once or not at all. Clear the board row by row: press under each lit lantern to put it out.',
  };
}

import { LightsOutCell, LightsOutPuzzle, LightsOutState } from './types';

/** The cells a single press actually flips: the pressed cell itself plus
 * its orthogonal neighbours, clipped at the board's edge. Orthogonal
 * only - a diagonal neighbour is untouched, which is the whole shape of
 * this puzzle (and the thing the second tutorial slide exists to say). */
export function pressedCells(size: number, row: number, col: number): ReadonlyArray<LightsOutCell> {
  const candidates = [
    { row, col },
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
  return candidates.filter(cell => cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size);
}

export function initialLightsOutState(puzzle: LightsOutPuzzle): LightsOutState {
  return { lights: puzzle.initial.map(row => row.slice()) };
}

/**
 * The one move this game has. Returns a new state with the pressed cell
 * and its orthogonal neighbours flipped.
 *
 * Worth knowing when reading the rest of this module: a press is its own
 * inverse (pressing twice restores the board), and presses commute with
 * each other, so any solution is a *set* of cells rather than an ordered
 * sequence - which is what makes both the generator (`generator.ts`) and
 * the solver (`solver.ts`) as simple as they are.
 */
export function press(state: LightsOutState, size: number, row: number, col: number): LightsOutState {
  const flipped = new Set(pressedCells(size, row, col).map(cell => `${cell.row}:${cell.col}`));
  return {
    lights: state.lights.map((line, r) => line.map((lit, c) => (flipped.has(`${r}:${c}`) ? !lit : lit))),
  };
}

/** How many lights are still on - the header's own countdown, and the
 * only measure of progress this game has. */
export function litCount(state: LightsOutState): number {
  return state.lights.reduce((total, line) => total + line.filter(Boolean).length, 0);
}

export function isLightsOutSolved(state: LightsOutState): boolean {
  return litCount(state) === 0;
}

import { HintReason } from '../hints';
import { setCell } from './logic';
import { solveTowers } from './solver';
import { TowersCell, TowersPuzzle, TowersState } from './types';

interface Step {
  readonly cell: TowersCell;
  readonly value: number;
  readonly reason: string;
  readonly rank: number;
}

/**
 * A hint that reads the board as it is. A wrong height is set right first
 * (saying what it clashes with); otherwise the simplest thing the clues
 * and the filled heights force - a 1 clue, a full-height clue, the one
 * height a cell has left, the one cell a height has left - preferring the
 * row or column the player is furthest into.
 */
export function explainTowersHint(puzzle: TowersPuzzle, state: TowersState): ({ state: TowersState; cell: TowersCell } & HintReason) | null {
  const [solution] = solveTowers(puzzle, 1);
  if (!solution) return null;
  const n = puzzle.size;
  const v = (r: number, c: number) => state.values[r][c];
  const fullness = (r: number, c: number) => {
    let k = 0;
    for (let i = 0; i < n; i += 1) k += (v(r, i) ? 1 : 0) + (v(i, c) ? 1 : 0);
    return k;
  };

  // 1. A wrong height, in the fullest lines first.
  const wrong: TowersCell[] = [];
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (v(r, c) && v(r, c) !== solution.values[r][c]) wrong.push({ row: r, col: c });
  if (wrong.length > 0) {
    const cell = wrong.sort((a, b) => fullness(b.row, b.col) - fullness(a.row, a.col))[0];
    const h = v(cell.row, cell.col);
    const right = solution.values[cell.row][cell.col];
    const dupRow = state.values[cell.row].filter(x => x === h).length > 1;
    const dupCol = state.values.filter(line => line[cell.col] === h).length > 1;
    return {
      state: setCell(state, cell.row, cell.col, right),
      cell,
      kind: 'fix',
      reason: dupRow || dupCol ? `There's already a ${h} in this ${dupRow ? 'row' : 'column'}. This tower is a ${right}.` : `A ${h} here would break a clue. This tower is a ${right}.`,
    };
  }

  // Candidates: heights not yet in the row or column, and not too tall for
  // a clue to see past (a clue of c allows at most n - c + 1 + d at the
  // d-th tower from its side).
  const allowed = (r: number, c: number): Array<{ h: number; why: 'latin' | 'clue' }> => {
    const out: Array<{ h: number; why: 'latin' | 'clue' }> = [];
    for (let h = 1; h <= n; h += 1) {
      if (state.values[r].includes(h as never) || state.values.some(line => line[c] === h)) continue;
      const caps = [
        [puzzle.leftClues[r], c],
        [puzzle.rightClues[r], n - 1 - c],
        [puzzle.topClues[c], r],
        [puzzle.bottomClues[c], n - 1 - r],
      ];
      const capped = caps.some(([clue, d]) => clue > 0 && h > n - clue + 1 + d);
      out.push({ h, why: capped ? 'clue' : 'latin' });
    }
    return out;
  };

  const steps: Step[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (v(r, c)) continue;
      const want = solution.values[r][c];
      const add = (rank: number, reason: string) => steps.push({ cell: { row: r, col: c }, value: want, rank, reason });
      const sides: Array<[number, number, string]> = [
        [puzzle.leftClues[r], c, 'left'],
        [puzzle.rightClues[r], n - 1 - c, 'right'],
        [puzzle.topClues[c], r, 'top'],
        [puzzle.bottomClues[c], n - 1 - r, 'bottom'],
      ];
      for (const [clue, d, side] of sides) {
        if (clue === 1 && d === 0) add(0, `A 1 clue sees only the first tower, so the one next to it must be the tallest: ${n}.`);
        if (clue === n) add(0, `A ${n} clue (${side}) sees every tower, so they climb 1, 2, 3 in order. This one is ${d + 1}.`);
      }
      const all = allowed(r, c);
      const fitting = all.filter(o => o.why === 'latin');
      if (all.length === 1) add(1, `Every other height is already used in this row or column, so only ${want} is left.`);
      else if (fitting.length === 1) add(2, `The clues rule out every other height here, so only ${want} fits.`);
      // Hidden single: `want` has nowhere else to go in this row/column.
      const rowSpots = Array.from({ length: n }, (_v, i) => i).filter(i => !v(r, i) && allowed(r, i).some(o => o.h === want && o.why === 'latin'));
      const colSpots = Array.from({ length: n }, (_v, i) => i).filter(i => !v(i, c) && allowed(i, c).some(o => o.h === want && o.why === 'latin'));
      if (rowSpots.length === 1) add(2, `${want} has nowhere else to go in this row.`);
      else if (colSpots.length === 1) add(2, `${want} has nowhere else to go in this column.`);
    }
  }
  const step = steps.sort((a, b) => a.rank - b.rank || fullness(b.cell.row, b.cell.col) - fullness(a.cell.row, a.cell.col))[0];
  if (step) return { state: setCell(state, step.cell.row, step.cell.col, step.value), cell: step.cell, kind: 'rule', reason: step.reason };

  // 3. The most hemmed-in empty cell.
  let best: TowersCell | null = null;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (!v(r, c) && (!best || fullness(r, c) > fullness(best.row, best.col))) best = { row: r, col: c };
  if (!best) return null;
  const h = solution.values[best.row][best.col];
  return {
    state: setCell(state, best.row, best.col, h),
    cell: best,
    kind: 'nudge',
    reason: `Count how many towers each clue can see: only a ${h} here makes every clue true.`,
  };
}

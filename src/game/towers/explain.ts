import { HintReason, place } from '../hints';

const TIPS = {
  latin: 'Each height appears exactly once in every row and every column, like a sudoku.',
  one: 'A 1 clue means the very first tower is the tallest, so it hides all the others.',
  full: 'A clue equal to the board size means every tower is visible: they climb 1, 2, 3 ... in order.',
  only: 'When a square has only one height left that its row and column have not used, write it in.',
  hidden: 'Check where each height can still go in a row or column. If there is just one place, it goes there.',
  clue: 'A clue counts towers you can see from its side: a taller tower hides every shorter one behind it.',
};
import { setCell } from './logic';
import { solveTowers } from './solver';
import { TowersCell, TowersPuzzle, TowersState } from './types';

interface Step {
  readonly cell: TowersCell;
  readonly value: number;
  readonly reason: string;
  readonly tip: string;
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
      reason:
        dupRow || dupCol
          ? `${dupRow ? `Row ${cell.row + 1}` : `Column ${cell.col + 1}`} already has a ${h} in it, and each height appears only once per line. The tower at ${place(cell.row, cell.col)} is a ${right}.`
          : `A ${h} at ${place(cell.row, cell.col)} would make a clue see the wrong number of towers. It is a ${right}.`,
      tip: dupRow || dupCol ? TIPS.latin : TIPS.clue,
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
      const add = (rank: number, reason: string, tip: string) => steps.push({ cell: { row: r, col: c }, value: want, rank, reason, tip });
      const sides: Array<[number, number, string]> = [
        [puzzle.leftClues[r], c, 'left'],
        [puzzle.rightClues[r], n - 1 - c, 'right'],
        [puzzle.topClues[c], r, 'top'],
        [puzzle.bottomClues[c], n - 1 - r, 'bottom'],
      ];
      for (const [clue, d, side] of sides) {
        if (clue === 1 && d === 0) add(0, `The 1 clue on the ${side} sees only the first tower, so the tower right next to it (${place(r, c)}) must be the tallest: ${n}.`, TIPS.one);
        if (clue === n) add(0, `The ${n} clue on the ${side} sees every tower, so from that side they climb 1, 2, 3 in order. The tower at ${place(r, c)} is number ${d + 1} from it: a ${d + 1}.`, TIPS.full);
      }
      const all = allowed(r, c);
      const fitting = all.filter(o => o.why === 'latin');
      if (all.length === 1) add(1, `Every other height is already used in row ${r + 1} or column ${c + 1}, so only a ${want} is left for ${place(r, c)}.`, TIPS.only);
      else if (fitting.length === 1) add(2, `Taller towers at ${place(r, c)} would block what its clues need to see, so only a ${want} fits there.`, TIPS.clue);
      // Hidden single: `want` has nowhere else to go in this row/column.
      const rowSpots = Array.from({ length: n }, (_v, i) => i).filter(i => !v(r, i) && allowed(r, i).some(o => o.h === want && o.why === 'latin'));
      const colSpots = Array.from({ length: n }, (_v, i) => i).filter(i => !v(i, c) && allowed(i, c).some(o => o.h === want && o.why === 'latin'));
      if (rowSpots.length === 1) add(2, `Row ${r + 1} still needs a ${want}, and ${place(r, c)} is the only square in it where a ${want} can go.`, TIPS.hidden);
      else if (colSpots.length === 1) add(2, `Column ${c + 1} still needs a ${want}, and ${place(r, c)} is the only square in it where a ${want} can go.`, TIPS.hidden);
    }
  }
  const step = steps.sort((a, b) => a.rank - b.rank || fullness(b.cell.row, b.cell.col) - fullness(a.cell.row, a.cell.col))[0];
  if (step) return { state: setCell(state, step.cell.row, step.cell.col, step.value), cell: step.cell, kind: 'rule', reason: step.reason, tip: step.tip };

  // 3. The most hemmed-in empty cell.
  let best: TowersCell | null = null;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (!v(r, c) && (!best || fullness(r, c) > fullness(best.row, best.col))) best = { row: r, col: c };
  if (!best) return null;
  const h = solution.values[best.row][best.col];
  return {
    state: setCell(state, best.row, best.col, h),
    cell: best,
    kind: 'nudge',
    reason: `Nothing is forced on its own yet, so look at ${place(best.row, best.col)}, the most hemmed-in square: counting what each clue can see, only a ${h} there makes every clue come true.`,
    tip: TIPS.clue,
  };
}

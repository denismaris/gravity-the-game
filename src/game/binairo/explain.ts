import { HintReason } from '../hints';
import { isGiven, setValue } from './logic';
import { solveBinairo } from './solver';
import { BinairoCell, BinairoPuzzle, BinairoState } from './types';

/** 1 is drawn as a circle, 0 as a square (see `BinairoBoardView`). */
const shape = (v: 0 | 1): string => (v === 1 ? 'circle' : 'square');
const shapes = (v: 0 | 1): string => `${shape(v)}s`;

interface Step {
  readonly cell: BinairoCell;
  readonly value: 0 | 1;
  readonly reason: string;
  /** Lower is simpler - the step a player would see first. */
  readonly rank: number;
}

/**
 * A hint that reads the board as it is: it sets right a mistake if there
 * is one (the one in the busiest line first), otherwise it takes the
 * simplest rule the current marks make plain - two alike force the third,
 * a gap between two alike, a badge, a full count - preferring the line
 * the player is furthest into, and says which rule it used.
 */
export function explainBinairoHint(puzzle: BinairoPuzzle, state: BinairoState): ({ state: BinairoState; cell: BinairoCell } & HintReason) | null {
  const [solution] = solveBinairo(puzzle, 1);
  if (!solution) return null;
  const n = puzzle.size;
  const at = (r: number, c: number) => state.values[r]?.[c] ?? null;
  const filledIn = (r: number, c: number) => {
    let k = 0;
    for (let i = 0; i < n; i += 1) {
      if (at(r, i) !== null) k += 1;
      if (at(i, c) !== null) k += 1;
    }
    return k;
  };

  // 1. A mistake: the wrong mark in the fullest lines first.
  const wrong: BinairoCell[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const v = at(r, c);
      if (v !== null && !isGiven(puzzle, r, c) && v !== solution.values[r][c]) wrong.push({ row: r, col: c });
    }
  }
  if (wrong.length > 0) {
    const cell = wrong.sort((a, b) => filledIn(b.row, b.col) - filledIn(a.row, a.col))[0];
    const right = solution.values[cell.row][cell.col] as 0 | 1;
    const v = at(cell.row, cell.col) as 0 | 1;
    const lineCount = (vals: Array<0 | 1 | null>) => vals.filter(x => x === v).length;
    const rowVals = state.values[cell.row].slice() as Array<0 | 1 | null>;
    const colVals = state.values.map(line => line[cell.col]) as Array<0 | 1 | null>;
    const tooMany = lineCount(rowVals) > n / 2 || lineCount(colVals) > n / 2;
    return {
      state: setValue(state, puzzle, cell.row, cell.col, right),
      cell,
      kind: 'fix',
      reason: tooMany
        ? `This line already has too many ${shapes(v)}. This one is a ${shape(right)}.`
        : `A ${shape(v)} here would break a rule a few moves later. It has to be a ${shape(right)}.`,
    };
  }

  // 2. The simplest rule the board shows right now.
  const steps: Step[] = [];
  const lineOf = (r: number, c: number, dr: number) =>
    Array.from({ length: n }, (_v, i) => (dr ? at(i, c) : at(r, i)));
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (at(r, c) !== null) continue;
      const want = solution.values[r][c] as 0 | 1;
      const add = (rank: number, reason: string) => steps.push({ cell: { row: r, col: c }, value: want, rank, reason });
      for (const [dr, dc, word] of [
        [0, 1, 'row'],
        [1, 0, 'column'],
      ] as const) {
        const p1 = at(r - dr, c - dc);
        const p2 = at(r - 2 * dr, c - 2 * dc);
        const n1 = at(r + dr, c + dc);
        const n2 = at(r + 2 * dr, c + 2 * dc);
        if (p1 !== null && p1 === p2 && p1 !== want) add(0, `Two ${shapes(p1)} in a row, and three is not allowed. The next one is a ${shape(want)}.`);
        if (n1 !== null && n1 === n2 && n1 !== want) add(0, `Two ${shapes(n1)} in a row, and three is not allowed. The one before them is a ${shape(want)}.`);
        if (p1 !== null && p1 === n1 && p1 !== want) add(1, `A ${shape(want)} has to sit between two ${shapes(p1)}, or there would be three in a ${word}.`);
        const line = lineOf(r, c, dr);
        const other = (1 - want) as 0 | 1;
        if (line.filter(x => x === other).length === n / 2) add(3, `This ${word} already has all ${n / 2} of its ${shapes(other)}. Every empty square left is a ${shape(want)}.`);
      }
      for (const k of puzzle.constraints ?? []) {
        const partner = k.direction === 'right' ? { row: k.row, col: k.col + 1 } : { row: k.row + 1, col: k.col };
        const mine = k.row === r && k.col === c;
        const theirs = partner.row === r && partner.col === c;
        if (!mine && !theirs) continue;
        const o = mine ? at(partner.row, partner.col) : at(k.row, k.col);
        if (o === null) continue;
        add(2, k.kind === 'same' ? `The = sign means this matches its neighbour, so it's a ${shape(want)}.` : `The × sign means this is the opposite of its neighbour, so it's a ${shape(want)}.`);
      }
    }
  }
  const pick = (list: Step[]) => list.sort((a, b) => a.rank - b.rank || filledIn(b.cell.row, b.cell.col) - filledIn(a.cell.row, a.cell.col))[0];
  const step = steps.length > 0 ? pick(steps) : null;
  if (step) return { state: setValue(state, puzzle, step.cell.row, step.cell.col, step.value), cell: step.cell, kind: 'rule', reason: step.reason };

  // 3. Nothing a single rule settles yet: the most hemmed-in blank.
  let best: BinairoCell | null = null;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (at(r, c) === null && (!best || filledIn(r, c) > filledIn(best.row, best.col))) best = { row: r, col: c };
    }
  }
  if (!best) return null;
  const v = solution.values[best.row][best.col] as 0 | 1;
  return {
    state: setValue(state, puzzle, best.row, best.col, v),
    cell: best,
    kind: 'nudge',
    reason: `Only a ${shape(v)} here lets this row and column both be finished.`,
  };
}

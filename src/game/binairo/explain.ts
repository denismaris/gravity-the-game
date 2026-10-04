import { HintReason, place } from '../hints';
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
  readonly tip: string;
  /** Lower is simpler - the step a player would see first. */
  readonly rank: number;
}

const TIPS = {
  pair: 'Two alike side by side? The squares at both ends are always the other shape.',
  gap: 'A gap between two alike is always the other shape.',
  count: 'Every row and column holds the same number of circles and squares. Once a line has half of one, the rest is the other.',
  sign: '= means the two squares match, × means they differ. Use them to carry a shape from one square to the next.',
  fix: 'One early mistake blocks everything after it. When a line feels stuck, check your last few marks.',
  nudge: 'When nothing is forced, try a shape in your head and follow it. If it leads to three in a row or an uneven line, it is the other shape.',
};

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
    const line = lineCount(rowVals) > n / 2 ? `Row ${cell.row + 1}` : `Column ${cell.col + 1}`;
    return {
      state: setValue(state, puzzle, cell.row, cell.col, right),
      cell,
      kind: 'fix',
      reason: tooMany
        ? `${line} already has more than ${n / 2} ${shapes(v)}, and every line must be split evenly. So the square at ${place(cell.row, cell.col)} is a ${shape(right)}.`
        : `The ${shape(v)} at ${place(cell.row, cell.col)} can't stay: a few moves later it forces three in a row or an uneven line. It has to be a ${shape(right)}.`,
      tip: tooMany ? TIPS.count : TIPS.fix,
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
      const add = (rank: number, reason: string, tip: string) => steps.push({ cell: { row: r, col: c }, value: want, rank, reason, tip });
      const lineName = (word: string) => (word === 'row' ? `row ${r + 1}` : `column ${c + 1}`);
      for (const [dr, dc, word] of [
        [0, 1, 'row'],
        [1, 0, 'column'],
      ] as const) {
        const p1 = at(r - dr, c - dc);
        const p2 = at(r - 2 * dr, c - 2 * dc);
        const n1 = at(r + dr, c + dc);
        const n2 = at(r + 2 * dr, c + 2 * dc);
        if (p1 !== null && p1 === p2 && p1 !== want)
          add(0, `In ${lineName(word)} there are two ${shapes(p1)} side by side. A third would make three in a row, which is not allowed, so the square right after them (${place(r, c)}) is a ${shape(want)}.`, TIPS.pair);
        if (n1 !== null && n1 === n2 && n1 !== want)
          add(0, `In ${lineName(word)} there are two ${shapes(n1)} side by side. A third would make three in a row, so the square just before them (${place(r, c)}) is a ${shape(want)}.`, TIPS.pair);
        if (p1 !== null && p1 === n1 && p1 !== want)
          add(1, `The square at ${place(r, c)} sits between two ${shapes(p1)} in its ${word}. Another ${shape(p1)} there would make three in a row, so it is a ${shape(want)}.`, TIPS.gap);
        const line = lineOf(r, c, dr);
        const other = (1 - want) as 0 | 1;
        if (line.filter(x => x === other).length === n / 2)
          add(3, `${lineName(word).replace(/^./, ch => ch.toUpperCase())} already has all ${n / 2} of its ${shapes(other)}, and a line holds no more than half of one shape. So every empty square left in it is a ${shape(want)}, starting with this one.`, TIPS.count);
      }
      for (const k of puzzle.constraints ?? []) {
        const partner = k.direction === 'right' ? { row: k.row, col: k.col + 1 } : { row: k.row + 1, col: k.col };
        const mine = k.row === r && k.col === c;
        const theirs = partner.row === r && partner.col === c;
        if (!mine && !theirs) continue;
        const o = mine ? at(partner.row, partner.col) : at(k.row, k.col);
        if (o === null) continue;
        add(
          2,
          k.kind === 'same'
            ? `The = sign between ${place(r, c)} and its neighbour means they match. Its neighbour is a ${shape(o as 0 | 1)}, so this is a ${shape(want)} too.`
            : `The × sign between ${place(r, c)} and its neighbour means they differ. Its neighbour is a ${shape(o as 0 | 1)}, so this is a ${shape(want)}.`,
          TIPS.sign,
        );
      }
    }
  }
  const pick = (list: Step[]) => list.sort((a, b) => a.rank - b.rank || filledIn(b.cell.row, b.cell.col) - filledIn(a.cell.row, a.cell.col))[0];
  const step = steps.length > 0 ? pick(steps) : null;
  if (step) return { state: setValue(state, puzzle, step.cell.row, step.cell.col, step.value), cell: step.cell, kind: 'rule', reason: step.reason, tip: step.tip };

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
    reason: `No single rule settles a square yet, so here is the most hemmed-in one: at ${place(best.row, best.col)}, only a ${shape(v)} lets both its row and its column be finished without three in a row or an uneven line.`,
    tip: TIPS.nudge,
  };
}

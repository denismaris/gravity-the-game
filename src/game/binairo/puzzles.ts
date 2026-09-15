import { BinairoPuzzle, BinairoValue } from './types';

type FullGrid = ReadonlyArray<ReadonlyArray<0 | 1>>;

/**
 * Builds a full NxN solution grid from one base row by cyclically rotating
 * it once per row: `row[r][c] = base[(c + r) mod N]`. This is more than a
 * convenient shorthand - for any `base` whose *circular* windows (wrapping
 * included) never have three equal values in a row, every rotation is
 * independently guaranteed to have no triple too (each rotation's linear
 * windows are just a subset of the base's circular ones), and column `c`
 * of the result is itself exactly rotation `-c` of the same base - so
 * columns are guaranteed valid and mutually distinct by the same
 * argument, for free. Hand-verified once per base below, not per grid.
 */
function rotateGrid(base: ReadonlyArray<0 | 1>): FullGrid {
  const n = base.length;
  return Array.from({ length: n }, (_row, r) => Array.from({ length: n }, (_col, c) => base[(c + r) % n]));
}

/** 0<->1 everywhere - preserves triple-freedom, balance and distinctness
 * (a bijection on values can't create or remove a run or a duplicate). */
function swapValues(source: FullGrid): FullGrid {
  return source.map(row => row.map((v): 0 | 1 => (v === 0 ? 1 : 0)));
}

/** Reverses every row left-to-right - preserves triple-freedom and balance
 * within each row (a run or a count doesn't care about direction), and
 * leaves every column's own top-to-bottom sequence untouched (only its
 * index shifts), so columns stay valid and distinct too. */
function reflectHorizontal(source: FullGrid): FullGrid {
  return source.map(row => [...row].reverse());
}

// Each base sequence was hand-checked once, *circularly* (including the
// wrap-around windows), for balance and triple-freedom - see `rotateGrid`'s
// comment for why that single check is enough to guarantee every rotation
// (used as a row) and every resulting column are simultaneously valid.
const BASE_6: ReadonlyArray<0 | 1> = [0, 0, 1, 1, 0, 1];
const BASE_8: ReadonlyArray<0 | 1> = [0, 0, 1, 0, 1, 1, 0, 1];
const BASE_10: ReadonlyArray<0 | 1> = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1];

const GRID_6 = rotateGrid(BASE_6);
const GRID_8 = rotateGrid(BASE_8);
const GRID_10 = rotateGrid(BASE_10);

// A second, independently-checked 10-wide base - same circular-triple-free,
// 5/5-balanced bar as BASE_10 above - so the two constraint-tile puzzles
// below (binairo-011/012) don't just recolor a transform every earlier
// 10x10 already used.
const BASE_10_ALT: ReadonlyArray<0 | 1> = [0, 1, 0, 1, 1, 0, 0, 1, 1, 0];
const GRID_10_ALT = rotateGrid(BASE_10_ALT);

// A fresh, independently-checked 6-wide base for binairo-013 (the first
// twin-cell puzzle) - same circular-triple-free, 3/3-balanced bar as
// every other base above, so it doesn't just recolor a transform of
// BASE_6 (already used four ways by binairo-001..004).
const BASE_6_ALT: ReadonlyArray<0 | 1> = [0, 1, 0, 0, 1, 1];
const GRID_6_ALT = rotateGrid(BASE_6_ALT);

function grid(rows: ReadonlyArray<ReadonlyArray<BinairoValue>>): ReadonlyArray<ReadonlyArray<BinairoValue>> {
  return rows;
}

/**
 * The solution grid each puzzle below's `givens` was stripped from, in the
 * same order as `BINAIRO` - exported so the test suite can check every
 * given cell actually matches its solution grid at that position, a real
 * regression test against a transcription slip between the authoring
 * script's output and the literal arrays below, not just documentation.
 */
export const BINAIRO_SOLUTION_GRIDS: ReadonlyArray<FullGrid> = [
  GRID_6,
  swapValues(GRID_6),
  reflectHorizontal(GRID_6),
  swapValues(reflectHorizontal(GRID_6)),
  GRID_8,
  swapValues(GRID_8),
  reflectHorizontal(GRID_8),
  GRID_10,
  swapValues(GRID_10),
  reflectHorizontal(GRID_10),
  swapValues(reflectHorizontal(GRID_10)),
  reflectHorizontal(swapValues(GRID_10_ALT)),
  GRID_6_ALT,
];

/**
 * Every puzzle's `givens` below were authored by *stripping*, not by a
 * formula: starting from the full solution grid, cells were removed one
 * at a time in a scattered order, re-solving with the real (constraint
 * -propagating) solver (`solveBinairo(puzzle, 2)`, `constraints` already
 * active throughout) after *every single removal*, putting a cell back
 * the moment removing it stopped leaving a unique solution - the same
 * solve-strip-verify method already proven on this app's other
 * hand-authored puzzle sets, not a pattern assumed to generalize.
 *
 * Every puzzle now carries a handful of `=`/`x` constraint tiles - not
 * just a harder tier at the end - so the mechanic is part of the ramp
 * itself: 2-3 markers on the 6x6s, 3-4 on the 8x8s, 4-5 on the 10x10s,
 * each `kind` derived directly from that puzzle's own solution grid
 * (never hand-guessed). Blank fraction climbs with difficulty for the
 * same reason it always did - a 10x10 leans harder on the ruleset than a
 * 6x6 does - but now leans further still, since the constraints carry
 * some of that deductive weight themselves: every single puzzle below
 * reached its *full* target (47-62% blank, versus 42-54% before
 * constraints existed at all) without the stripper hitting an ambiguity
 * wall anywhere. `assertValidBinairo` re-verifies uniqueness again
 * independently in the test suite, so this comment is provenance, not
 * the only proof.
 *
 * `binairo-013` appends the first puzzle using `twinCells` - deliberately
 * on its own, no `constraints` alongside it, so a player meets the new
 * mechanic in isolation before any puzzle asks them to juggle it together
 * with `=`/`x` badges. Stripped the same solve-strip-verify way, but with
 * one extra bar the others don't need to clear: the twin pair has to be
 * load-bearing, not decorative - stripping stopped only once removing
 * `twinCells` from the same givens actually broke uniqueness (verified:
 * 2 solutions without it, exactly 1 with it), proof the mechanic is doing
 * real work here rather than just sitting on an already-determined cell.
 * (Its name coincides with `binairo-002`'s "Twin Ranks," authored years
 * before this mechanic existed - that one has no twin cells at all, pure
 * flavor text; worth a future rename if it ever reads as confusing.)
 */
export const BINAIRO: ReadonlyArray<BinairoPuzzle> = [
  {
    id: 'binairo-001',
    name: 'Even Split',
    size: 6,
    givens: grid([
      [null, 0, null, null, null, null],
      [0, null, null, 0, 1, null],
      [1, null, null, null, 0, null],
      [null, 0, null, 0, 0, 1],
      [0, 1, 0, null, 1, 1],
      [1, 0, null, null, 1, 0],
    ]),
    constraints: [
      { row: 0, col: 3, direction: 'right', kind: 'different' },
      { row: 2, col: 4, direction: 'right', kind: 'same' },
    ],
  },
  {
    id: 'binairo-002',
    name: 'Twin Ranks',
    size: 6,
    givens: grid([
      [null, 1, 0, null, 1, null],
      [1, null, 0, null, null, 1],
      [null, null, null, 0, null, null],
      [null, 1, 0, 1, null, 0],
      [1, 0, null, 1, 0, null],
      [0, null, 1, null, 0, 1],
    ]),
    constraints: [
      { row: 3, col: 4, direction: 'down', kind: 'different' },
      { row: 2, col: 5, direction: 'down', kind: 'different' },
    ],
  },
  {
    id: 'binairo-003',
    name: 'Mirror Rows',
    size: 6,
    givens: grid([
      [null, null, 1, null, 0, null],
      [0, 1, 0, null, null, null],
      [0, null, 1, null, null, 1],
      [1, 0, 0, 1, 0, null],
      [1, 1, 0, null, 1, null],
      [null, null, null, null, null, 1],
    ]),
    constraints: [
      { row: 3, col: 0, direction: 'down', kind: 'same' },
      { row: 4, col: 1, direction: 'down', kind: 'same' },
      { row: 1, col: 0, direction: 'down', kind: 'same' },
    ],
  },
  {
    id: 'binairo-004',
    name: 'Balanced Six',
    size: 6,
    givens: grid([
      [null, 1, 0, 0, null, 1],
      [1, 0, null, null, null, null],
      [1, 1, null, null, null, 0],
      [null, 1, null, null, 1, null],
      [null, null, 1, null, null, 1],
      [null, 0, 0, 1, 1, 0],
    ]),
    constraints: [
      { row: 2, col: 3, direction: 'down', kind: 'different' },
      { row: 2, col: 1, direction: 'down', kind: 'same' },
      { row: 0, col: 4, direction: 'down', kind: 'different' },
    ],
  },
  {
    id: 'binairo-005',
    name: 'Wide Grid',
    size: 8,
    givens: grid([
      [null, null, 1, null, null, null, 0, null],
      [null, null, null, 1, null, null, null, 0],
      [null, null, 1, null, 0, 1, null, 0],
      [null, 1, null, 0, null, null, 0, null],
      [null, null, null, 1, 0, 0, 1, 0],
      [null, 0, null, null, 0, null, 0, null],
      [0, 1, null, null, 1, 0, 1, 1],
      [1, 0, 0, null, 0, null, 1, 0],
    ]),
    constraints: [
      { row: 6, col: 7, direction: 'down', kind: 'different' },
      { row: 7, col: 4, direction: 'right', kind: 'different' },
      { row: 6, col: 3, direction: 'right', kind: 'different' },
    ],
  },
  {
    id: 'binairo-006',
    name: 'Counterpoint',
    size: 8,
    givens: grid([
      [1, null, 0, null, 0, null, 1, 0],
      [1, 0, null, 0, null, null, null, null],
      [null, null, null, 0, 1, 0, null, null],
      [1, null, null, null, 0, 1, null, null],
      [null, null, 1, null, null, 1, 0, 1],
      [0, null, 0, null, null, 0, null, 0],
      [1, null, null, 1, null, null, 0, 0],
      [null, null, 1, 0, null, null, 0, null],
    ]),
    constraints: [
      { row: 7, col: 6, direction: 'right', kind: 'different' },
      { row: 0, col: 1, direction: 'down', kind: 'different' },
      { row: 5, col: 1, direction: 'down', kind: 'different' },
    ],
  },
  {
    id: 'binairo-007',
    name: 'Reflected Eight',
    size: 8,
    givens: grid([
      [1, null, null, null, null, null, null, null],
      [null, 1, 0, 1, 1, null, null, null],
      [0, null, 1, 0, 1, null, 0, null],
      [1, null, 0, 1, null, null, 1, 0],
      [0, null, 0, 0, 1, null, null, 1],
      [null, null, null, null, null, null, 0, 1],
      [1, null, 0, null, null, 0, 1, null],
      [null, 1, null, null, 1, null, null, 1],
    ]),
    constraints: [
      { row: 5, col: 2, direction: 'down', kind: 'different' },
      { row: 3, col: 4, direction: 'right', kind: 'different' },
      { row: 3, col: 1, direction: 'down', kind: 'different' },
      { row: 6, col: 5, direction: 'right', kind: 'different' },
    ],
  },
  {
    id: 'binairo-008',
    name: 'Grand Grid',
    size: 10,
    givens: grid([
      [null, null, 1, null, 1, null, 0, null, null, 1],
      [null, null, 0, null, 1, null, null, 1, null, 0],
      [1, 0, null, null, 0, 0, null, null, 0, null],
      [0, null, null, null, null, 1, 1, null, null, 1],
      [1, null, null, 0, 1, null, null, 0, 1, null],
      [null, 0, 0, null, null, null, 0, 1, null, 1],
      [0, 0, null, null, 0, null, null, null, 1, null],
      [null, 1, 1, null, null, null, null, null, 1, null],
      [null, null, 0, null, null, null, null, 1, 0, 0],
      [null, 0, null, 1, 0, 1, 1, null, 0, null],
    ]),
    constraints: [
      { row: 1, col: 3, direction: 'right', kind: 'same' },
      { row: 0, col: 6, direction: 'right', kind: 'same' },
      { row: 6, col: 0, direction: 'right', kind: 'same' },
      { row: 6, col: 4, direction: 'down', kind: 'same' },
    ],
  },
  {
    id: 'binairo-009',
    name: 'Full Balance',
    size: 10,
    givens: grid([
      [1, null, 0, null, 0, null, null, null, 0, null],
      [null, null, 1, 0, 0, 1, null, 0, 0, 1],
      [null, null, 0, null, null, null, null, null, 1, null],
      [null, 0, 0, 1, null, null, 0, 1, 1, null],
      [0, null, 1, 1, null, 0, 1, null, null, null],
      [null, 1, null, 0, null, null, 1, null, null, 0],
      [1, null, 0, null, null, 1, null, null, 0, null],
      [null, null, 0, 1, null, null, null, null, null, null],
      [null, 0, null, 1, null, 1, 0, null, 1, 1],
      [null, null, 1, null, 1, null, null, null, 1, 0],
    ]),
    constraints: [
      { row: 6, col: 2, direction: 'down', kind: 'same' },
      { row: 2, col: 0, direction: 'down', kind: 'different' },
      { row: 3, col: 8, direction: 'right', kind: 'different' },
      { row: 7, col: 2, direction: 'right', kind: 'different' },
    ],
  },
  {
    id: 'binairo-010',
    name: 'Final Split',
    size: 10,
    givens: grid([
      [1, null, 0, 0, null, null, null, null, null, null],
      [null, 1, 1, 0, null, 1, 1, 0, null, null],
      [0, null, null, 1, 0, 0, null, 1, null, null],
      [null, null, null, 1, null, null, 0, null, 1, 0],
      [0, null, 0, null, null, 1, null, null, 1, null],
      [null, null, 1, null, null, 1, null, 0, 0, null],
      [1, 1, 0, null, null, null, null, 1, null, 0],
      [0, null, null, null, 1, null, null, null, 1, 0],
      [null, null, 1, 1, 0, null, 0, null, null, null],
      [null, null, null, null, null, 0, null, 0, 0, null],
    ]),
    constraints: [
      { row: 3, col: 6, direction: 'right', kind: 'different' },
      { row: 8, col: 2, direction: 'down', kind: 'different' },
      { row: 1, col: 2, direction: 'right', kind: 'different' },
      { row: 0, col: 7, direction: 'right', kind: 'different' },
    ],
  },
  {
    id: 'binairo-011',
    name: 'Crossed Signals',
    size: 10,
    givens: grid([
      [0, null, null, null, 0, null, null, null, null, null],
      [1, null, null, 1, null, 0, null, 1, null, null],
      [null, null, 0, 0, 1, 1, null, null, null, 0],
      [null, 1, null, 0, 0, 1, null, 0, 0, 1],
      [null, 0, null, null, 0, 0, null, null, 0, null],
      [0, null, null, null, null, null, null, 1, 1, null],
      [null, null, 1, null, null, null, 0, null, null, 1],
      [null, null, null, 1, null, 1, null, 0, 0, 1],
      [null, null, null, 0, null, 0, null, 1, null, null],
      [null, null, 1, null, 0, null, 0, null, null, 0],
    ]),
    constraints: [
      { row: 6, col: 3, direction: 'right', kind: 'different' },
      { row: 1, col: 4, direction: 'down', kind: 'same' },
      { row: 4, col: 8, direction: 'down', kind: 'different' },
      { row: 4, col: 3, direction: 'right', kind: 'different' },
      { row: 8, col: 5, direction: 'down', kind: 'different' },
    ],
  },
  {
    id: 'binairo-012',
    name: 'Final Signal',
    size: 10,
    givens: grid([
      [null, 0, null, null, null, null, null, 1, null, null],
      [null, null, null, null, 1, 1, null, 0, 1, null],
      [0, null, null, null, null, null, 1, null, 0, null],
      [null, 0, 1, 1, 0, null, null, 1, null, null],
      [null, 1, null, 1, null, null, 0, 1, null, 0],
      [0, 0, null, null, null, null, 0, null, null, 1],
      [null, null, 0, null, null, 1, null, null, 0, null],
      [null, null, 0, null, null, 0, null, null, 0, null],
      [null, null, 1, null, null, 1, 0, 1, null, 0],
      [0, null, null, null, 0, null, null, 0, null, 1],
    ]),
    constraints: [
      { row: 8, col: 7, direction: 'down', kind: 'different' },
      { row: 5, col: 2, direction: 'right', kind: 'different' },
      { row: 1, col: 7, direction: 'right', kind: 'different' },
      { row: 6, col: 6, direction: 'down', kind: 'same' },
      { row: 1, col: 5, direction: 'right', kind: 'different' },
    ],
  },
  {
    id: 'binairo-013',
    name: 'Across the Center',
    size: 6,
    givens: grid([
      [null, null, 0, null, 1, null],
      [null, null, 0, 1, null, null],
      [null, null, 1, null, 0, null],
      [0, 1, null, 0, null, null],
      [null, 1, 0, 1, null, null],
      [null, 0, null, 0, 0, null],
    ]),
    twinCells: [{ row: 1, col: 1 }],
  },
];

export function getBinairoById(id: string): BinairoPuzzle | undefined {
  return BINAIRO.find(puzzle => puzzle.id === id);
}

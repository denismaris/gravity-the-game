import { PuzzleDifficulty } from '../puzzleDifficulty';
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

// binairo-014 (the first count-clue puzzle). Written out in full rather
// than built from a rotated base like every grid above: this one came out
// of the solver on an empty board during authoring, and it is genuinely
// not a rotation - which is the point, since a rotation grid has a very
// regular neighbourhood structure and would make the neighbour counts far
// more guessable than they should be. Each of the three clue counts was
// re-derived from this grid by hand before being frozen.
const GRID_6_COUNT: FullGrid = [
  [0, 0, 1, 0, 1, 1],
  [0, 0, 1, 1, 0, 1],
  [1, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 0],
  [1, 1, 0, 1, 0, 0],
];

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
  GRID_6_COUNT,
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
 * some of that deductive weight themselves.
 *
 * The pool was later *eased*: blanks came back down to 13 on the 6x6s, 27
 * on the 8x8s and 46 on the 10x10s (from as high as 62). Boards this
 * sparse were technically fair - every one had a unique solution reachable
 * by pure propagation - but "solvable without guessing" is not the same as
 * "enjoyable", and these were reading as work. Givens were restored by
 * putting back whichever blank sat furthest from any existing given, so
 * support spread evenly instead of clumping. Restoring a cell to its own
 * solution value cannot introduce ambiguity, but uniqueness was re-proven
 * with the real solver for all fourteen anyway rather than argued.
 * `assertValidBinairo` re-verifies it again in the test suite, so this
 * comment is provenance, not the only proof.
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
 *
 * Difficulty (see `PuzzleDifficulty`'s comment in `types.ts`): the four 6x6s
 * are easy, the three 8x8s are medium, the five 10x10s are hard - except
 * #013, which despite reusing a 6x6 board is tagged medium, not easy: it
 * exists purely to teach `twinCells` in isolation, and the real complexity
 * that mechanic adds isn't reflected in its board size.
 */
export const BINAIRO: ReadonlyArray<BinairoPuzzle> = [
  {
    id: 'binairo-001',
    difficulty: 'easy',
    name: 'Even Split',
    size: 6,
    givens: grid([
      [0, 0, 1, 1, 0, null],
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
    difficulty: 'easy',
    name: 'Twin Ranks',
    size: 6,
    givens: grid([
      [1, 1, 0, 0, 1, 0],
      [1, 0, 0, null, null, 1],
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
    difficulty: 'easy',
    name: 'Mirror Rows',
    size: 6,
    givens: grid([
      [1, 0, 1, 1, 0, 0],
      [0, 1, 0, 1, null, null],
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
    difficulty: 'easy',
    name: 'Balanced Six',
    size: 6,
    givens: grid([
      [0, 1, 0, 0, 1, 1],
      [1, 0, 1, 0, 0, null],
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
    difficulty: 'medium',
    name: 'Wide Grid',
    size: 8,
    givens: grid([
      [0, 0, 1, 0, 1, 1, 0, 1],
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
    difficulty: 'medium',
    name: 'Counterpoint',
    size: 8,
    givens: grid([
      [1, 1, 0, 1, 0, 0, 1, 0],
      [1, 0, 1, 0, 0, 1, 0, null],
      [null, null, null, 0, 1, 0, null, 1],
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
    difficulty: 'medium',
    name: 'Reflected Eight',
    size: 8,
    givens: grid([
      [1, 0, 1, 1, 0, 1, 0, 0],
      [0, 1, 0, 1, 1, null, null, null],
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
    difficulty: 'hard',
    name: 'Grand Grid',
    size: 10,
    givens: grid([
      [0, 0, 1, 0, 1, 1, 0, 0, 1, 1],
      [0, 1, 0, 1, 1, 0, null, 1, null, 0],
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
    difficulty: 'hard',
    name: 'Full Balance',
    size: 10,
    givens: grid([
      [1, 1, 0, 1, 0, 0, 1, 1, 0, 0],
      [1, 0, 1, 0, 0, 1, 1, 0, 0, 1],
      [0, null, 0, null, null, null, null, null, 1, null],
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
    difficulty: 'hard',
    name: 'Final Split',
    size: 10,
    givens: grid([
      [1, 1, 0, 0, 1, 1, 0, 1, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
      [0, null, null, 1, 0, 0, null, 1, null, null],
      [null, null, null, 1, null, null, 0, null, 1, 0],
      [0, null, 0, null, null, 1, null, null, 1, null],
      [null, null, 1, null, null, 1, null, 0, 0, null],
      [1, 1, 0, null, null, null, null, 1, null, 0],
      [0, null, null, null, 1, null, null, null, 1, 0],
      [null, null, 1, 1, 0, null, 0, null, null, null],
      [1, null, null, null, null, 0, null, 0, 0, null],
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
    difficulty: 'hard',
    name: 'Crossed Signals',
    size: 10,
    givens: grid([
      [0, 0, 1, 1, 0, 0, 1, 0, 1, 1],
      [1, 0, 0, 1, 1, 0, 0, 1, null, null],
      [null, null, 0, 0, 1, 1, null, null, null, 0],
      [null, 1, null, 0, 0, 1, null, 0, 0, 1],
      [null, 0, null, null, 0, 0, null, null, 0, null],
      [0, null, null, null, null, null, null, 1, 1, null],
      [null, null, 1, null, null, null, 0, null, null, 1],
      [1, null, null, 1, null, 1, null, 0, 0, 1],
      [null, null, null, 0, null, 0, null, 1, null, null],
      [0, null, 1, null, 0, null, 0, null, null, 0],
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
    difficulty: 'hard',
    name: 'Final Signal',
    size: 10,
    givens: grid([
      [1, 0, 0, 1, 1, 0, 0, 1, 0, 1],
      [1, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      [0, 1, null, null, null, null, 1, null, 0, null],
      [null, 0, 1, 1, 0, null, null, 1, null, null],
      [null, 1, null, 1, null, null, 0, 1, null, 0],
      [0, 0, null, null, null, null, 0, null, null, 1],
      [null, null, 0, null, null, 1, null, null, 0, null],
      [1, null, 0, null, null, 0, null, null, 0, null],
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
    difficulty: 'medium',
    name: 'Across the Center',
    size: 6,
    givens: grid([
      [0, 1, 0, 0, 1, 1],
      [1, 0, 0, 1, 1, 0],
      [null, null, 1, null, 0, null],
      [0, 1, null, 0, null, null],
      [null, 1, 0, 1, null, null],
      [null, 0, null, 0, 0, null],
    ]),
    twinCells: [{ row: 1, col: 1 }],
  },
  {
    id: 'binairo-014',
    difficulty: 'medium',
    name: 'Look Around',
    size: 6,
    // Count clues in isolation - no `=`/`x` badges, no twins - the same
    // teach-one-thing shape `binairo-013` uses for twin cells, and tagged
    // by real complexity rather than its position in the ramp.
    //
    // Deliberately down to five givens: with the board this bare the three
    // clues are doing most of the deductive work, which is the point of an
    // introduction puzzle. Every clue sits on an interior cell with 3-4
    // still-blank neighbours, so none of them merely restates what the
    // givens already show (see `countClueOpenNeighbours`).
    givens: grid([
      [0, null, null, null, null, 1],
      [null, null, 1, null, 0, null],
      [1, null, null, null, null, null],
      [null, null, 0, null, 1, 1],
      [null, null, null, null, null, null],
      [1, null, 0, null, null, null],
    ]),
    countClues: [
      { row: 1, col: 2, count: 2 },
      { row: 1, col: 4, count: 4 },
      { row: 3, col: 4, count: 2 },
    ],
  },
];

export function getBinairoById(id: string): BinairoPuzzle | undefined {
  return BINAIRO.find(puzzle => puzzle.id === id);
}

export function getBinairoByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BinairoPuzzle> {
  return BINAIRO.filter(puzzle => puzzle.difficulty === difficulty);
}

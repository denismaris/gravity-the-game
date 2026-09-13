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
function swapValues(grid: FullGrid): FullGrid {
  return grid.map(row => row.map((v): 0 | 1 => (v === 0 ? 1 : 0)));
}

/** Reverses every row left-to-right - preserves triple-freedom and balance
 * within each row (a run or a count doesn't care about direction), and
 * leaves every column's own top-to-bottom sequence untouched (only its
 * index shifts), so columns stay valid and distinct too. */
function reflectHorizontal(grid: FullGrid): FullGrid {
  return grid.map(row => [...row].reverse());
}

/**
 * Blanks a scattered ~1/5 of `grid`'s cells, keeping the rest as givens.
 * Deliberately *not* a checkerboard: since every row here is a rotation of
 * the same base sequence, `(r + c) mod 2` and the base index `(r + c) mod
 * N` share the same parity whenever `N` is even (reducing an integer mod
 * an even number never changes its own parity) - so a checkerboard mask
 * would only ever reveal cells for *one* parity of base index, never the
 * other, no matter which cells within that parity class it picked. The
 * mask below keys on `3r + 2c`, which has no such alignment with `r + c`,
 * so it reveals cells across every base index instead. Whether *this
 * specific* kept subset still pins down a unique solution is verified by
 * the real solver in the test suite, not assumed here.
 */
function sparseGivens(grid: FullGrid, offset: number): ReadonlyArray<ReadonlyArray<BinairoValue>> {
  return grid.map((row, r) => row.map((v, c): BinairoValue => ((3 * r + 2 * c + offset) % 5 === 0 ? null : v)));
}

function fromGrid(id: string, name: string, grid: FullGrid, offset = 0): BinairoPuzzle {
  return { id, name, size: grid.length, givens: sparseGivens(grid, offset) };
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

export const BINAIRO: ReadonlyArray<BinairoPuzzle> = [
  fromGrid('binairo-001', 'Even Split', GRID_6, 0),
  fromGrid('binairo-002', 'Twin Ranks', swapValues(GRID_6), 1),
  fromGrid('binairo-003', 'Mirror Rows', reflectHorizontal(GRID_6), 2),
  fromGrid('binairo-004', 'Balanced Six', swapValues(reflectHorizontal(GRID_6)), 3),
  fromGrid('binairo-005', 'Wide Grid', GRID_8, 0),
  fromGrid('binairo-006', 'Counterpoint', swapValues(GRID_8), 1),
  fromGrid('binairo-007', 'Reflected Eight', reflectHorizontal(GRID_8), 2),
  fromGrid('binairo-008', 'Grand Grid', GRID_10, 0),
  fromGrid('binairo-009', 'Full Balance', swapValues(GRID_10), 1),
  fromGrid('binairo-010', 'Final Split', reflectHorizontal(GRID_10), 2),
];

export function getBinairoById(id: string): BinairoPuzzle | undefined {
  return BINAIRO.find(puzzle => puzzle.id === id);
}

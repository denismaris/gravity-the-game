import { BinairoPuzzle, BinairoState, BinairoValue } from './types';

export function isGiven(puzzle: BinairoPuzzle, row: number, col: number): boolean {
  return puzzle.givens[row][col] !== null;
}

/** A fresh board for `puzzle`: the givens, pre-filled, everything else blank. */
export function emptyBinairoState(puzzle: BinairoPuzzle): BinairoState {
  return { values: puzzle.givens.map(row => row.slice()) };
}

/** The next value in the tap cycle: blank -> ring (0) -> dot (1) -> blank. */
export function nextValue(value: BinairoValue): BinairoValue {
  if (value === null) return 0;
  if (value === 0) return 1;
  return null;
}

/**
 * Returns a new state with `(row, col)` set to `value`. Pure - the input is
 * never mutated; a given cell or a no-op returns the same state.
 */
export function setValue(
  state: BinairoState,
  puzzle: BinairoPuzzle,
  row: number,
  col: number,
  value: BinairoValue,
): BinairoState {
  if (isGiven(puzzle, row, col) || state.values[row][col] === value) return state;
  return {
    values: state.values.map((line, r) => (r === row ? line.map((v, c) => (c === col ? value : v)) : line)),
  };
}

export function colValues(state: BinairoState, col: number): BinairoValue[] {
  return state.values.map(row => row[col]);
}

/** Count of still-blank cells (for progress UI). */
export function remainingCells(state: BinairoState): number {
  return state.values.reduce((sum, row) => sum + row.filter(v => v === null).length, 0);
}

/** Whether `line` has any run of three (or more) consecutive equal values.
 * Blanks never count as part of a run. */
export function hasTripleRun(line: ReadonlyArray<BinairoValue>): boolean {
  for (let i = 0; i + 2 < line.length; i += 1) {
    if (line[i] !== null && line[i] === line[i + 1] && line[i + 1] === line[i + 2]) return true;
  }
  return false;
}

function isBalancedAndFull(line: ReadonlyArray<BinairoValue>): boolean {
  if (line.some(v => v === null)) return false;
  const zeros = line.filter(v => v === 0).length;
  return zeros === line.length / 2;
}

function lineKey(line: ReadonlyArray<BinairoValue>): string {
  return line.join(',');
}

/**
 * A puzzle is solved when every cell is filled, no row or column has a
 * triple, every row and column is evenly split, and no two rows - or two
 * columns - repeat. Player mistakes are simply wrong the moment they're
 * made; there is no separate "check" step.
 */
export function isBinairoSolved(puzzle: BinairoPuzzle, state: BinairoState): boolean {
  const n = puzzle.size;
  const rows = state.values;

  for (const row of rows) {
    if (!isBalancedAndFull(row) || hasTripleRun(row)) return false;
  }
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    if (!isBalancedAndFull(col) || hasTripleRun(col)) return false;
  }

  const rowKeys = new Set(rows.map(lineKey));
  if (rowKeys.size !== n) return false;
  const colKeys = new Set(Array.from({ length: n }, (_v, c) => lineKey(colValues(state, c))));
  if (colKeys.size !== n) return false;

  return true;
}

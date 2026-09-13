import { TowerHeight, TowersCell, TowersPuzzle, TowersState } from './types';

/** A fresh, empty board for `puzzle`. */
export function emptyTowersState(puzzle: TowersPuzzle): TowersState {
  return {
    values: Array.from({ length: puzzle.size }, () =>
      Array.from({ length: puzzle.size }, (): TowerHeight => 0),
    ),
  };
}

/**
 * Returns a new state with `(row, col)` set to `value`. Pure - the input is
 * never mutated; a no-op returns the same state. Every cell is always
 * player-editable - unlike Sudoku, Skyscrapers hands out no pre-filled
 * givens, only the edge clues.
 */
export function setCell(
  state: TowersState,
  row: number,
  col: number,
  value: TowerHeight,
): TowersState {
  if (state.values[row][col] === value) return state;
  return {
    values: state.values.map((line, r) => (r === row ? line.map((v, c) => (c === col ? value : v)) : line)),
  };
}

export function colValues(state: TowersState, col: number): TowerHeight[] {
  return state.values.map(row => row[col]);
}

/** Count of still-blank cells (for progress UI). */
export function remainingCells(state: TowersState): number {
  return state.values.reduce((sum, row) => sum + row.filter(v => v === 0).length, 0);
}

/**
 * How many towers are visible scanning `line` from its start: a tower is
 * visible if it's taller than every tower before it (the first is always
 * visible). Assumes `line` has no blanks - only ever called on a fully
 * filled row or column. Reused for all four clue directions by the caller
 * pre-reversing the input for "from the right/bottom."
 */
export function visibleCount(line: ReadonlyArray<number>): number {
  let count = 0;
  let tallest = 0;
  for (const height of line) {
    if (height > tallest) {
      count += 1;
      tallest = height;
    }
  }
  return count;
}

function isPermutationOf1ToN(line: ReadonlyArray<number>, n: number): boolean {
  if (line.length !== n) return false;
  const seen = new Set(line);
  return seen.size === n && line.every(v => v >= 1 && v <= n);
}

/**
 * A puzzle is solved when every row and column is a permutation of 1..N
 * and every non-zero edge clue's visible-tower count matches. Player
 * mistakes are simply wrong, the moment they're made - there is no
 * separate "check" step.
 */
export function isTowersSolved(puzzle: TowersPuzzle, state: TowersState): boolean {
  const n = puzzle.size;
  for (let r = 0; r < n; r += 1) {
    if (!isPermutationOf1ToN(state.values[r], n)) return false;
  }
  for (let c = 0; c < n; c += 1) {
    if (!isPermutationOf1ToN(colValues(state, c), n)) return false;
  }
  for (let r = 0; r < n; r += 1) {
    const row = state.values[r];
    if (puzzle.leftClues[r] !== 0 && visibleCount(row) !== puzzle.leftClues[r]) return false;
    if (puzzle.rightClues[r] !== 0 && visibleCount([...row].reverse()) !== puzzle.rightClues[r]) return false;
  }
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    if (puzzle.topClues[c] !== 0 && visibleCount(col) !== puzzle.topClues[c]) return false;
    if (puzzle.bottomClues[c] !== 0 && visibleCount([...col].reverse()) !== puzzle.bottomClues[c]) return false;
  }
  return true;
}

/**
 * Whether row `row` is finished: a full 1..N permutation, and - if that
 * side has a clue - the visible-tower count already matches it. Used to
 * detect the instant a single line resolves (a progress pulse, a sound),
 * as distinct from `isTowersSolved`, which asks the same question of every
 * line in the grid at once.
 */
export function isRowComplete(puzzle: TowersPuzzle, state: TowersState, row: number): boolean {
  const n = puzzle.size;
  const line = state.values[row];
  if (!isPermutationOf1ToN(line, n)) return false;
  if (puzzle.leftClues[row] !== 0 && visibleCount(line) !== puzzle.leftClues[row]) return false;
  if (puzzle.rightClues[row] !== 0 && visibleCount([...line].reverse()) !== puzzle.rightClues[row]) return false;
  return true;
}

/** Column counterpart to `isRowComplete` - see that function for the shape
 * of the check. */
export function isColComplete(puzzle: TowersPuzzle, state: TowersState, col: number): boolean {
  const n = puzzle.size;
  const line = colValues(state, col);
  if (!isPermutationOf1ToN(line, n)) return false;
  if (puzzle.topClues[col] !== 0 && visibleCount(line) !== puzzle.topClues[col]) return false;
  if (puzzle.bottomClues[col] !== 0 && visibleCount([...line].reverse()) !== puzzle.bottomClues[col]) return false;
  return true;
}

/**
 * Cells sharing a row or column with an equal, already-placed value -
 * exactly Sudoku's "wrong is visible the moment it happens" highlight,
 * minus the box (Skyscrapers has none).
 */
export function computeConflicts(state: TowersState): ReadonlySet<string> {
  const n = state.values.length;
  const conflicts = new Set<string>();

  for (let r = 0; r < n; r += 1) {
    const byValue = new Map<number, TowersCell[]>();
    for (let c = 0; c < n; c += 1) {
      const v = state.values[r][c];
      if (v === 0) continue;
      const cells = byValue.get(v) ?? [];
      cells.push({ row: r, col: c });
      byValue.set(v, cells);
    }
    for (const cells of byValue.values()) {
      if (cells.length > 1) for (const cell of cells) conflicts.add(`${cell.row}:${cell.col}`);
    }
  }

  for (let c = 0; c < n; c += 1) {
    const byValue = new Map<number, TowersCell[]>();
    for (let r = 0; r < n; r += 1) {
      const v = state.values[r][c];
      if (v === 0) continue;
      const cells = byValue.get(v) ?? [];
      cells.push({ row: r, col: c });
      byValue.set(v, cells);
    }
    for (const cells of byValue.values()) {
      if (cells.length > 1) for (const cell of cells) conflicts.add(`${cell.row}:${cell.col}`);
    }
  }

  return conflicts;
}

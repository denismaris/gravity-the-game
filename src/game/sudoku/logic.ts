import { BOX_SIZE, SIZE, SudokuCell, SudokuPuzzle, SudokuState, SudokuValue } from './types';

const key = (c: SudokuCell): string => `${c.row}:${c.col}`;

export function emptySudokuState(puzzle: SudokuPuzzle): SudokuState {
  return { values: puzzle.givens.map(row => [...row]) };
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

/** Whether `(row, col)` is one of the puzzle's pre-filled cells - these are
 * permanent and never editable. */
export function isGiven(puzzle: SudokuPuzzle, row: number, col: number): boolean {
  return puzzle.givens[row][col] !== 0;
}

/**
 * Sets a non-given cell to `value` (0 clears it). Pure - returns the same
 * `state` reference (no-op) if `(row, col)` is out of bounds, a given cell,
 * or already holds `value`. Deliberately permissive about *what* value can
 * go where - entering a value that conflicts with the rest of the grid is
 * allowed (see `computeConflicts`), exactly like solving on paper: you find
 * out it's wrong by looking, not by the pencil refusing to write.
 */
export function setCell(
  state: SudokuState,
  puzzle: SudokuPuzzle,
  row: number,
  col: number,
  value: SudokuValue,
): SudokuState {
  if (!inBounds(row, col) || isGiven(puzzle, row, col)) return state;
  if (state.values[row][col] === value) return state;

  const values = state.values.map((line, r) =>
    r === row ? line.map((v, c) => (c === col ? value : v)) : line,
  );
  return { values };
}

function groupCells(cells: ReadonlyArray<SudokuCell>, state: SudokuState, into: Set<string>): void {
  const seenAt = new Map<SudokuValue, SudokuCell[]>();
  for (const cell of cells) {
    const v = state.values[cell.row][cell.col];
    if (v === 0) continue;
    const list = seenAt.get(v) ?? [];
    list.push(cell);
    seenAt.set(v, list);
  }
  for (const list of seenAt.values()) {
    if (list.length > 1) {
      for (const cell of list) into.add(key(cell));
    }
  }
}

/**
 * Cells that currently break Sudoku's one-of-each rule in their row,
 * column, or 3x3 box - for live "that's wrong" highlighting as the player
 * types, and what `isSudokuSolved` checks is empty. A blank cell never
 * conflicts with anything.
 */
export function computeConflicts(state: SudokuState): ReadonlySet<string> {
  const conflicts = new Set<string>();

  for (let r = 0; r < SIZE; r += 1) {
    groupCells(Array.from({ length: SIZE }, (_, c) => ({ row: r, col: c })), state, conflicts);
  }
  for (let c = 0; c < SIZE; c += 1) {
    groupCells(Array.from({ length: SIZE }, (_, r) => ({ row: r, col: c })), state, conflicts);
  }
  for (let br = 0; br < SIZE; br += BOX_SIZE) {
    for (let bc = 0; bc < SIZE; bc += BOX_SIZE) {
      const box: SudokuCell[] = [];
      for (let r = br; r < br + BOX_SIZE; r += 1) {
        for (let c = bc; c < bc + BOX_SIZE; c += 1) box.push({ row: r, col: c });
      }
      groupCells(box, state, conflicts);
    }
  }

  return conflicts;
}

/**
 * Solved when every cell is filled and nothing conflicts - the actual
 * Sudoku rule, checked directly, rather than a comparison against one
 * memorized answer (a filled grid either satisfies the constraints or it
 * doesn't; the puzzle's own solver never even has to be consulted here).
 */
export function isSudokuSolved(state: SudokuState): boolean {
  const full = state.values.every(row => row.every(v => v !== 0));
  return full && computeConflicts(state).size === 0;
}

/** Count of still-blank cells, for a progress readout. */
export function remainingCells(state: SudokuState): number {
  let remaining = 0;
  for (const row of state.values) {
    for (const v of row) if (v === 0) remaining += 1;
  }
  return remaining;
}

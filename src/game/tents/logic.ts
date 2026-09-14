import { TentMark, TentsTreesCell, TentsTreesPuzzle, TentsTreesState } from './types';

const ORTHOGONAL: ReadonlyArray<{ dRow: number; dCol: number }> = [
  { dRow: -1, dCol: 0 },
  { dRow: 1, dCol: 0 },
  { dRow: 0, dCol: -1 },
  { dRow: 0, dCol: 1 },
];

const ALL_EIGHT: ReadonlyArray<{ dRow: number; dCol: number }> = [
  { dRow: -1, dCol: -1 },
  { dRow: -1, dCol: 0 },
  { dRow: -1, dCol: 1 },
  { dRow: 0, dCol: -1 },
  { dRow: 0, dCol: 1 },
  { dRow: 1, dCol: -1 },
  { dRow: 1, dCol: 0 },
  { dRow: 1, dCol: 1 },
];

export function inBounds(puzzle: TentsTreesPuzzle, row: number, col: number): boolean {
  return row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols;
}

export function isTreeCell(puzzle: TentsTreesPuzzle, row: number, col: number): boolean {
  return puzzle.trees.some(t => t.row === row && t.col === col);
}

/** A tent may go on any non-tree cell - it's the surrounding rules (row/col
 * counts, no touching, one adjacent tree) that narrow it down, not this. */
export function isEligible(puzzle: TentsTreesPuzzle, row: number, col: number): boolean {
  return !isTreeCell(puzzle, row, col);
}

function neighborsOf(
  puzzle: TentsTreesPuzzle,
  row: number,
  col: number,
  offsets: ReadonlyArray<{ dRow: number; dCol: number }>,
): TentsTreesCell[] {
  const result: TentsTreesCell[] = [];
  for (const { dRow, dCol } of offsets) {
    const r = row + dRow;
    const c = col + dCol;
    if (inBounds(puzzle, r, c)) result.push({ row: r, col: c });
  }
  return result;
}

export function orthogonalNeighbors(puzzle: TentsTreesPuzzle, row: number, col: number): TentsTreesCell[] {
  return neighborsOf(puzzle, row, col, ORTHOGONAL);
}

export function allNeighbors(puzzle: TentsTreesPuzzle, row: number, col: number): TentsTreesCell[] {
  return neighborsOf(puzzle, row, col, ALL_EIGHT);
}

export function adjacentTreeCount(puzzle: TentsTreesPuzzle, row: number, col: number): number {
  return orthogonalNeighbors(puzzle, row, col).filter(c => isTreeCell(puzzle, c.row, c.col)).length;
}

/** A fresh, empty board for `puzzle`. */
export function emptyTentsTreesState(puzzle: TentsTreesPuzzle): TentsTreesState {
  return {
    marks: Array.from({ length: puzzle.rows }, () =>
      Array.from({ length: puzzle.cols }, (): TentMark => 'empty'),
    ),
  };
}

/** The next mark in the tap cycle: empty -> tent -> marked -> empty. */
export function nextMark(mark: TentMark): TentMark {
  return mark === 'empty' ? 'tent' : mark === 'tent' ? 'marked' : 'empty';
}

/**
 * Returns a new state with `(row, col)` set to `mark`. Pure - the input is
 * never mutated; a tree cell or a no-op returns the same state.
 */
export function setMark(
  state: TentsTreesState,
  puzzle: TentsTreesPuzzle,
  row: number,
  col: number,
  mark: TentMark,
): TentsTreesState {
  if (!isEligible(puzzle, row, col) || state.marks[row][col] === mark) return state;
  return {
    marks: state.marks.map((line, r) => (r === row ? line.map((m, c) => (c === col ? mark : m)) : line)),
  };
}

export function rowTentCount(state: TentsTreesState, row: number): number {
  return state.marks[row].filter(m => m === 'tent').length;
}

export function colTentCount(state: TentsTreesState, col: number): number {
  return state.marks.filter(line => line[col] === 'tent').length;
}

/** Total tents the puzzle calls for, across every row (equivalently, every
 * column - `assertValidTentsAndTrees` checks the two sums agree). */
export function totalTentsNeeded(puzzle: TentsTreesPuzzle): number {
  return puzzle.rowCounts.reduce((sum, n) => sum + n, 0);
}

function currentTentCount(state: TentsTreesState): number {
  return state.marks.reduce((sum, line) => sum + line.filter(m => m === 'tent').length, 0);
}

/** Tents still needed, for progress UI - never negative even if the player
 * has over-placed. */
export function remainingTents(puzzle: TentsTreesPuzzle, state: TentsTreesState): number {
  return Math.max(0, totalTentsNeeded(puzzle) - currentTentCount(state));
}

/** Tents that touch another tent (including diagonally) - the one live
 * error state this game has. Flags both offenders in a pair, mirroring
 * `computeConflicts`' "flag every cell involved" convention elsewhere in
 * this codebase. */
export function touchingTentCells(puzzle: TentsTreesPuzzle, state: TentsTreesState): ReadonlySet<string> {
  const flagged = new Set<string>();
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (state.marks[r][c] !== 'tent') continue;
      const touches = allNeighbors(puzzle, r, c).some(n => state.marks[n.row][n.col] === 'tent');
      if (touches) flagged.add(`${r}:${c}`);
    }
  }
  return flagged;
}

/** Whether row `row`'s tent count already matches its clue - used to catch
 * the instant a single line resolves (a progress cue), as distinct from
 * `isTentsTreesSolved`, which asks that of the whole grid plus the
 * per-tent placement rules at once. */
export function isRowSatisfied(puzzle: TentsTreesPuzzle, state: TentsTreesState, row: number): boolean {
  return rowTentCount(state, row) === puzzle.rowCounts[row];
}

/** Column counterpart to `isRowSatisfied`. */
export function isColSatisfied(puzzle: TentsTreesPuzzle, state: TentsTreesState, col: number): boolean {
  return colTentCount(state, col) === puzzle.colCounts[col];
}

/**
 * A puzzle is solved when: every row/column's tent count matches its clue,
 * every tent has exactly one orthogonally-adjacent tree, and no two tents
 * touch (including diagonally). Player `marked` notes never matter.
 */
export function isTentsTreesSolved(puzzle: TentsTreesPuzzle, state: TentsTreesState): boolean {
  for (let r = 0; r < puzzle.rows; r += 1) {
    if (rowTentCount(state, r) !== puzzle.rowCounts[r]) return false;
  }
  for (let c = 0; c < puzzle.cols; c += 1) {
    if (colTentCount(state, c) !== puzzle.colCounts[c]) return false;
  }
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (state.marks[r][c] !== 'tent') continue;
      if (adjacentTreeCount(puzzle, r, c) !== 1) return false;
      const touchesAnotherTent = allNeighbors(puzzle, r, c).some(n => state.marks[n.row][n.col] === 'tent');
      if (touchesAnotherTent) return false;
    }
  }
  return true;
}

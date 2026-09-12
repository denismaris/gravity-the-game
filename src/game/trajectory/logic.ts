import { TrajectoryCell, TrajectoryPair, TrajectoryPuzzle, TrajectoryState } from './types';

const key = (c: TrajectoryCell): string => `${c.row}:${c.col}`;
const same = (a: TrajectoryCell, b: TrajectoryCell): boolean => a.row === b.row && a.col === b.col;
const adjacent = (a: TrajectoryCell, b: TrajectoryCell): boolean =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

export function emptyTrajectoryState(puzzle: TrajectoryPuzzle): TrajectoryState {
  const paths: Record<number, ReadonlyArray<TrajectoryCell>> = {};
  for (const pair of puzzle.pairs) paths[pair.color] = [];
  return { rows: puzzle.rows, cols: puzzle.cols, paths };
}

function inBounds(state: TrajectoryState, c: TrajectoryCell): boolean {
  return c.row >= 0 && c.row < state.rows && c.col >= 0 && c.col < state.cols;
}

/** The colour whose endpoint sits on `cell`, or `null`. */
export function endpointColorAt(puzzle: TrajectoryPuzzle, cell: TrajectoryCell): number | null {
  for (const pair of puzzle.pairs) {
    if (same(pair.a, cell) || same(pair.b, cell)) return pair.color;
  }
  return null;
}

/** The colour whose path currently passes through `cell`, or `null`. */
export function pathColorAt(state: TrajectoryState, cell: TrajectoryCell): number | null {
  const k = key(cell);
  for (const [color, path] of Object.entries(state.paths)) {
    if (path.some(c => key(c) === k)) return Number(color);
  }
  return null;
}

function withPath(
  state: TrajectoryState,
  color: number,
  path: ReadonlyArray<TrajectoryCell>,
): TrajectoryState {
  return { ...state, paths: { ...state.paths, [color]: path } };
}

/**
 * Start (or restart) a colour's path from one of its endpoints. Any cell
 * belonging to another colour's path is left alone; the started colour's own
 * previous path is discarded.
 */
export function beginPath(
  state: TrajectoryState,
  puzzle: TrajectoryPuzzle,
  cell: TrajectoryCell,
): TrajectoryState {
  const color = endpointColorAt(puzzle, cell);
  if (color === null) return state;
  return withPath(state, color, [cell]);
}

/**
 * Extend the active `color` path to `cell`. Rules:
 *  - `cell` must be orthogonally adjacent to the current head.
 *  - stepping back onto a cell already in this path truncates to there.
 *  - `cell` must otherwise be empty, or this colour's *other* endpoint.
 *  - it may never enter another colour's path or endpoint.
 * A no-op returns the same state reference.
 */
export function extendPath(
  state: TrajectoryState,
  puzzle: TrajectoryPuzzle,
  color: number,
  cell: TrajectoryCell,
): TrajectoryState {
  const path = state.paths[color] ?? [];
  if (path.length === 0 || !inBounds(state, cell)) return state;

  const head = path[path.length - 1];
  const existingIndex = path.findIndex(c => same(c, cell));
  if (existingIndex !== -1) {
    if (existingIndex === path.length - 1) return state;
    return withPath(state, color, path.slice(0, existingIndex + 1));
  }
  if (!adjacent(head, cell)) return state;

  const otherColorEndpoint = endpointColorAt(puzzle, cell);
  if (otherColorEndpoint !== null && otherColorEndpoint !== color) return state;

  const otherColorPath = pathColorAt(state, cell);
  if (otherColorPath !== null && otherColorPath !== color) return state;

  return withPath(state, color, [...path, cell]);
}

export function clearPath(state: TrajectoryState, color: number): TrajectoryState {
  if ((state.paths[color] ?? []).length === 0) return state;
  return withPath(state, color, []);
}

/** A path connects its colour's endpoints when it runs, unbroken, from one
 * to the other. */
export function pairConnected(state: TrajectoryState, pair: TrajectoryPair): boolean {
  const path = state.paths[pair.color] ?? [];
  if (path.length < 2) return false;
  for (let i = 1; i < path.length; i += 1) {
    if (!adjacent(path[i - 1], path[i])) return false;
  }
  const first = path[0];
  const last = path[path.length - 1];
  const hitsBoth =
    (same(first, pair.a) && same(last, pair.b)) || (same(first, pair.b) && same(last, pair.a));
  return hitsBoth;
}

/**
 * Solved when every pair is connected, no two paths share a cell, and every
 * board cell is covered by some path (classic flow rules).
 */
export function isTrajectorySolved(state: TrajectoryState, puzzle: TrajectoryPuzzle): boolean {
  const seen = new Set<string>();
  let covered = 0;

  for (const pair of puzzle.pairs) {
    if (!pairConnected(state, pair)) return false;
    for (const c of state.paths[pair.color] ?? []) {
      const k = key(c);
      if (seen.has(k)) return false; // two paths overlap
      seen.add(k);
      covered += 1;
    }
  }

  return covered === puzzle.rows * puzzle.cols;
}

/** Cells still not covered by any path - for a progress readout. */
export function remainingCells(state: TrajectoryState, puzzle: TrajectoryPuzzle): number {
  const seen = new Set<string>();
  for (const path of Object.values(state.paths)) {
    for (const c of path) seen.add(key(c));
  }
  return puzzle.rows * puzzle.cols - seen.size;
}

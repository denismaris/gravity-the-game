import { ArukoneAxis, ArukoneCell, ArukonePair, ArukonePuzzle, ArukoneState } from './types';

export function cellKey(cell: ArukoneCell): string {
  return `${cell.row}:${cell.col}`;
}

export function sameCell(a: ArukoneCell, b: ArukoneCell): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Orthogonally adjacent - paths never move diagonally. */
export function isAdjacent(a: ArukoneCell, b: ArukoneCell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/**
 * Where `cell` lands when the board is folded along `axis`. Its own
 * inverse for all three axes, which is what lets a path and its mirror be
 * drawn and erased as one action.
 */
export function mirrorCell(axis: ArukoneAxis, size: number, cell: ArukoneCell): ArukoneCell {
  switch (axis) {
    case 'vertical':
      return { row: cell.row, col: size - 1 - cell.col };
    case 'horizontal':
      return { row: size - 1 - cell.row, col: cell.col };
    case 'rotational':
      return { row: size - 1 - cell.row, col: size - 1 - cell.col };
  }
}

/** A cell that maps to itself - on the fold line. A path may cross these,
 * but two different paths cannot both use one. */
export function isOnAxis(axis: ArukoneAxis, size: number, cell: ArukoneCell): boolean {
  return sameCell(cell, mirrorCell(axis, size, cell));
}

export function emptyArukoneState(): ArukoneState {
  return { paths: {} };
}

export function obstacleSet(puzzle: ArukonePuzzle): ReadonlySet<string> {
  return new Set(puzzle.obstacles.map(cellKey));
}

/** The pair a given value belongs to. */
export function pairFor(puzzle: ArukonePuzzle, value: number): ArukonePair | undefined {
  return puzzle.pairs.find(p => p.value === value);
}

/** The pair whose endpoints are the mirror image of `pair`'s - the one
 * that gets drawn for free when this one is drawn. A self-symmetric pair
 * is its own partner. */
export function mirrorPairOf(puzzle: ArukonePuzzle, pair: ArukonePair): ArukonePair | undefined {
  const ma = mirrorCell(puzzle.axis, puzzle.size, pair.a);
  const mb = mirrorCell(puzzle.axis, puzzle.size, pair.b);
  return puzzle.pairs.find(
    other =>
      (sameCell(other.a, ma) && sameCell(other.b, mb)) || (sameCell(other.a, mb) && sameCell(other.b, ma)),
  );
}

/** Every cell any path currently occupies, mapped to the value that owns
 * it - the one structure both the crossing rule and the renderer need. */
export function occupancy(state: ArukoneState): ReadonlyMap<string, number> {
  const owned = new Map<string, number>();
  for (const [value, path] of Object.entries(state.paths)) {
    for (const cell of path) owned.set(cellKey(cell), Number(value));
  }
  return owned;
}

/** Whether a path is a legal run: adjacent steps, no obstacle, no cell
 * visited twice, and endpoints only at its own pair's endpoints. */
export function isPathWellFormed(puzzle: ArukonePuzzle, pair: ArukonePair, path: ReadonlyArray<ArukoneCell>): boolean {
  if (path.length === 0) return true;
  const blocked = obstacleSet(puzzle);
  const seen = new Set<string>();
  const endpoints = new Set([cellKey(pair.a), cellKey(pair.b)]);
  const otherEndpoints = new Set(
    puzzle.pairs.filter(p => p.value !== pair.value).flatMap(p => [cellKey(p.a), cellKey(p.b)]),
  );

  for (let i = 0; i < path.length; i += 1) {
    const cell = path[i];
    const key = cellKey(cell);
    if (cell.row < 0 || cell.col < 0 || cell.row >= puzzle.size || cell.col >= puzzle.size) return false;
    if (blocked.has(key)) return false;
    if (seen.has(key)) return false;
    // A path may never run through another pair's endpoint.
    if (otherEndpoints.has(key)) return false;
    seen.add(key);
    if (i > 0 && !isAdjacent(path[i - 1], cell)) return false;
  }

  // It has to start on one of its own endpoints.
  if (!endpoints.has(cellKey(path[0]))) return false;
  return true;
}

/** A path that actually joins its pair, rather than one still being drawn. */
export function isPathComplete(pair: ArukonePair, path: ReadonlyArray<ArukoneCell>): boolean {
  if (path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  return (
    (sameCell(first, pair.a) && sameCell(last, pair.b)) || (sameCell(first, pair.b) && sameCell(last, pair.a))
  );
}

/** Values whose paths overlap another value's path - the crossing rule.
 * Reported as a set of values so the board can flag both offenders. */
export function crossingValues(state: ArukoneState): ReadonlySet<number> {
  const owner = new Map<string, number>();
  const crossing = new Set<number>();
  for (const [valueText, path] of Object.entries(state.paths)) {
    const value = Number(valueText);
    for (const cell of path) {
      const key = cellKey(cell);
      const existing = owner.get(key);
      if (existing !== undefined && existing !== value) {
        crossing.add(existing);
        crossing.add(value);
      } else {
        owner.set(key, value);
      }
    }
  }
  return crossing;
}

/**
 * Every free square no path has reached yet.
 *
 * Filling the grid is part of solving it, not a bonus: a board where the
 * numbers are joined but half the squares are untouched is visibly
 * unfinished, and leaving those squares optional makes most routes
 * interchangeable - it is the requirement to use every square that makes
 * one route right and the others wrong.
 */
export function uncoveredCells(puzzle: ArukonePuzzle, state: ArukoneState): ArukoneCell[] {
  const blocked = obstacleSet(puzzle);
  const taken = occupancy(state);
  const open: ArukoneCell[] = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const cell = { row, col };
      const key = cellKey(cell);
      if (!blocked.has(key) && !taken.has(key)) open.push(cell);
    }
  }
  return open;
}

/** How many squares are still to fill - the other half of the header's
 * progress, alongside `remainingPairs`. */
export function remainingCells(puzzle: ArukonePuzzle, state: ArukoneState): number {
  return uncoveredCells(puzzle, state).length;
}

/** How many pairs still have no complete path - for the header's kicker. */
export function remainingPairs(puzzle: ArukonePuzzle, state: ArukoneState): number {
  return puzzle.pairs.filter(pair => !isPathComplete(pair, state.paths[pair.value] ?? [])).length;
}

/**
 * Solved when every pair is joined by a well-formed path, no two paths
 * share a cell, and every square is used.
 *
 * Symmetry is deliberately *not* checked here. It cannot be violated: the
 * board mirrors every step as it is drawn (see `types.ts`), so a state
 * that breaks symmetry is unreachable rather than merely invalid. Checking
 * it would be asserting something the input can't express.
 *
 * Full coverage, by contrast, very much can be violated, and is checked
 * last because it is the expensive one.
 */
export function isArukoneSolved(puzzle: ArukonePuzzle, state: ArukoneState): boolean {
  if (crossingValues(state).size > 0) return false;
  const joined = puzzle.pairs.every(pair => {
    const path = state.paths[pair.value] ?? [];
    return isPathComplete(pair, path) && isPathWellFormed(puzzle, pair, path);
  });
  if (!joined) return false;
  return uncoveredCells(puzzle, state).length === 0;
}

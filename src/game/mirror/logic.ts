import { Direction, MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState, MirrorKind } from './types';

/** row:col - a bare position, used for gem/obstacle/source/target membership
 * checks that don't care about direction. */
export function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** row:col:direction - a beam *state*, used for loop detection. Position
 * alone is not enough here (unlike Gravity's zone traversal, where the next
 * step is a pure function of position): a mirror reflects differently
 * depending on which way the beam entered it, so the same cell can be
 * crossed safely more than once as long as it's never entered the same way
 * twice. Revisiting the same (row, col, direction) triple guarantees an
 * infinite loop by pigeonhole (at most rows*cols*4 such triples exist).
 * Exported so the solver's search (which must trace under a *partial*,
 * still-being-decided mirror layout) uses this exact same key, not a
 * second, potentially-diverging implementation. */
export function stateKey(row: number, col: number, direction: Direction): string {
  return `${row}:${col}:${direction}`;
}

export const STEP: Record<Direction, { dRow: number; dCol: number }> = {
  up: { dRow: -1, dCol: 0 },
  down: { dRow: 1, dCol: 0 },
  left: { dRow: 0, dCol: -1 },
  right: { dRow: 0, dCol: 1 },
};

/**
 * How a beam's direction changes crossing a mirror. Derived from treating
 * `/` ("fwd") as the line row+col=const and `\` ("back") as row=col+const:
 * reflecting a direction vector across each line swaps and/or negates its
 * components. Written as an explicit table rather than the vector math
 * directly, so the four cases per mirror are each individually obvious and
 * checkable.
 */
const REFLECT: Record<MirrorKind, Record<Direction, Direction>> = {
  fwd: { right: 'up', up: 'right', left: 'down', down: 'left' },
  back: { right: 'down', down: 'right', left: 'up', up: 'left' },
};

export function reflect(direction: Direction, mirror: MirrorKind): Direction {
  return REFLECT[mirror][direction];
}

export function inBounds(puzzle: MirrorMazePuzzle, row: number, col: number): boolean {
  return row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols;
}

export function isObstacle(puzzle: MirrorMazePuzzle, row: number, col: number): boolean {
  return puzzle.obstacles.some(o => o.row === row && o.col === col);
}

/** Whether the player may place a mirror on this cell: not the source, not
 * the target, not a fixed obstacle. Gem cells ARE eligible - a gem is a
 * checkpoint the beam must cross, not a placement restriction. */
export function isEligible(puzzle: MirrorMazePuzzle, row: number, col: number): boolean {
  if (row === puzzle.source.row && col === puzzle.source.col) return false;
  if (row === puzzle.target.row && col === puzzle.target.col) return false;
  return !isObstacle(puzzle, row, col);
}

export function emptyMirrorMazeState(puzzle: MirrorMazePuzzle): MirrorMazeState {
  return {
    mirrors: Array.from({ length: puzzle.rows }, () =>
      Array.from({ length: puzzle.cols }, (): MirrorKind | null => null),
    ),
  };
}

/** Blank -> `/` -> `\` -> blank. Pure value transform - pair with `setMirror`
 * at the call site (`setMirror(state, puzzle, row, col, nextMirror(current))`),
 * the same two-function split Constellation's `nextMark`/`setMark` use. */
export function nextMirror(current: MirrorKind | null): MirrorKind | null {
  if (current === null) return 'fwd';
  if (current === 'fwd') return 'back';
  return null;
}

/** Pure setter. Returns `state` unchanged (same reference) if the cell isn't
 * eligible or the value wouldn't actually change - mirrors Sudoku's `setCell`
 * refusing a given cell the same way. */
export function setMirror(
  state: MirrorMazeState,
  puzzle: MirrorMazePuzzle,
  row: number,
  col: number,
  mirror: MirrorKind | null,
): MirrorMazeState {
  if (!isEligible(puzzle, row, col)) return state;
  if (state.mirrors[row][col] === mirror) return state;

  const mirrors = state.mirrors.map((line, r) =>
    r === row ? line.map((cell, c) => (c === col ? mirror : cell)) : line,
  );
  return { mirrors };
}

/**
 * Traces the beam from `puzzle.source`/`sourceDirection` under the mirror
 * layout in `state`. Always terminates (see `stateKey`'s doc comment).
 * Returns every cell visited, in order, starting with `source`. The last
 * element is where the beam actually stops - at the target (a sink: the
 * trace always ends there, whatever mirror might otherwise sit on it), at
 * the board edge, the cell before a fixed obstacle, or a loop.
 */
export function traceBeam(
  puzzle: MirrorMazePuzzle,
  state: MirrorMazeState,
): ReadonlyArray<MirrorMazeCell> {
  let row = puzzle.source.row;
  let col = puzzle.source.col;
  let direction = puzzle.sourceDirection;

  const path: MirrorMazeCell[] = [{ row, col }];
  const seen = new Set<string>([stateKey(row, col, direction)]);

  while (true) {
    if (row === puzzle.target.row && col === puzzle.target.col) break;

    const mirror = state.mirrors[row][col];
    if (mirror) direction = reflect(direction, mirror);

    const { dRow, dCol } = STEP[direction];
    const nextRow = row + dRow;
    const nextCol = col + dCol;

    if (!inBounds(puzzle, nextRow, nextCol)) break;
    if (isObstacle(puzzle, nextRow, nextCol)) break;

    const nextKey = stateKey(nextRow, nextCol, direction);
    if (seen.has(nextKey)) break; // would loop forever - stop, unsolved

    row = nextRow;
    col = nextCol;
    seen.add(nextKey);
    path.push({ row, col });
  }

  return path;
}

/** Solved: the trace ends exactly on the target, having crossed every gem
 * (in any order) along the way. */
export function isMirrorMazeSolved(puzzle: MirrorMazePuzzle, state: MirrorMazeState): boolean {
  const path = traceBeam(puzzle, state);
  const last = path[path.length - 1];
  if (last.row !== puzzle.target.row || last.col !== puzzle.target.col) return false;

  const visited = new Set(path.map(c => positionKey(c.row, c.col)));
  return puzzle.gems.every(g => visited.has(positionKey(g.row, g.col)));
}

/** Gems the current trace has not (yet) crossed - the "N LEFT" kicker metric. */
export function remainingGems(puzzle: MirrorMazePuzzle, state: MirrorMazeState): number {
  const path = traceBeam(puzzle, state);
  const visited = new Set(path.map(c => positionKey(c.row, c.col)));
  return puzzle.gems.filter(g => !visited.has(positionKey(g.row, g.col))).length;
}

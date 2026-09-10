import { Direction, GameState, MovableObject, StaticCellType } from './types';

interface Step {
  readonly dRow: number;
  readonly dCol: number;
}

function stepFor(direction: Direction): Step {
  switch (direction) {
    case 'up':
      return { dRow: -1, dCol: 0 };
    case 'down':
      return { dRow: 1, dCol: 0 };
    case 'left':
      return { dRow: 0, dCol: -1 };
    case 'right':
      return { dRow: 0, dCol: 1 };
  }
}

/** UP/DOWN move along a column; LEFT/RIGHT move along a row. Objects that
 * share a lane can block each other - objects in different lanes never
 * interact with each other. */
function laneKeyFor(direction: Direction, object: MovableObject): number {
  return direction === 'up' || direction === 'down' ? object.col : object.row;
}

/** Within a lane, the object closest to the destination edge must resolve
 * first so later objects correctly stack up behind it. */
function sortOrderFor(direction: Direction): (a: MovableObject, b: MovableObject) => number {
  switch (direction) {
    case 'up':
      return (a, b) => a.row - b.row;
    case 'down':
      return (a, b) => b.row - a.row;
    case 'left':
      return (a, b) => a.col - b.col;
    case 'right':
      return (a, b) => b.col - a.col;
  }
}

function isInsideBoard(state: GameState, row: number, col: number): boolean {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

function isObstacle(state: GameState, row: number, col: number): boolean {
  return state.staticGrid[row][col] === StaticCellType.Obstacle;
}

function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Applies gravity to every movable object in `state`, sliding each one as
 * far as possible in `direction` until it is stopped by the board edge, an
 * obstacle, an anchored object, or another movable object.
 *
 * Anchored objects (`movable.anchored === true`) never move: they are seeded
 * into the board as fixed occupants before anything slides, so every other
 * object treats them as permanent blockers - identical to an obstacle.
 *
 * Contract:
 * - Pure function: `state` is never mutated; a new `GameState` is returned.
 * - Deterministic: the same `(state, direction)` pair always produces the
 *   same result.
 * - Safe: movable objects can never end up overlapping each other, an
 *   obstacle, or an anchored object, and never leave the board.
 */
export function applyGravity(state: GameState, direction: Direction): GameState {
  const { dRow, dCol } = stepFor(direction);

  const compare = sortOrderFor(direction);
  const occupied = new Set<string>();
  const resolvedById = new Map<string, MovableObject>();

  // Anchored objects are fixed: they stay exactly where they are and their
  // cells count as occupied for everything that slides afterwards.
  for (const movable of state.movables) {
    if (movable.anchored) {
      occupied.add(positionKey(movable.row, movable.col));
      resolvedById.set(movable.id, movable);
    }
  }

  const lanes = new Map<number, MovableObject[]>();
  for (const movable of state.movables) {
    if (movable.anchored) continue;
    const key = laneKeyFor(direction, movable);
    const lane = lanes.get(key);
    if (lane) {
      lane.push(movable);
    } else {
      lanes.set(key, [movable]);
    }
  }

  for (const lane of lanes.values()) {
    const ordered = [...lane].sort(compare);

    for (const movable of ordered) {
      let { row, col } = movable;

      while (true) {
        const nextRow = row + dRow;
        const nextCol = col + dCol;

        if (!isInsideBoard(state, nextRow, nextCol)) break;
        if (isObstacle(state, nextRow, nextCol)) break;
        if (occupied.has(positionKey(nextRow, nextCol))) break;

        row = nextRow;
        col = nextCol;
      }

      occupied.add(positionKey(row, col));
      resolvedById.set(movable.id, { ...movable, row, col });
    }
  }

  // Preserve original ordering so output is stable/deterministic and easy
  // to diff against the input for animation purposes later.
  const movables = state.movables.map(movable => resolvedById.get(movable.id)!);

  return { ...state, movables };
}

/**
 * Whether applying `direction` would actually move at least one movable.
 *
 * Pure and cheap (one `applyGravity` call + a position compare). Lets the UI
 * decide, before committing a move, whether a gravity press is a real move
 * or a no-op - so a press that changes nothing can be ignored silently
 * instead of firing "something moved" feedback (haptics, slide intent). This
 * mirrors the no-op guard already inside `gameSessionReducer`.
 */
export function gravityChangesState(state: GameState, direction: Direction): boolean {
  const next = applyGravity(state, direction);

  for (let i = 0; i < state.movables.length; i += 1) {
    if (
      state.movables[i].row !== next.movables[i].row ||
      state.movables[i].col !== next.movables[i].col
    ) {
      return true;
    }
  }

  return false;
}

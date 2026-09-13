import { Cell, Direction, GameState, GravityZone, MovableObject, StaticCellType } from './types';

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

function isHazard(state: GameState, row: number, col: number): boolean {
  return state.staticGrid[row][col] === StaticCellType.Hazard;
}

function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * Builds a cell -> linked-cell lookup from a state's portal pairs. If a cell
 * is a portal endpoint, `get(key)` returns the cell an object emerges at.
 */
function buildPortalMap(state: GameState): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (const [a, b] of state.portals) {
    map.set(positionKey(a.row, a.col), b);
    map.set(positionKey(b.row, b.col), a);
  }
  return map;
}

function isInZone(zone: GravityZone | null, row: number, col: number): boolean {
  return (
    zone !== null &&
    row >= zone.minRow &&
    row <= zone.maxRow &&
    col >= zone.minCol &&
    col <= zone.maxCol
  );
}

/**
 * Applies gravity to every movable object in `state`, sliding each one as
 * far as possible in `direction` until it is stopped by the board edge, an
 * obstacle, an anchored object, or another movable object.
 *
 * Anchored objects (`movable.anchored === true`) never move: they are seeded
 * into the board as fixed occupants before anything slides, so every other
 * object treats them as permanent blockers - identical to an obstacle.
 * Destroyed objects (`movable.destroyed === true`, from a past hazard hit)
 * are seeded the same way - inert forever after, exactly like an anchor.
 *
 * Hazards: unlike an obstacle, a hazard cell never blocks entry - an object
 * slides onto it same as any empty cell, but stops there immediately and is
 * marked `destroyed`, cutting its slide short even if it could otherwise
 * have continued (a hazard is always the last cell an object visits). A
 * destroyed object still occupies its cell afterwards (a "body" other
 * objects in the same lane stack up behind), it simply never moves or
 * counts toward a target again.
 *
 * Portals: while an object is sliding, if its next cell is a portal endpoint
 * it is moved to the linked endpoint and continues sliding in the SAME
 * direction from there. This happens at most once per object per gravity
 * action (so a portal can never chain into another portal on the same
 * slide). If the linked endpoint is already occupied, the portal is
 * impassable and the object stops in the cell before it, exactly as if the
 * endpoint were a wall.
 *
 * Gravity zone: `direction` is the GLOBAL pull the player pressed. If the
 * state has a `zone`, an object's pull is re-decided every step from the
 * cell it currently occupies - the zone's direction while inside the
 * rectangle, the global direction while outside. So an object can turn a
 * corner on the zone boundary. Each object also remembers the cells it has
 * visited this slide; if the next step would re-enter one (which happens
 * when the zone pushes back against the way the object came in) it stops
 * there instead of oscillating forever. The visited set can hold at most
 * one entry per board cell, so every slide terminates.
 *
 * Contract:
 * - Pure function: `state` is never mutated; a new `GameState` is returned.
 * - Deterministic: the same `(state, direction)` pair always produces the
 *   same result. Objects resolve in a fixed order (lane by lane, each lane
 *   sorted toward the destination edge); portal traversal, the "exit
 *   occupied" check and the visited-cell check all use per-object /
 *   filled-so-far state, so the outcome is stable even when several objects
 *   use portals or zones in one action.
 * - Safe: movable objects can never end up overlapping each other, an
 *   obstacle, or an anchored object, and never leave the board.
 */
export function applyGravity(state: GameState, direction: Direction): GameState {
  const globalStep = stepFor(direction);
  const zoneStep = state.zone ? stepFor(state.zone.direction) : globalStep;

  const compare = sortOrderFor(direction);
  const occupied = new Set<string>();
  const resolvedById = new Map<string, MovableObject>();
  const portalMap = buildPortalMap(state);

  // Anchored and destroyed objects are fixed: they stay exactly where they
  // are and their cells count as occupied for everything that slides
  // afterwards.
  for (const movable of state.movables) {
    if (movable.anchored || movable.destroyed) {
      occupied.add(positionKey(movable.row, movable.col));
      resolvedById.set(movable.id, movable);
    }
  }

  const lanes = new Map<number, MovableObject[]>();
  for (const movable of state.movables) {
    if (movable.anchored || movable.destroyed) continue;
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
      let teleported = false;
      let destroyed = false;
      const visited = new Set<string>([positionKey(row, col)]);

      while (true) {
        // The pull is re-decided from the current cell every step.
        const { dRow, dCol } = isInZone(state.zone, row, col) ? zoneStep : globalStep;
        const nextRow = row + dRow;
        const nextCol = col + dCol;

        if (!isInsideBoard(state, nextRow, nextCol)) break;
        if (isObstacle(state, nextRow, nextCol)) break;
        if (occupied.has(positionKey(nextRow, nextCol))) break;

        // Entering a portal endpoint (only the first time this slide).
        if (!teleported) {
          const exit = portalMap.get(positionKey(nextRow, nextCol));
          if (exit) {
            const exitKey = positionKey(exit.row, exit.col);
            // Exit blocked, or already walked over this slide -> stop here.
            if (occupied.has(exitKey) || visited.has(exitKey)) break;
            row = exit.row;
            col = exit.col;
            teleported = true;
            visited.add(exitKey);
            // Keep sliding from the exit. Any further portal endpoint is an
            // ordinary cell for the rest of this slide (no chaining).
            continue;
          }
        }

        // Re-entering a cell already walked this slide means the zone is
        // pushing back the way we came - stop at the boundary rather than
        // oscillate.
        const nextKey = positionKey(nextRow, nextCol);
        if (visited.has(nextKey)) break;

        row = nextRow;
        col = nextCol;
        visited.add(nextKey);

        // A hazard is always the last cell an object visits - it stops here
        // destroyed, even if the slide could otherwise have continued.
        if (isHazard(state, row, col)) {
          destroyed = true;
          break;
        }
      }

      occupied.add(positionKey(row, col));
      resolvedById.set(movable.id, destroyed ? { ...movable, row, col, destroyed: true } : { ...movable, row, col });
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

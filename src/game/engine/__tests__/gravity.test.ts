import { applyGravity, gravityChangesState } from '../gravity';
import { GameState, GravityZone, MovableObject, PortalPair, StaticCellType } from '../types';

/** Builds a minimal GameState for testing without needing level data. */
function createState(
  rows: number,
  cols: number,
  movables: MovableObject[],
  obstacles: Array<{ row: number; col: number }> = [],
  portals: PortalPair[] = [],
  zone: GravityZone | null = null,
  hazards: Array<{ row: number; col: number }> = [],
): GameState {
  const staticGrid: StaticCellType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => StaticCellType.Empty),
  );

  for (const { row, col } of obstacles) {
    staticGrid[row][col] = StaticCellType.Obstacle;
  }
  for (const { row, col } of hazards) {
    staticGrid[row][col] = StaticCellType.Hazard;
  }

  return { rows, cols, staticGrid, movables, portals, zone };
}

function positionsOf(state: GameState) {
  return state.movables.map(({ id, row, col }) => ({ id, row, col }));
}

describe('applyGravity', () => {
  test('moves a single object all the way to the bottom edge', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 4, col: 2 }]);
  });

  test('moves a single object all the way to the top edge', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 2 }]);

    const result = applyGravity(state, 'up');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 0, col: 2 }]);
  });

  test('moves a single object all the way to the left edge', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 3 }]);

    const result = applyGravity(state, 'left');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 0 }]);
  });

  test('moves a single object all the way to the right edge', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 1 }]);

    const result = applyGravity(state, 'right');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 4 }]);
  });

  test('stops against an obstacle instead of passing through it', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [{ row: 3, col: 2 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 2 }]);
  });

  test('an object that starts already blocked does not move', () => {
    const state = createState(3, 3, [{ id: 'a', row: 2, col: 1 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 1 }]);
  });

  test('stops against another movable object and the two never overlap', () => {
    const state = createState(5, 5, [
      { id: 'a', row: 0, col: 2 },
      { id: 'b', row: 3, col: 2 },
    ]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 3, col: 2 },
      { id: 'b', row: 4, col: 2 },
    ]);
  });

  test('objects in different lanes (columns/rows) do not interfere with each other', () => {
    const state = createState(5, 5, [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 0, col: 4 },
    ]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 4, col: 0 },
      { id: 'b', row: 4, col: 4 },
    ]);
  });

  test('is deterministic - applying the same direction again is a no-op', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);

    const once = applyGravity(state, 'down');
    const twice = applyGravity(once, 'down');

    expect(positionsOf(twice)).toEqual(positionsOf(once));
  });

  test('never produces overlapping or out-of-bounds objects, in any direction', () => {
    const state = createState(
      6,
      6,
      [
        { id: 'a', row: 1, col: 1 },
        { id: 'b', row: 1, col: 4 },
        { id: 'c', row: 4, col: 1 },
        { id: 'd', row: 4, col: 4 },
        { id: 'e', row: 2, col: 2 },
      ],
      [{ row: 3, col: 3 }],
    );

    (['up', 'down', 'left', 'right'] as const).forEach(direction => {
      const result = applyGravity(state, direction);
      const seen = new Set<string>();

      for (const movable of result.movables) {
        const key = `${movable.row}:${movable.col}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);

        expect(movable.row).toBeGreaterThanOrEqual(0);
        expect(movable.row).toBeLessThan(result.rows);
        expect(movable.col).toBeGreaterThanOrEqual(0);
        expect(movable.col).toBeLessThan(result.cols);
      }
    });
  });

  test('three objects in one column stack correctly on top of each other', () => {
    const state = createState(6, 3, [
      { id: 'a', row: 0, col: 1 },
      { id: 'b', row: 1, col: 1 },
      { id: 'c', row: 2, col: 1 },
    ]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 3, col: 1 },
      { id: 'b', row: 4, col: 1 },
      { id: 'c', row: 5, col: 1 },
    ]);
  });
});

describe('applyGravity with anchored objects', () => {
  test('an anchored object never moves, in any direction', () => {
    const state = createState(5, 5, [{ id: 'anchor', row: 2, col: 2, anchored: true }]);

    (['up', 'down', 'left', 'right'] as const).forEach(direction => {
      const result = applyGravity(state, direction);
      expect(positionsOf(result)).toEqual([{ id: 'anchor', row: 2, col: 2 }]);
      // The `anchored` flag is preserved on the output.
      expect(result.movables[0].anchored).toBe(true);
    });
  });

  test('a normal object stops against an anchored object like it would a wall', () => {
    const state = createState(5, 5, [
      { id: 'a', row: 0, col: 2 },
      { id: 'anchor', row: 3, col: 2, anchored: true },
    ]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 2, col: 2 },
      { id: 'anchor', row: 3, col: 2 },
    ]);
  });

  test('an anchored object blocks movement identically to an obstacle at the same cell', () => {
    const withAnchor = createState(6, 6, [
      { id: 'a', row: 0, col: 1 },
      { id: 'anchor', row: 4, col: 1, anchored: true },
    ]);
    const withObstacle = createState(
      6,
      6,
      [{ id: 'a', row: 0, col: 1 }],
      [{ row: 4, col: 1 }],
    );

    const a = applyGravity(withAnchor, 'down').movables.find(m => m.id === 'a');
    const b = applyGravity(withObstacle, 'down').movables.find(m => m.id === 'a');

    expect({ row: a!.row, col: a!.col }).toEqual({ row: b!.row, col: b!.col });
    expect(a).toEqual({ id: 'a', row: 3, col: 1 });
  });

  test('objects stack up behind an anchored object', () => {
    const state = createState(7, 3, [
      { id: 'a', row: 0, col: 1 },
      { id: 'b', row: 1, col: 1 },
      { id: 'anchor', row: 5, col: 1, anchored: true },
    ]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 3, col: 1 },
      { id: 'b', row: 4, col: 1 },
      { id: 'anchor', row: 5, col: 1 },
    ]);
  });

  test('an object wedged between two anchors cannot move on that axis', () => {
    const state = createState(7, 3, [
      { id: 'top', row: 2, col: 1, anchored: true },
      { id: 'a', row: 3, col: 1 },
      { id: 'bottom', row: 4, col: 1, anchored: true },
    ]);

    expect(applyGravity(state, 'up').movables.find(m => m.id === 'a')).toMatchObject({ row: 3, col: 1 });
    expect(applyGravity(state, 'down').movables.find(m => m.id === 'a')).toMatchObject({ row: 3, col: 1 });
    // ...but it is still free on the perpendicular axis.
    expect(applyGravity(state, 'left').movables.find(m => m.id === 'a')).toMatchObject({ row: 3, col: 0 });
  });

  test('gravityChangesState ignores anchored objects', () => {
    // Only an anchored object is present - nothing can ever move.
    const anchoredOnly = createState(5, 5, [{ id: 'anchor', row: 2, col: 2, anchored: true }]);
    expect(gravityChangesState(anchoredOnly, 'down')).toBe(false);

    // A normal object that can move, plus an anchor.
    const mixed = createState(5, 5, [
      { id: 'a', row: 0, col: 0 },
      { id: 'anchor', row: 4, col: 4, anchored: true },
    ]);
    expect(gravityChangesState(mixed, 'down')).toBe(true);
  });
});

describe('applyGravity with hazards', () => {
  test('an object sliding onto a hazard is destroyed there', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [], [], null, [{ row: 4, col: 2 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 4, col: 2 }]);
    expect(result.movables[0].destroyed).toBe(true);
  });

  test('a hazard stops the slide even when it could otherwise have continued', () => {
    // Hazard sits mid-board; without it the object would reach row 4.
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [], [], null, [{ row: 2, col: 2 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 2 }]);
    expect(result.movables[0].destroyed).toBe(true);
  });

  test('an unrelated lane never touches the hazard and is unaffected', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [], [], null, [{ row: 4, col: 2 }]);

    const result = applyGravity(state, 'down');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 4, col: 0 }]);
    expect(result.movables[0].destroyed).toBeFalsy();
  });

  test('a destroyed object never moves again', () => {
    let state = createState(6, 6, [{ id: 'a', row: 0, col: 2 }], [], [], null, [{ row: 3, col: 2 }]);

    state = applyGravity(state, 'down');
    expect(state.movables.find(m => m.id === 'a')).toEqual({ id: 'a', row: 3, col: 2, destroyed: true });

    // Further gravity in any direction leaves the corpse exactly in place.
    (['up', 'left', 'right', 'down'] as const).forEach(direction => {
      const next = applyGravity(state, direction);
      expect(next.movables.find(m => m.id === 'a')).toEqual({ id: 'a', row: 3, col: 2, destroyed: true });
    });
  });

  test('a destroyed object still blocks a later object in the same lane, like a corpse', () => {
    const dead = createState(6, 6, [{ id: 'a', row: 0, col: 2 }], [], [], null, [{ row: 3, col: 2 }]);
    const afterDeath = applyGravity(dead, 'down');

    const withFollower: GameState = {
      ...afterDeath,
      movables: [...afterDeath.movables, { id: 'b', row: 0, col: 2 }],
    };

    const result = applyGravity(withFollower, 'down');

    expect(result.movables.find(m => m.id === 'a')).toEqual({ id: 'a', row: 3, col: 2, destroyed: true });
    // 'b' stops one cell short of the corpse, exactly as it would against an
    // anchor or obstacle at the same cell.
    expect(result.movables.find(m => m.id === 'b')).toMatchObject({ row: 2, col: 2 });
  });

  test('gravityChangesState reports true the moment an object is destroyed', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [], [], null, [{ row: 4, col: 2 }]);
    expect(gravityChangesState(state, 'down')).toBe(true);
  });
});

describe('applyGravity with portals', () => {
  test('an object slides into a portal and emerges at the linked cell, still moving', () => {
    // Portal (0,2) <-> (4,0). Slide right from (0,0): enter (0,2), emerge at
    // (4,0), keep sliding right to the wall.
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [], [
      [{ row: 0, col: 2 }, { row: 4, col: 0 }],
    ]);

    const result = applyGravity(state, 'right');

    expect(positionsOf(result)).toEqual([{ id: 'a', row: 4, col: 4 }]);
  });

  test('the portal is symmetric: entering the "B" endpoint emerges at "A"', () => {
    // Portal A=(3,4), B=(3,0). Object enters B by falling down column 0.
    const state = createState(6, 6, [{ id: 'a', row: 0, col: 0 }], [], [
      [{ row: 3, col: 4 }, { row: 3, col: 0 }],
    ]);

    // Falls to (3,0), enters that endpoint, emerges at (3,4), keeps falling.
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 5, col: 4 }]);
  });

  test('teleports at most once per gravity action (no chaining / infinite loop)', () => {
    // Two portal endpoints adjacent in the travel direction: without a cap
    // the object would bounce between them forever.
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 0 }], [], [
      [{ row: 2, col: 2 }, { row: 2, col: 1 }],
    ]);

    const result = applyGravity(state, 'right');

    // Enter (2,2) -> emerge at (2,1) -> keep going right; (2,2) is now inert
    // -> slide over it to the wall.
    expect(positionsOf(result)).toEqual([{ id: 'a', row: 2, col: 4 }]);
  });

  test('if the portal exit is occupied, the portal acts as a wall', () => {
    // Exit (4,0) is filled by an obstacle-equivalent: another object at rest.
    const state = createState(5, 5, [
      { id: 'blocker', row: 4, col: 0, anchored: true },
      { id: 'a', row: 0, col: 0 },
    ], [], [
      [{ row: 0, col: 2 }, { row: 4, col: 0 }],
    ]);

    const result = applyGravity(state, 'right');

    // 'a' cannot emerge, so it stops in the cell before the portal mouth.
    expect(result.movables.find(m => m.id === 'a')).toMatchObject({ row: 0, col: 1 });
  });

  test('an object resting on a portal endpoint just slides off it (no teleport)', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 2 }], [], [
      [{ row: 2, col: 2 }, { row: 0, col: 4 }],
    ]);

    // 'a' is on an endpoint; moving down leaves it and it never re-enters.
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 4, col: 2 }]);
  });

  test('multiple objects through one portal in a single action: first through, rest stack behind', () => {
    // Two objects in column 2 falling toward a portal at (3,2) -> (3,4).
    const state = createState(6, 6, [
      { id: 'a', row: 0, col: 2 },
      { id: 'b', row: 1, col: 2 },
    ], [], [
      [{ row: 3, col: 2 }, { row: 3, col: 4 }],
    ]);

    const result = applyGravity(state, 'down');

    // 'b' (nearer the exit edge) resolves first: enters (3,2), emerges (3,4),
    // falls to (5,4). 'a' follows and stacks at (4,4).
    expect(positionsOf(result)).toEqual([
      { id: 'a', row: 4, col: 4 },
      { id: 'b', row: 5, col: 4 },
    ]);
  });

  test('an anchored object next to a portal exit stops emerging objects at the mouth', () => {
    const state = createState(5, 5, [
      { id: 'anchor', row: 3, col: 4, anchored: true },
      { id: 'a', row: 0, col: 0 },
    ], [], [
      [{ row: 0, col: 2 }, { row: 2, col: 4 }],
    ]);

    // 'a' slides right, enters (0,2), emerges at (2,4); the next cell down/right
    // ... direction is 'right', so from (2,4) it would leave the board -> rests
    // at (2,4). (The anchor at (3,4) is simply nearby, no special rule.)
    expect(applyGravity(state, 'right').movables.find(m => m.id === 'a')).toMatchObject({
      row: 2,
      col: 4,
    });
  });

  test('a level with no portals behaves exactly as before', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 4, col: 2 }]);
  });
});

describe('applyGravity with a gravity zone', () => {
  const bottomBandRight = {
    minRow: 3,
    maxRow: 4,
    minCol: 0,
    maxCol: 4,
    direction: 'right' as const,
  };

  test('outside the zone the object uses the global direction', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [], [], {
      minRow: 3,
      maxRow: 4,
      minCol: 0,
      maxCol: 4,
      direction: 'left',
    });
    // Starts and stays above the zone -> falls straight down to the zone's
    // top edge, where it turns...
    // (checked more precisely below) - here just confirm it left column 2.
    const after = applyGravity(state, 'down');
    expect(after.movables[0].row).toBe(3); // entered the zone's top row
  });

  test('the object turns a corner on the zone boundary (perpendicular zone)', () => {
    // Global "down", zone pulls "right". Fall into it, then slide right.
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [], [], bottomBandRight);
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 3, col: 4 }]);
  });

  test('a zone whose pull opposes the entry direction halts the object at the edge (no oscillation)', () => {
    // Global "down", zone pulls "up". The object cannot get past the zone's
    // top row - it stops there rather than bouncing forever.
    const state = createState(6, 5, [{ id: 'a', row: 0, col: 2 }], [], [], {
      minRow: 3,
      maxRow: 5,
      minCol: 0,
      maxCol: 4,
      direction: 'up',
    });
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 3, col: 2 }]);
  });

  test('an object inside the zone ignores the pressed direction and uses the zone direction', () => {
    const state = createState(5, 5, [{ id: 'a', row: 3, col: 0 }], [], [], bottomBandRight);
    // Pressed "up", but inside the zone gravity is "right".
    expect(positionsOf(applyGravity(state, 'up'))).toEqual([{ id: 'a', row: 3, col: 4 }]);
    // ...and "left" does nothing new either - still pulled right.
    expect(positionsOf(applyGravity(state, 'left'))).toEqual([{ id: 'a', row: 3, col: 4 }]);
  });

  test('when the zone direction equals the global direction nothing changes', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }], [], [], {
      minRow: 3,
      maxRow: 4,
      minCol: 0,
      maxCol: 4,
      direction: 'down',
    });
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 4, col: 2 }]);
  });

  test('the object rides the zone out the far side and then falls again (Z path)', () => {
    // One-row zone: fall in, get carried right past the right edge, drop.
    const state = createState(6, 6, [{ id: 'a', row: 0, col: 0 }], [], [], {
      minRow: 3,
      maxRow: 3,
      minCol: 0,
      maxCol: 3,
      direction: 'right',
    });
    // down -> (3,0) enter zone -> right along row 3 -> (3,4) exits zone
    // -> global "down" again -> floor (5,4).
    expect(positionsOf(applyGravity(state, 'down'))).toEqual([{ id: 'a', row: 5, col: 4 }]);
  });

  test('two objects, one in the zone and one out, resolve independently', () => {
    const zone = { minRow: 2, maxRow: 4, minCol: 3, maxCol: 5, direction: 'left' as const };
    const state = createState(6, 6, [
      { id: 'out', row: 0, col: 1 },
      { id: 'in', row: 0, col: 4 },
    ], [], [], zone);

    const result = applyGravity(state, 'down');

    // 'out' falls straight down its column. 'in' falls to (2,4), enters the
    // zone, is pushed left just until it clears the zone's left edge (col 2),
    // then falls the rest of the way from there.
    expect(result.movables.find(m => m.id === 'out')).toMatchObject({ row: 5, col: 1 });
    expect(result.movables.find(m => m.id === 'in')).toMatchObject({ row: 5, col: 2 });
  });

  test('every slide terminates even when the zone points every object back at a wall', () => {
    // Zone fills the board and pulls right; every object jams against the
    // right wall in one step and the function returns.
    const state = createState(4, 4, [
      { id: 'a', row: 0, col: 0 },
      { id: 'b', row: 3, col: 1 },
    ], [], [], { minRow: 0, maxRow: 3, minCol: 0, maxCol: 3, direction: 'right' });

    const result = applyGravity(state, 'up');
    expect(result.movables.find(m => m.id === 'a')).toMatchObject({ row: 0, col: 3 });
    expect(result.movables.find(m => m.id === 'b')).toMatchObject({ row: 3, col: 3 });
  });

  test('gravityChangesState respects the zone', () => {
    // 'top' sits at the top row inside an "up" zone that reaches the board
    // edge -> nothing can move it. 'mid' is lower in the same zone and will
    // be pulled up to the edge.
    const zone = { minRow: 0, maxRow: 4, minCol: 0, maxCol: 4, direction: 'up' as const };
    const pinned = createState(5, 5, [{ id: 'top', row: 0, col: 2 }], [], [], zone);
    expect(gravityChangesState(pinned, 'down')).toBe(false);
    expect(gravityChangesState(pinned, 'left')).toBe(false);

    const canRise = createState(5, 5, [{ id: 'mid', row: 3, col: 2 }], [], [], zone);
    expect(gravityChangesState(canRise, 'down')).toBe(true);
    expect(positionsOf(applyGravity(canRise, 'down'))).toEqual([{ id: 'mid', row: 0, col: 2 }]);
  });
});

describe('gravityChangesState', () => {
  test('true when at least one object would move', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);

    expect(gravityChangesState(state, 'down')).toBe(true);
    expect(gravityChangesState(state, 'left')).toBe(true);
  });

  test('false when nothing can move in that direction (already against the edge)', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);

    expect(gravityChangesState(state, 'up')).toBe(false);
  });

  test('false when every object is blocked by an obstacle', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 2 }], [{ row: 3, col: 2 }]);

    expect(gravityChangesState(state, 'down')).toBe(false);
  });

  test('true if any object moves even when others are already settled', () => {
    const state = createState(5, 5, [
      { id: 'a', row: 4, col: 0 }, // already on the bottom edge
      { id: 'b', row: 0, col: 4 }, // can still fall
    ]);

    expect(gravityChangesState(state, 'down')).toBe(true);
  });

  test('agrees with applyGravity being a no-op', () => {
    const state = createState(5, 5, [{ id: 'a', row: 4, col: 2 }]);

    const moved = gravityChangesState(state, 'down');
    const result = applyGravity(state, 'down');

    expect(moved).toBe(false);
    expect(positionsOf(result)).toEqual(positionsOf(state));
  });
});

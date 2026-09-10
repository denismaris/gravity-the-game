import { applyGravity, gravityChangesState } from '../gravity';
import { GameState, MovableObject, StaticCellType } from '../types';

/** Builds a minimal GameState for testing without needing level data. */
function createState(
  rows: number,
  cols: number,
  movables: MovableObject[],
  obstacles: Array<{ row: number; col: number }> = [],
): GameState {
  const staticGrid: StaticCellType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => StaticCellType.Empty),
  );

  for (const { row, col } of obstacles) {
    staticGrid[row][col] = StaticCellType.Obstacle;
  }

  return { rows, cols, staticGrid, movables };
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

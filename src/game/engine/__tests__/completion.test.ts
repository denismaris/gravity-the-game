import { isPuzzleFailed, isPuzzleSolved } from '../completion';
import { GameState, MovableObject, StaticCellType } from '../types';

/** Builds a minimal GameState for testing without needing level data. */
function createState(
  rows: number,
  cols: number,
  movables: MovableObject[],
  targets: Array<{ row: number; col: number }> = [],
  obstacles: Array<{ row: number; col: number }> = [],
): GameState {
  const staticGrid: StaticCellType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => StaticCellType.Empty),
  );

  for (const { row, col } of targets) {
    staticGrid[row][col] = StaticCellType.Target;
  }

  for (const { row, col } of obstacles) {
    staticGrid[row][col] = StaticCellType.Obstacle;
  }

  return { rows, cols, staticGrid, movables, portals: [], zone: null };
}

describe('isPuzzleSolved', () => {
  test('a single object resting exactly on its target is solved', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 2 }], [{ row: 2, col: 2 }]);

    expect(isPuzzleSolved(state)).toBe(true);
  });

  test('a single object NOT on the target is not solved', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 1 }], [{ row: 2, col: 2 }]);

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('an object directly adjacent to (but not on) a target is not a false positive', () => {
    const state = createState(5, 5, [{ id: 'a', row: 1, col: 2 }], [{ row: 2, col: 2 }]);

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('multiple objects on multiple correct targets is solved', () => {
    const state = createState(
      6,
      6,
      [
        { id: 'a', row: 0, col: 0 },
        { id: 'b', row: 5, col: 5 },
        { id: 'c', row: 3, col: 3 },
      ],
      [
        { row: 0, col: 0 },
        { row: 5, col: 5 },
        { row: 3, col: 3 },
      ],
    );

    expect(isPuzzleSolved(state)).toBe(true);
  });

  test('partial coverage (one of two objects on target) is not solved', () => {
    const state = createState(
      5,
      5,
      [
        { id: 'a', row: 4, col: 4 },
        { id: 'b', row: 1, col: 1 },
      ],
      [
        { row: 4, col: 4 },
        { row: 4, col: 0 },
      ],
    );

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('more movables than targets can never be solved', () => {
    const state = createState(
      5,
      5,
      [
        { id: 'a', row: 0, col: 0 },
        { id: 'b', row: 1, col: 1 },
        { id: 'c', row: 2, col: 2 },
      ],
      [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
    );

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('fewer movables than targets leaves a target uncovered and is not solved', () => {
    const state = createState(
      5,
      5,
      [{ id: 'a', row: 0, col: 0 }],
      [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
    );

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('a board with zero targets is never considered solved', () => {
    const state = createState(4, 4, [{ id: 'a', row: 0, col: 0 }], []);

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('a board with zero targets and zero movables is not solved', () => {
    const state = createState(4, 4, [], []);

    expect(isPuzzleSolved(state)).toBe(false);
  });

  test('obstacles elsewhere on the board do not affect the result', () => {
    const state = createState(
      5,
      5,
      [{ id: 'a', row: 2, col: 2 }],
      [{ row: 2, col: 2 }],
      [
        { row: 0, col: 0 },
        { row: 4, col: 4 },
      ],
    );

    expect(isPuzzleSolved(state)).toBe(true);
  });

  describe('with anchored objects', () => {
    test('an anchored object is ignored: the normal object still solves it', () => {
      const state = createState(
        5,
        5,
        [
          { id: 'a', row: 2, col: 2 },
          { id: 'anchor', row: 0, col: 0, anchored: true },
        ],
        [{ row: 2, col: 2 }],
      );

      expect(isPuzzleSolved(state)).toBe(true);
    });

    test('an anchored object does NOT count as covering a target', () => {
      const state = createState(
        5,
        5,
        [{ id: 'anchor', row: 2, col: 2, anchored: true }],
        [{ row: 2, col: 2 }],
      );

      // The one target is only "covered" by an anchor - not solved.
      expect(isPuzzleSolved(state)).toBe(false);
    });

    test('more anchored objects than targets is fine as long as every normal object is placed', () => {
      const state = createState(
        6,
        6,
        [
          { id: 'a', row: 5, col: 5 },
          { id: 'anchor1', row: 0, col: 0, anchored: true },
          { id: 'anchor2', row: 1, col: 0, anchored: true },
        ],
        [{ row: 5, col: 5 }],
      );

      expect(isPuzzleSolved(state)).toBe(true);
    });

    test('an unplaced normal object still blocks completion even with anchors present', () => {
      const state = createState(
        5,
        5,
        [
          { id: 'a', row: 0, col: 0 },
          { id: 'anchor', row: 4, col: 4, anchored: true },
        ],
        [{ row: 2, col: 2 }],
      );

      expect(isPuzzleSolved(state)).toBe(false);
    });
  });

  describe('with a destroyed object', () => {
    test('a destroyed object does NOT count as covering a target', () => {
      const state = createState(
        5,
        5,
        [{ id: 'a', row: 2, col: 2, destroyed: true }],
        [{ row: 2, col: 2 }],
      );

      expect(isPuzzleSolved(state)).toBe(false);
    });

    test('one destroyed object among several keeps the puzzle unsolved even if the rest are placed', () => {
      const state = createState(
        5,
        5,
        [
          { id: 'a', row: 0, col: 0 },
          { id: 'b', row: 4, col: 4, destroyed: true },
        ],
        [
          { row: 0, col: 0 },
          { row: 4, col: 4 },
        ],
      );

      expect(isPuzzleSolved(state)).toBe(false);
    });
  });
});

describe('isPuzzleFailed', () => {
  test('false when nothing has been destroyed', () => {
    const state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [{ row: 4, col: 4 }]);
    expect(isPuzzleFailed(state)).toBe(false);
  });

  test('true the moment any object is destroyed', () => {
    const state = createState(5, 5, [{ id: 'a', row: 2, col: 2, destroyed: true }], [{ row: 2, col: 2 }]);
    expect(isPuzzleFailed(state)).toBe(true);
  });

  test('true if even one of several objects is destroyed', () => {
    const state = createState(
      5,
      5,
      [
        { id: 'a', row: 0, col: 0 },
        { id: 'b', row: 4, col: 4, destroyed: true },
      ],
      [
        { row: 0, col: 0 },
        { row: 4, col: 4 },
      ],
    );
    expect(isPuzzleFailed(state)).toBe(true);
  });

  test('an anchored (not destroyed) object never counts as failed', () => {
    const state = createState(5, 5, [{ id: 'anchor', row: 0, col: 0, anchored: true }]);
    expect(isPuzzleFailed(state)).toBe(false);
  });
});

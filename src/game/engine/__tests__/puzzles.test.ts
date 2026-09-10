import { applyGravity } from '../gravity';
import { isPuzzleSolved } from '../completion';
import { GameState, MovableObject, StaticCellType } from '../types';

/**
 * Five hand-authored test puzzles that exercise the completion system
 * end-to-end (gravity + isPuzzleSolved together), rather than each engine
 * function in isolation. These double as a small regression suite for the
 * "no false positives" requirement: several puzzles deliberately pass
 * through states that LOOK close to solved but are not.
 */

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

  return { rows, cols, staticGrid, movables };
}

describe('Puzzle 1: single object, single target, one move', () => {
  test('dropping straight down solves the puzzle', () => {
    let state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [{ row: 4, col: 0 }]);
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'down');

    expect(isPuzzleSolved(state)).toBe(true);
  });
});

describe('Puzzle 2: two objects, two targets, solved by a single shared move', () => {
  test('both objects land on their targets after one "down"', () => {
    let state = createState(
      5,
      5,
      [
        { id: 'a', row: 0, col: 1 },
        { id: 'b', row: 0, col: 3 },
      ],
      [
        { row: 4, col: 1 },
        { row: 4, col: 3 },
      ],
    );
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'down');

    expect(isPuzzleSolved(state)).toBe(true);
  });
});

describe('Puzzle 3: requires two different directions in sequence', () => {
  test('down then right is required; down alone is not enough', () => {
    let state = createState(5, 5, [{ id: 'a', row: 0, col: 0 }], [{ row: 4, col: 4 }]);

    state = applyGravity(state, 'down');
    expect(state.movables).toEqual([{ id: 'a', row: 4, col: 0 }]);
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'right');
    expect(state.movables).toEqual([{ id: 'a', row: 4, col: 4 }]);
    expect(isPuzzleSolved(state)).toBe(true);
  });
});

describe('Puzzle 4: an obstacle forces a detour around a direct path', () => {
  // Layout (5x5), '#' obstacle, 'A' movable, 'T' target:
  //   . . A . .
  //   . . . . .
  //   . . # . .
  //   . . . . .
  //   . . T # .
  test('down, left, down, right navigates around the obstacle onto the target', () => {
    let state = createState(
      5,
      5,
      [{ id: 'a', row: 0, col: 2 }],
      [{ row: 4, col: 2 }],
      [
        { row: 2, col: 2 },
        { row: 4, col: 3 },
      ],
    );
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'down');
    expect(state.movables).toEqual([{ id: 'a', row: 1, col: 2 }]);
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'left');
    expect(state.movables).toEqual([{ id: 'a', row: 1, col: 0 }]);
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'down');
    expect(state.movables).toEqual([{ id: 'a', row: 4, col: 0 }]);
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'right');
    expect(state.movables).toEqual([{ id: 'a', row: 4, col: 2 }]);
    expect(isPuzzleSolved(state)).toBe(true);
  });
});

describe('Puzzle 5: three objects - one coincidentally starts on a target', () => {
  test('starting with one of three correctly placed is NOT solved (no false positive)', () => {
    let state = createState(
      5,
      5,
      [
        { id: 'a', row: 0, col: 0 },
        { id: 'b', row: 0, col: 2 },
        { id: 'c', row: 4, col: 4 },
      ],
      [
        { row: 4, col: 0 },
        { row: 4, col: 2 },
        { row: 4, col: 4 },
      ],
    );

    // 'c' already sits on its target, but 'a' and 'b' do not - must not
    // register as solved just because one object happens to match.
    expect(isPuzzleSolved(state)).toBe(false);

    state = applyGravity(state, 'down');

    expect(state.movables).toEqual([
      { id: 'a', row: 4, col: 0 },
      { id: 'b', row: 4, col: 2 },
      { id: 'c', row: 4, col: 4 },
    ]);
    expect(isPuzzleSolved(state)).toBe(true);
  });
});

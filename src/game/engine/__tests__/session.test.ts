import { isPuzzleSolved } from '../completion';
import {
  canUndo,
  createGameSession,
  gameSessionReducer,
  getCurrentState,
} from '../session';
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

  return { rows, cols, staticGrid, movables };
}

function positionsOf(state: GameState) {
  return state.movables.map(({ id, row, col }) => ({ id, row, col }));
}

describe('createGameSession / getCurrentState', () => {
  test('starts with the initial state as the current state', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 0 }]);
    const session = createGameSession(initial);

    expect(getCurrentState(session)).toBe(initial);
    expect(canUndo(session)).toBe(false);
  });
});

describe('gameSessionReducer - gravity', () => {
  test('moving pushes a new state onto history', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);
    const session = createGameSession(initial);

    const next = gameSessionReducer(session, { type: 'gravity', direction: 'down' });

    expect(positionsOf(getCurrentState(next))).toEqual([{ id: 'a', row: 4, col: 2 }]);
    expect(canUndo(next)).toBe(true);
  });

  test('a no-op gravity call (already at the edge) does not add a history entry', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 4, col: 2 }]);
    const session = createGameSession(initial);

    const next = gameSessionReducer(session, { type: 'gravity', direction: 'down' });

    expect(next).toBe(session);
    expect(canUndo(next)).toBe(false);
  });
});

describe('gameSessionReducer - undo', () => {
  test('undo restores the immediately previous state', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);
    let session = createGameSession(initial);

    session = gameSessionReducer(session, { type: 'gravity', direction: 'down' });
    expect(positionsOf(getCurrentState(session))).toEqual([{ id: 'a', row: 4, col: 2 }]);

    session = gameSessionReducer(session, { type: 'undo' });
    expect(positionsOf(getCurrentState(session))).toEqual([{ id: 'a', row: 0, col: 2 }]);
    expect(canUndo(session)).toBe(false);
  });

  test('undo with nothing to undo is a no-op', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 2 }]);
    const session = createGameSession(initial);

    const next = gameSessionReducer(session, { type: 'undo' });

    expect(next).toBe(session);
  });

  test('multiple undos step back through the full history, one state at a time', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 0 }]);
    let session = createGameSession(initial);

    session = gameSessionReducer(session, { type: 'gravity', direction: 'right' }); // (0,4)
    session = gameSessionReducer(session, { type: 'gravity', direction: 'down' }); // (4,4)
    expect(positionsOf(getCurrentState(session))).toEqual([{ id: 'a', row: 4, col: 4 }]);

    session = gameSessionReducer(session, { type: 'undo' });
    expect(positionsOf(getCurrentState(session))).toEqual([{ id: 'a', row: 0, col: 4 }]);

    session = gameSessionReducer(session, { type: 'undo' });
    expect(positionsOf(getCurrentState(session))).toEqual([{ id: 'a', row: 0, col: 0 }]);
    expect(canUndo(session)).toBe(false);
  });
});

describe('gameSessionReducer - restart', () => {
  test('restart returns to the original level state regardless of history depth', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 0 }]);
    let session = createGameSession(initial);

    session = gameSessionReducer(session, { type: 'gravity', direction: 'right' });
    session = gameSessionReducer(session, { type: 'gravity', direction: 'down' });
    expect(canUndo(session)).toBe(true);

    session = gameSessionReducer(session, { type: 'restart' });

    expect(getCurrentState(session)).toBe(initial);
    expect(canUndo(session)).toBe(false);
  });

  test('restart when already at the initial state is a no-op', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 0 }]);
    const session = createGameSession(initial);

    const next = gameSessionReducer(session, { type: 'restart' });

    expect(next).toBe(session);
  });

  test('undo after restart has nothing to undo to (restart clears history)', () => {
    const initial = createState(5, 5, [{ id: 'a', row: 0, col: 0 }]);
    let session = createGameSession(initial);

    session = gameSessionReducer(session, { type: 'gravity', direction: 'down' });
    session = gameSessionReducer(session, { type: 'restart' });
    session = gameSessionReducer(session, { type: 'undo' });

    expect(getCurrentState(session)).toBe(initial);
  });
});

describe('gameSessionReducer - combined with isPuzzleSolved', () => {
  test('solving via gravity, then undoing, correctly toggles completion', () => {
    const initial = createState(
      5,
      5,
      [{ id: 'a', row: 0, col: 2 }],
      [{ row: 4, col: 2 }],
    );
    let session = createGameSession(initial);

    expect(isPuzzleSolved(getCurrentState(session))).toBe(false);

    session = gameSessionReducer(session, { type: 'gravity', direction: 'down' });
    expect(isPuzzleSolved(getCurrentState(session))).toBe(true);

    session = gameSessionReducer(session, { type: 'undo' });
    expect(isPuzzleSolved(getCurrentState(session))).toBe(false);
  });
});

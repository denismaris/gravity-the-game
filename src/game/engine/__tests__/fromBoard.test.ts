import { CellType, createEmptyBoard, setCell } from '../../models';
import { createGameStateFromBoard } from '../fromBoard';
import { StaticCellType } from '../types';

describe('createGameStateFromBoard', () => {
  test('extracts movable cells into tracked objects and clears them from the static grid', () => {
    let board = createEmptyBoard(4);
    board = setCell(board, { row: 1, col: 2 }, CellType.Movable);
    board = setCell(board, { row: 3, col: 0 }, CellType.Target);
    board = setCell(board, { row: 2, col: 2 }, CellType.Obstacle);

    const state = createGameStateFromBoard(board);

    expect(state.rows).toBe(4);
    expect(state.cols).toBe(4);
    expect(state.movables).toEqual([{ id: 'movable-1-2', row: 1, col: 2 }]);
    expect(state.staticGrid[1][2]).toBe(StaticCellType.Empty);
    expect(state.staticGrid[3][0]).toBe(StaticCellType.Target);
    expect(state.staticGrid[2][2]).toBe(StaticCellType.Obstacle);
  });
});

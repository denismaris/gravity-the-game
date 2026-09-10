import {
  Board,
  CellType,
  DEFAULT_GRID_SIZE,
  GridPosition,
  createEmptyBoard,
  setCell,
} from '../models';

/**
 * A single static, hand-authored board used to prove out the board renderer.
 *
 * IMPORTANT: this is level DATA, not level generation. Procedural/level
 * loading logic will be introduced in a later step - for now this just
 * gives the renderer something real to draw.
 */
export function createDemoLevel(): Board {
  let board = createEmptyBoard(DEFAULT_GRID_SIZE);

  // Two movable objects, each with its own matching target directly below
  // it in the same column. Obstacles sit just under each target so a
  // single "down" gravity move drops both objects exactly onto their
  // targets, solving the puzzle.
  board = setCell(board, { row: 1, col: 1 }, CellType.Movable);
  board = setCell(board, { row: 1, col: 5 }, CellType.Movable);
  board = setCell(board, { row: 5, col: 1 }, CellType.Target);
  board = setCell(board, { row: 5, col: 5 }, CellType.Target);

  const obstacles: GridPosition[] = [
    { row: 0, col: 0 },
    { row: 1, col: 3 },
    { row: 2, col: 3 },
    { row: 4, col: 3 },
    { row: 5, col: 3 },
    { row: 6, col: 1 },
    { row: 6, col: 5 },
    { row: 6, col: 6 },
  ];

  for (const position of obstacles) {
    board = setCell(board, position, CellType.Obstacle);
  }

  return board;
}

export const demoLevel: Board = createDemoLevel();

import { Board, CellType } from '../models';
import { GameState, MovableObject, StaticCellType } from './types';

function toStaticCellType(cellType: CellType): StaticCellType {
  switch (cellType) {
    case CellType.Obstacle:
      return StaticCellType.Obstacle;
    case CellType.Target:
      return StaticCellType.Target;
    case CellType.Empty:
    case CellType.Movable:
    default:
      // A cell a movable object starts on has no static content once the
      // object is tracked separately - the ground underneath is empty.
      return StaticCellType.Empty;
  }
}

/**
 * Converts a hand-authored `Board` (level layout data from src/game/levels)
 * into a runtime `GameState` the gravity engine can operate on: each
 * `Movable` cell becomes a tracked `MovableObject`, and everything else
 * becomes the static grid.
 */
export function createGameStateFromBoard(board: Board): GameState {
  const staticGrid = board.cells.map(row => row.map(toStaticCellType));
  const movables: MovableObject[] = [];

  board.cells.forEach((row, rowIndex) => {
    row.forEach((cellType, colIndex) => {
      if (cellType === CellType.Movable) {
        movables.push({
          id: `movable-${rowIndex}-${colIndex}`,
          row: rowIndex,
          col: colIndex,
        });
      }
    });
  });

  return { rows: board.rows, cols: board.cols, staticGrid, movables };
}

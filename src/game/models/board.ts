/**
 * Core domain types for the Gravity puzzle board.
 *
 * This file has ZERO dependencies on React, React Native or Skia.
 * It describes *what* a board is, not how it is displayed or interacted
 * with. The rendering layer (src/game/rendering) reads these types to draw
 * the board; the future engine (src/game/engine) will read/write them to
 * simulate gravity and puzzle rules.
 */

/** The four basic building blocks of a Gravity board. */
export enum CellType {
  Empty = 'empty',
  Movable = 'movable',
  Target = 'target',
  Obstacle = 'obstacle',
}

/** A single row/column coordinate on the board grid. */
export interface GridPosition {
  readonly row: number;
  readonly col: number;
}

/**
 * A square (or rectangular) grid of cells.
 * `cells` is indexed as `cells[row][col]`.
 */
export interface Board {
  readonly rows: number;
  readonly cols: number;
  readonly cells: ReadonlyArray<ReadonlyArray<CellType>>;
}

/** Default board dimensions for the first playable prototype. */
export const DEFAULT_GRID_SIZE = 7;

/** Creates an empty square board of the given size, filled with `Empty` cells. */
export function createEmptyBoard(size: number = DEFAULT_GRID_SIZE): Board {
  const cells: CellType[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => CellType.Empty),
  );

  return { rows: size, cols: size, cells };
}

/** Returns a new board with a single cell replaced (immutable update). */
export function setCell(
  board: Board,
  position: GridPosition,
  type: CellType,
): Board {
  const cells = board.cells.map((row, rowIndex) =>
    rowIndex === position.row ? row.map((cell, colIndex) => (colIndex === position.col ? type : cell)) : row,
  );

  return { ...board, cells };
}

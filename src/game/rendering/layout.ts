/**
 * Pure geometry helpers for laying out a square grid inside a square pixel
 * area. No React, React Native or Skia imports here on purpose - this is
 * plain math that is easy to unit test and safe to reuse from anywhere
 * (including, eventually, the engine's own tests).
 */

export interface BoardLayout {
  /** Pixel size of the whole square board (width === height). */
  readonly boardSize: number;
  /** Pixel size of a single square cell. */
  readonly cellSize: number;
  /** Number of columns/rows in the grid. */
  readonly gridSize: number;
}

/** Computes the layout for a `gridSize` x `gridSize` board that fits in `availableSize` pixels. */
export function computeBoardLayout(gridSize: number, availableSize: number): BoardLayout {
  const boardSize = Math.max(0, Math.floor(availableSize));
  const cellSize = gridSize > 0 ? boardSize / gridSize : 0;

  return { boardSize, cellSize, gridSize };
}

/** Top-left pixel coordinate of a given cell. */
export function getCellOrigin(layout: BoardLayout, row: number, col: number) {
  return {
    x: col * layout.cellSize,
    y: row * layout.cellSize,
  };
}

/** Center pixel coordinate of a given cell (useful for circular pieces). */
export function getCellCenter(layout: BoardLayout, row: number, col: number) {
  const origin = getCellOrigin(layout, row, col);
  return {
    x: origin.x + layout.cellSize / 2,
    y: origin.y + layout.cellSize / 2,
  };
}

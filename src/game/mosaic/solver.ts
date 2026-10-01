import { cellKey, distinctOrientations, isMosaicSolved, occupancy, orient, placedCells, shapeKey } from './logic';
import { MosaicCell, MosaicOrientation, MosaicPlacement, MosaicPuzzle, MosaicState } from './types';

interface Variant {
  readonly orientation: MosaicOrientation;
  readonly cells: ReadonlyArray<MosaicCell>;
}

/** A shape's identity however it is turned - the smallest of its
 * orientation keys - so two pieces that are the same shape can be told
 * apart from two that only look alike in one orientation. */
function shapeClass(cells: ReadonlyArray<MosaicCell>, allowFlip: boolean): string {
  return distinctOrientations(cells, allowFlip)
    .map(v => shapeKey(v.cells))
    .sort()[0];
}

export interface TilingCount {
  /** Distinct fillings found, up to the limit. */
  readonly solutions: number;
  /** Search steps taken - how much trying the board demands. */
  readonly nodes: number;
  /** The first filling found, if any. */
  readonly first: ReadonlyArray<MosaicPlacement> | null;
}

/**
 * Counts the ways the pieces fill the picture exactly, up to `limit`, by
 * always covering the first empty square in reading order: every piece
 * that could cover it is tried in each distinct orientation, anchored so
 * its own first square lands there. Two pieces of the same shape are
 * interchangeable, so only the earliest unused one of a shape is ever
 * tried - otherwise swapping identical pieces would count as a second
 * solution to a puzzle that has only one.
 */
export function countTilings(puzzle: MosaicPuzzle, limit = 2): TilingCount {
  const variants: Variant[][] = puzzle.pieces.map(piece => distinctOrientations(piece.cells, puzzle.allowFlip));
  const classes = puzzle.pieces.map(piece => shapeClass(piece.cells, puzzle.allowFlip));
  const covered = puzzle.silhouette.map(line => line.map(inside => !inside));
  const used = puzzle.pieces.map(() => false);
  const placement: Array<MosaicPlacement | null> = puzzle.pieces.map(() => null);

  let solutions = 0;
  let nodes = 0;
  let first: MosaicPlacement[] | null = null;

  const firstEmpty = (): MosaicCell | null => {
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) if (!covered[row][col]) return { row, col };
    }
    return null;
  };

  const search = (): void => {
    if (solutions >= limit) return;
    const target = firstEmpty();
    if (!target) {
      solutions += 1;
      if (!first) first = placement.map(p => p!);
      return;
    }
    const triedClasses = new Set<string>();
    for (let i = 0; i < puzzle.pieces.length; i += 1) {
      if (used[i] || triedClasses.has(classes[i])) continue;
      triedClasses.add(classes[i]);
      for (const variant of variants[i]) {
        nodes += 1;
        const anchor = variant.cells[0];
        const row = target.row - anchor.row;
        const col = target.col - anchor.col;
        const cells = variant.cells.map(c => ({ row: c.row + row, col: c.col + col }));
        const fits = cells.every(
          c => c.row >= 0 && c.col >= 0 && c.row < puzzle.rows && c.col < puzzle.cols && !covered[c.row][c.col],
        );
        if (!fits) continue;
        for (const c of cells) covered[c.row][c.col] = true;
        used[i] = true;
        placement[i] = { ...variant.orientation, row, col };
        search();
        placement[i] = null;
        used[i] = false;
        for (const c of cells) covered[c.row][c.col] = false;
        if (solutions >= limit) return;
      }
    }
  };

  search();
  return { solutions, nodes, first };
}

/**
 * Sets one piece where the solution has it. Prefers a piece already on the
 * board in the wrong place (the mistake worth correcting), then the
 * largest piece still in the tray (the one that does the most); any piece
 * sitting in its way goes back to the tray.
 */
export function revealMosaicHint(puzzle: MosaicPuzzle, state: MosaicState, chosen?: number): { state: MosaicState; index: number } | null {
  if (isMosaicSolved(puzzle, state)) return null;
  const correct = (index: number): boolean => {
    const piece = state.pieces[index];
    if (!piece.at) return false;
    const target = new Set(placedCells(puzzle, index, puzzle.solution[index]).map(c => cellKey(c.row, c.col)));
    const now = placedCells(puzzle, index, { ...piece, row: piece.at.row, col: piece.at.col });
    return now.length === target.size && now.every(c => target.has(cellKey(c.row, c.col)));
  };
  const misplaced = state.pieces.findIndex((piece, i) => piece.at !== null && !correct(i));
  let index = chosen ?? misplaced;
  if (index === -1) {
    let best = -1;
    state.pieces.forEach((piece, i) => {
      if (piece.at === null && (best === -1 || puzzle.pieces[i].cells.length > puzzle.pieces[best].cells.length)) best = i;
    });
    index = best;
  }
  if (index === -1) return null;

  const goal = puzzle.solution[index];
  const goalCells = new Set(placedCells(puzzle, index, goal).map(c => cellKey(c.row, c.col)));
  const taken = occupancy(puzzle, state);
  const displaced = new Set<number>();
  for (const key of goalCells) {
    const owner = taken.get(key);
    if (owner !== undefined && owner !== index) displaced.add(owner);
  }
  const pieces = state.pieces.map((piece, i) => {
    if (i === index) return { rotation: goal.rotation, flipped: goal.flipped, at: { row: goal.row, col: goal.col } };
    if (displaced.has(i)) return { ...piece, at: null };
    return piece;
  });
  return { state: { pieces }, index };
}

export function assertValidMosaic(puzzle: MosaicPuzzle): void {
  const { id } = puzzle;
  if (puzzle.silhouette.length !== puzzle.rows || puzzle.silhouette.some(line => line.length !== puzzle.cols)) {
    throw new Error(`Mosaic ${id}: silhouette is not ${puzzle.rows}x${puzzle.cols}.`);
  }
  if (puzzle.pieces.length !== puzzle.solution.length || puzzle.pieces.length !== puzzle.start.length) {
    throw new Error(`Mosaic ${id}: pieces, solution and start disagree in length.`);
  }
  // The solution must cover the picture exactly, once.
  const seen = new Set<string>();
  puzzle.solution.forEach((placement, index) => {
    for (const c of placedCells(puzzle, index, placement)) {
      const key = cellKey(c.row, c.col);
      if (!puzzle.silhouette[c.row]?.[c.col]) throw new Error(`Mosaic ${id}: piece ${index} sits outside the picture.`);
      if (seen.has(key)) throw new Error(`Mosaic ${id}: two pieces overlap at ${key}.`);
      seen.add(key);
    }
  });
  const size = puzzle.silhouette.reduce((n, line) => n + line.filter(Boolean).length, 0);
  if (seen.size !== size) throw new Error(`Mosaic ${id}: the solution leaves ${size - seen.size} squares uncovered.`);
  if (countTilings(puzzle, 2).solutions !== 1) throw new Error(`Mosaic ${id}: does not fill in exactly one way.`);
}

/** Every piece's shape turned as the solution has it - for tests. */
export function solutionShapes(puzzle: MosaicPuzzle): MosaicCell[][] {
  return puzzle.pieces.map((piece, i) => orient(piece.cells, puzzle.solution[i]));
}

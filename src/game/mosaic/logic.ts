import { MosaicCell, MosaicOrientation, MosaicPlacement, MosaicPuzzle, MosaicState } from './types';

/** Puts a shape's smallest row and column at 0, sorted in reading order -
 * so two orientations that look the same compare equal as strings. */
export function normalise(cells: ReadonlyArray<MosaicCell>): MosaicCell[] {
  const minRow = Math.min(...cells.map(c => c.row));
  const minCol = Math.min(...cells.map(c => c.col));
  return cells
    .map(c => ({ row: c.row - minRow, col: c.col - minCol }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** A shape turned `rotation` quarter-turns clockwise, after mirroring it
 * left-to-right when `flipped`. Always normalised. */
export function orient(cells: ReadonlyArray<MosaicCell>, orientation: MosaicOrientation): MosaicCell[] {
  let out = cells.map(c => ({ row: c.row, col: orientation.flipped ? -c.col : c.col }));
  const turns = ((orientation.rotation % 4) + 4) % 4;
  for (let i = 0; i < turns; i += 1) out = out.map(c => ({ row: c.col, col: -c.row }));
  return normalise(out);
}

export function shapeKey(cells: ReadonlyArray<MosaicCell>): string {
  return normalise(cells)
    .map(c => `${c.row},${c.col}`)
    .join(';');
}

/** Every distinct orientation of a shape (1 to 8 of them), each with the
 * turn that produces it. */
export function distinctOrientations(cells: ReadonlyArray<MosaicCell>, allowFlip: boolean): Array<{ orientation: MosaicOrientation; cells: MosaicCell[] }> {
  const seen = new Set<string>();
  const out: Array<{ orientation: MosaicOrientation; cells: MosaicCell[] }> = [];
  for (const flipped of allowFlip ? [false, true] : [false]) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const shaped = orient(cells, { rotation, flipped });
      const key = shapeKey(shaped);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ orientation: { rotation, flipped }, cells: shaped });
    }
  }
  return out;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Loose pieces start in the tray, turned at random; set pieces start in
 * their solution place. */
export function initialMosaicState(puzzle: MosaicPuzzle): MosaicState {
  return {
    pieces: puzzle.start.map((o, i) => {
      if (!puzzle.fixed[i]) return { rotation: o.rotation, flipped: o.flipped, at: null };
      const goal = puzzle.solution[i];
      return { rotation: goal.rotation, flipped: goal.flipped, at: { row: goal.row, col: goal.col } };
    }),
  };
}

/**
 * Which pieces start already set - the clues that make a picture
 * approachable. A share of the pieces by tier (half on easy, fewer as the
 * boards get harder), chosen as the *largest, most awkward* pieces and
 * spread apart rather than clumped: a big open expanse is where a tiling
 * puzzle is hardest to read, so setting its bulkiest pieces breaks it into
 * small pockets, and the narrow places - the satisfying ones - are left
 * for the player. Deterministic from the puzzle alone.
 *
 * Every clue is taken from the one solution, so the puzzle still fills in
 * exactly one way.
 */
// Lowered once (from 0.5 / 0.4 / 0.35) after the second playtest: with
// that many pieces already set, the pictures had become too easy.
export const FIXED_SHARE = { easy: 0.4, medium: 0.3, hard: 0.25 } as const;

export function chooseFixedPieces(puzzle: Omit<MosaicPuzzle, 'fixed'>): boolean[] {
  const n = puzzle.pieces.length;
  const want = Math.max(1, Math.round(n * FIXED_SHARE[puzzle.difficulty]));
  const cellsOf = (i: number) => placedCells(puzzle as MosaicPuzzle, i, puzzle.solution[i]);
  const awkward = (i: number): number => {
    const cells = puzzle.pieces[i].cells;
    const w = Math.max(...cells.map(c => c.col)) + 1;
    const h = Math.max(...cells.map(c => c.row)) + 1;
    // Bigger first; among equals, the ones that fill their box least (an
    // L or a T is harder to place than a bar or a block).
    return cells.length * 10 - cells.length / (w * h);
  };
  const order = puzzle.pieces.map((_p, i) => i).sort((a, b) => awkward(b) - awkward(a) || a - b);
  const fixed = new Array<boolean>(n).fill(false);
  const touches = (i: number): boolean => {
    const mine = cellsOf(i);
    return fixed.some((on, j) => {
      if (!on) return false;
      const theirs = new Set(cellsOf(j).map(c => cellKey(c.row, c.col)));
      return mine.some(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => theirs.has(cellKey(c.row + dr, c.col + dc))));
    });
  };
  let chosen = 0;
  // Spread first: never beside another clue...
  for (const i of order) {
    if (chosen >= want) break;
    if (!touches(i)) {
      fixed[i] = true;
      chosen += 1;
    }
  }
  // ...then, if the picture is too tight for that, whatever is left.
  for (const i of order) {
    if (chosen >= want) break;
    if (!fixed[i]) {
      fixed[i] = true;
      chosen += 1;
    }
  }
  return fixed;
}

/** The board squares a placed piece covers. */
export function placedCells(puzzle: MosaicPuzzle, index: number, placement: MosaicPlacement): MosaicCell[] {
  return orient(puzzle.pieces[index].cells, placement).map(c => ({ row: c.row + placement.row, col: c.col + placement.col }));
}

/** Which piece covers each square right now, keyed by `cellKey`. */
export function occupancy(puzzle: MosaicPuzzle, state: MosaicState): Map<string, number> {
  const map = new Map<string, number>();
  state.pieces.forEach((piece, index) => {
    if (!piece.at) return;
    for (const cell of placedCells(puzzle, index, { ...piece, row: piece.at.row, col: piece.at.col })) {
      map.set(cellKey(cell.row, cell.col), index);
    }
  });
  return map;
}

/** Whether piece `index`, turned as it is now, fits with its top-left at
 * (`row`, `col`): every square inside the picture and none already taken
 * by another piece. */
export function canPlace(puzzle: MosaicPuzzle, state: MosaicState, index: number, row: number, col: number): boolean {
  const piece = state.pieces[index];
  const taken = occupancy(puzzle, state);
  return placedCells(puzzle, index, { ...piece, row, col }).every(cell => {
    if (cell.row < 0 || cell.col < 0 || cell.row >= puzzle.rows || cell.col >= puzzle.cols) return false;
    if (!puzzle.silhouette[cell.row][cell.col]) return false;
    const owner = taken.get(cellKey(cell.row, cell.col));
    return owner === undefined || owner === index;
  });
}

function withPiece(state: MosaicState, index: number, change: Partial<MosaicState['pieces'][number]>): MosaicState {
  return { pieces: state.pieces.map((piece, i) => (i === index ? { ...piece, ...change } : piece)) };
}

export function placePiece(puzzle: MosaicPuzzle, state: MosaicState, index: number, row: number, col: number): MosaicState {
  if (!canPlace(puzzle, state, index, row, col)) return state;
  return withPiece(state, index, { at: { row, col } });
}

/** Back to the tray. A set piece never leaves the picture. */
export function liftPiece(puzzle: MosaicPuzzle, state: MosaicState, index: number): MosaicState {
  if (!state.pieces[index].at || puzzle.fixed[index]) return state;
  return withPiece(state, index, { at: null });
}

/** A quarter turn clockwise - only in the tray; a placed piece is lifted
 * first. */
export function rotatePiece(puzzle: MosaicPuzzle, state: MosaicState, index: number): MosaicState {
  const piece = state.pieces[index];
  if (piece.at || puzzle.fixed[index]) return state;
  return withPiece(state, index, { rotation: (piece.rotation + 1) % 4 });
}

export function flipPiece(puzzle: MosaicPuzzle, state: MosaicState, index: number): MosaicState {
  const piece = state.pieces[index];
  if (!puzzle.allowFlip || piece.at || puzzle.fixed[index]) return state;
  return withPiece(state, index, { flipped: !piece.flipped });
}

export function silhouetteSize(puzzle: MosaicPuzzle): number {
  return puzzle.silhouette.reduce((n, line) => n + line.filter(Boolean).length, 0);
}

/** Squares of the picture still uncovered. */
export function squaresLeft(puzzle: MosaicPuzzle, state: MosaicState): number {
  return silhouetteSize(puzzle) - occupancy(puzzle, state).size;
}

/** Solved when every square of the picture is covered. The pieces' squares
 * add up to exactly the picture, so this is also "every piece placed". */
/** Pieces still to place - the loose ones not yet in the picture. */
export function piecesLeft(puzzle: MosaicPuzzle, state: MosaicState): number {
  return state.pieces.filter((piece, i) => !puzzle.fixed[i] && piece.at === null).length;
}

export function isMosaicSolved(puzzle: MosaicPuzzle, state: MosaicState): boolean {
  return squaresLeft(puzzle, state) === 0;
}

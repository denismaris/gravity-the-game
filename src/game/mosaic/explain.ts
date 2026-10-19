import { HintReason } from '../hints';
import { cellKey, distinctOrientations, occupancy, placedCells, shapeKey } from './logic';
import { revealMosaicHint } from './solver';
import { MosaicCell, MosaicPlacement, MosaicPuzzle, MosaicState } from './types';

/** A shape's name whichever way it is turned: two pieces with the same
 * one are interchangeable in the picture. */
function shapeClass(puzzle: MosaicPuzzle, index: number): string {
  return distinctOrientations(puzzle.pieces[index].cells, puzzle.allowFlip)
    .map(o => shapeKey(o.cells))
    .sort()[0];
}

/** How piece `index` would cover exactly `cells`, if it can. */
function placementCovering(puzzle: MosaicPuzzle, index: number, cells: ReadonlyArray<MosaicCell>): MosaicPlacement | null {
  const row = Math.min(...cells.map(c => c.row));
  const col = Math.min(...cells.map(c => c.col));
  const want = new Set(cells.map(c => cellKey(c.row, c.col)));
  for (const { orientation } of distinctOrientations(puzzle.pieces[index].cells, puzzle.allowFlip)) {
    const placement = { ...orientation, row, col };
    const got = placedCells(puzzle, index, placement);
    if (got.length === want.size && got.every(c => want.has(cellKey(c.row, c.col)))) return placement;
  }
  return null;
}

/**
 * The picture's answer, re-dealt to the player's own pieces. A picture is
 * finished when every square is covered, so two pieces of the same shape
 * are interchangeable - but the stored answer names one piece per place,
 * and a hint read from it called a same-shaped piece set in its twin's
 * place "wrong" and swapped the two: a hint spent for nothing. Here a
 * placed piece that fills any place of its own shape owns that place, and
 * the pieces left over take the places of their shape that are left.
 */
export function answerFor(puzzle: MosaicPuzzle, state: MosaicState): MosaicPuzzle {
  const slots = puzzle.pieces.map((_p, k) => placedCells(puzzle, k, puzzle.solution[k]));
  const slotKey = slots.map(cells => cells.map(c => cellKey(c.row, c.col)).sort().join('|'));
  const classOf = puzzle.pieces.map((_p, i) => shapeClass(puzzle, i));
  const owner = new Map<number, number>(); // slot -> piece
  const solution: MosaicPlacement[] = [...puzzle.solution];
  const done = new Set<number>();
  // Placed pieces first, each on the place it fills (if it fills one).
  state.pieces.forEach((piece, i) => {
    if (!piece.at) return;
    const now = placedCells(puzzle, i, { ...piece, row: piece.at.row, col: piece.at.col }).map(c => cellKey(c.row, c.col)).sort().join('|');
    const k = slotKey.findIndex((key, slot) => key === now && classOf[slot] === classOf[i] && !owner.has(slot));
    if (k === -1) return;
    owner.set(k, i);
    done.add(i);
    solution[i] = { rotation: piece.rotation, flipped: piece.flipped, row: piece.at.row, col: piece.at.col };
  });
  // Every other piece: its own place if that is free, else a free one of
  // its shape.
  const rest = puzzle.pieces.map((_p, i) => i).filter(i => !done.has(i));
  for (const i of rest) {
    const free = (k: number) => !owner.has(k) && classOf[k] === classOf[i];
    const k = free(i) ? i : slots.findIndex((_c, slot) => free(slot));
    if (k === -1) continue;
    const placement = k === i ? puzzle.solution[i] : placementCovering(puzzle, i, slots[k]);
    if (!placement) continue;
    owner.set(k, i);
    solution[i] = placement;
  }
  return { ...puzzle, solution };
}

/**
 * Sets the piece the picture is readiest for: one on the board in the
 * wrong place first; otherwise the tray piece whose place borders the
 * most squares already covered (or the picture's edge) - the space the
 * player has been building toward - rather than simply the biggest.
 */
export function explainMosaicHint(original: MosaicPuzzle, state: MosaicState): ({ state: MosaicState; index: number } & HintReason) | null {
  const puzzle = answerFor(original, state);
  const taken = occupancy(puzzle, state);
  const correctlyPlaced = (i: number) => {
    const piece = state.pieces[i];
    if (!piece.at) return false;
    const target = new Set(placedCells(puzzle, i, puzzle.solution[i]).map(c => cellKey(c.row, c.col)));
    const now = placedCells(puzzle, i, { ...piece, row: piece.at.row, col: piece.at.col });
    return now.length === target.size && now.every(c => target.has(cellKey(c.row, c.col)));
  };
  const misplaced = state.pieces.findIndex((p, i) => p.at !== null && !correctlyPlaced(i));
  if (misplaced !== -1) {
    const hint = revealMosaicHint(puzzle, state, misplaced);
    return hint && { ...hint, kind: 'fix', reason: "This piece was in the wrong place: with it there, the rest of the picture can't be filled. It's now where it belongs.", tip: 'Every piece has exactly one home. If the last gaps will not fill, one piece placed earlier is usually in the wrong spot.' };
  }
  const silhouette = new Set<string>();
  puzzle.pieces.forEach((_p, i) => placedCells(puzzle, i, puzzle.solution[i]).forEach(c => silhouette.add(cellKey(c.row, c.col))));
  let best = -1;
  let bestScore = -1;
  state.pieces.forEach((p, i) => {
    if (p.at !== null) return;
    let score = 0;
    for (const c of placedCells(puzzle, i, puzzle.solution[i])) {
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const key = cellKey(c.row + dr, c.col + dc);
        if (taken.has(key) || !silhouette.has(key)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best === -1) return null;
  const hint = revealMosaicHint(puzzle, state, best);
  return hint && { ...hint, kind: 'rule', reason: 'Look at the gap next to your finished tiles: of all the pieces in the tray, only this one fits its shape, and only turned this way.', tip: 'Fill the outline from the edges and corners inward, and place the awkward shapes early while there is still room for them.' };
}

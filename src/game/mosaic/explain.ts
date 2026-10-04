import { HintReason } from '../hints';
import { cellKey, occupancy, placedCells } from './logic';
import { revealMosaicHint } from './solver';
import { MosaicPuzzle, MosaicState } from './types';

/**
 * Sets the piece the picture is readiest for: one on the board in the
 * wrong place first; otherwise the tray piece whose place borders the
 * most squares already covered (or the picture's edge) - the space the
 * player has been building toward - rather than simply the biggest.
 */
export function explainMosaicHint(puzzle: MosaicPuzzle, state: MosaicState): ({ state: MosaicState; index: number } & HintReason) | null {
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

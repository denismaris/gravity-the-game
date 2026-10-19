import { distinctOrientations, initialMosaicState, placedCells, shapeKey } from '../logic';
import { MOSAIC } from '../puzzles';
import { explainMosaicHint } from '../explain';
import { MosaicState } from '../types';

const classOf = (cells: Parameters<typeof distinctOrientations>[0], flip: boolean) =>
  distinctOrientations(cells, flip).map(o => shapeKey(o.cells)).sort()[0];

describe('Mosaic hints and same-shaped pieces', () => {
  test('a piece set in its twin\'s place is left alone: the hint fills a place that is still open', () => {
    let checked = 0;
    for (const puzzle of MOSAIC) {
      const start = initialMosaicState(puzzle);
      // Two loose pieces of the same shape.
      const loose = puzzle.pieces.map((_p, i) => i).filter(i => start.pieces[i].at === null);
      const pair = loose.flatMap(a => loose.filter(b => b > a && classOf(puzzle.pieces[a].cells, puzzle.allowFlip) === classOf(puzzle.pieces[b].cells, puzzle.allowFlip)).map(b => [a, b] as const))[0];
      if (!pair) continue;
      const [a, b] = pair;
      // Put piece `a` exactly where `b` belongs.
      const slot = placedCells(puzzle, b, puzzle.solution[b]);
      const want = new Set(slot.map(c => `${c.row}:${c.col}`));
      const row = Math.min(...slot.map(c => c.row));
      const col = Math.min(...slot.map(c => c.col));
      const fit = distinctOrientations(puzzle.pieces[a].cells, puzzle.allowFlip).find(({ orientation }) => {
        const got = placedCells(puzzle, a, { ...orientation, row, col });
        return got.length === want.size && got.every(c => want.has(`${c.row}:${c.col}`));
      });
      if (!fit) continue;
      const state: MosaicState = { pieces: start.pieces.map((p, i) => (i === a ? { ...fit.orientation, at: { row, col } } : p)) };
      const hint = explainMosaicHint(puzzle, state);
      expect(hint).not.toBeNull();
      expect(hint!.kind).not.toBe('fix');
      expect(hint!.state.pieces[a]).toEqual(state.pieces[a]);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

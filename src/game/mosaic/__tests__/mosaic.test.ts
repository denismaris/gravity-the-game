import {
  assertValidMosaic,
  canPlace,
  FIXED_SHARE,
  countTilings,
  generateMosaic,
  initialMosaicState,
  isMosaicSolved,
  liftPiece,
  MOSAIC,
  MosaicPuzzle,
  orient,
  piecesLeft,
  placePiece,
  revealMosaicHint,
  rotatePiece,
  shapeKey,
  SILHOUETTES,
  silhouetteGrid,
  squaresLeft,
} from '..';
import { PuzzleDifficulty } from '../../puzzleDifficulty';

/** A 2x3 bar filled by an L (3 squares) and its partner (3 squares). */
const FIXTURE: MosaicPuzzle = {
  id: 'mosaic-fixture',
  difficulty: 'easy',
  subject: 'bar',
  theme: 'hearth',
  rows: 2,
  cols: 3,
  silhouette: [
    [true, true, true],
    [true, true, true],
  ],
  pieces: [
    { id: 'p0', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }], color: 0 },
    { id: 'p1', cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }], color: 1 },
  ],
  solution: [
    { rotation: 0, flipped: false, row: 0, col: 0 },
    { rotation: 0, flipped: false, row: 0, col: 1 },
  ],
  start: [
    { rotation: 1, flipped: false },
    { rotation: 0, flipped: false },
  ],
  allowFlip: false,
  fixed: [false, false],
};

describe('shapes', () => {
  test('four quarter turns come back to the start, and a turn really turns', () => {
    const l = [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }];
    expect(shapeKey(orient(l, { rotation: 4, flipped: false }))).toBe(shapeKey(l));
    expect(shapeKey(orient(l, { rotation: 1, flipped: false }))).not.toBe(shapeKey(l));
  });
});

describe('play', () => {
  test('a piece fits only inside the picture and never over another', () => {
    let state = initialMosaicState(FIXTURE);
    // Piece 0 starts turned a quarter, so it does not fit the corner it
    // belongs in until it is turned back.
    for (let i = 0; i < 3; i += 1) state = rotatePiece(FIXTURE, state, 0);
    expect(canPlace(FIXTURE, state, 0, 0, 0)).toBe(true);
    expect(canPlace(FIXTURE, state, 0, 1, 1)).toBe(false); // off the edge
    state = placePiece(FIXTURE, state, 0, 0, 0);
    expect(canPlace(FIXTURE, state, 1, 0, 0)).toBe(false); // overlaps
  });

  test('covering every square solves it; lifting a piece undoes that', () => {
    let state = initialMosaicState(FIXTURE);
    for (let i = 0; i < 3; i += 1) state = rotatePiece(FIXTURE, state, 0);
    state = placePiece(FIXTURE, state, 0, 0, 0);
    expect(squaresLeft(FIXTURE, state)).toBe(3);
    state = placePiece(FIXTURE, state, 1, 0, 1);
    expect(isMosaicSolved(FIXTURE, state)).toBe(true);
    expect(isMosaicSolved(FIXTURE, liftPiece(FIXTURE, state, 1))).toBe(false);
  });

  test('a placed piece does not turn - it has to be lifted first', () => {
    let state = initialMosaicState(FIXTURE);
    for (let i = 0; i < 3; i += 1) state = rotatePiece(FIXTURE, state, 0);
    state = placePiece(FIXTURE, state, 0, 0, 0);
    expect(rotatePiece(FIXTURE, state, 0)).toBe(state);
  });

  test('a hint sets a piece where the solution has it, clearing its way', () => {
    let state = initialMosaicState(FIXTURE);
    // Put piece 1 somewhere wrong-but-legal first... there is none on this
    // board, so check the plain case: an empty board takes a hint.
    const hint = revealMosaicHint(FIXTURE, state)!;
    expect(hint.state.pieces[hint.index].at).toEqual({ row: FIXTURE.solution[hint.index].row, col: FIXTURE.solution[hint.index].col });
    state = hint.state;
    const second = revealMosaicHint(FIXTURE, state)!;
    expect(isMosaicSolved(FIXTURE, second.state)).toBe(true);
    expect(revealMosaicHint(FIXTURE, second.state)).toBeNull();
  });
});

describe('the pictures', () => {
  /** Every picture must be one piece of paper - a square cut off from the
   * rest could never be covered, and that is exactly the mistake the first
   * blossom and cat drawings made. */
  test.each((['easy', 'medium', 'hard'] as PuzzleDifficulty[]).flatMap(d => SILHOUETTES[d].map(s => [s.key, s] as const)))(
    '%s is one connected shape',
    (_key, silhouette) => {
      const grid = silhouetteGrid(silhouette);
      const cells: Array<[number, number]> = [];
      grid.forEach((line, r) => line.forEach((on, c) => on && cells.push([r, c])));
      const seen = new Set<string>([`${cells[0][0]}:${cells[0][1]}`]);
      const stack = [cells[0]];
      while (stack.length) {
        const [r, c] = stack.pop()!;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const key = `${r + dr}:${c + dc}`;
          if (grid[r + dr]?.[c + dc] && !seen.has(key)) {
            seen.add(key);
            stack.push([r + dr, c + dc]);
          }
        }
      }
      expect(seen.size).toBe(cells.length);
    },
  );
});

describe('pieces already set', () => {
  /** "Too hard" was the first playtest verdict: a picture with every piece
   * loose is a big open tiling search. A share of each board starts set. */
  test('each tier starts with its share of pieces already set in place', () => {
    for (const puzzle of MOSAIC) {
      const set = puzzle.fixed.filter(Boolean).length;
      expect(set).toBe(Math.max(1, Math.round(puzzle.pieces.length * FIXED_SHARE[puzzle.difficulty])));
      expect(set).toBeLessThan(puzzle.pieces.length);
    }
  });

  test('a set piece opens in its solution place and can be neither lifted nor turned', () => {
    for (const puzzle of MOSAIC) {
      const state = initialMosaicState(puzzle);
      puzzle.fixed.forEach((isSet, i) => {
        if (!isSet) {
          expect(state.pieces[i].at).toBeNull();
          return;
        }
        expect(state.pieces[i].at).toEqual({ row: puzzle.solution[i].row, col: puzzle.solution[i].col });
        expect(liftPiece(puzzle, state, i)).toBe(state);
        expect(rotatePiece(puzzle, state, i)).toBe(state);
      });
      expect(piecesLeft(puzzle, state)).toBe(puzzle.fixed.filter(isSet => !isSet).length);
    }
  });

  /** Clues are taken from the one solution, so they can only ever narrow
   * it - but that is exactly the kind of claim worth checking. */
  test('every board still fills in exactly one way from its opening position', () => {
    for (const puzzle of MOSAIC) expect(countTilings(puzzle, 2).solutions).toBe(1);
  });
});

describe('the shipped pool', () => {
  test('has twenty boards, one per picture, with unique ids', () => {
    expect(MOSAIC).toHaveLength(20);
    expect(new Set(MOSAIC.map(p => p.id)).size).toBe(20);
    expect(new Set(MOSAIC.map(p => p.subject)).size).toBe(20);
  });

  test.each(MOSAIC.map(p => [p.id, p] as const))('%s fills its picture in exactly one way', (_id, puzzle) => {
    expect(() => assertValidMosaic(puzzle)).not.toThrow();
    expect(countTilings(puzzle, 2).solutions).toBe(1);
    expect(isMosaicSolved(puzzle, initialMosaicState(puzzle))).toBe(false);
  });

  /** The pool is baked (see `puzzles.ts`); this is what keeps the bake an
   * honest cache of the generator rather than a hand-edited copy. */
  test.each(MOSAIC.map(p => [p.id, p] as const))('%s matches what the generator makes from its id', (_id, puzzle) => {
    const silhouette = SILHOUETTES[puzzle.difficulty].find(s => s.key === puzzle.subject)!;
    expect(generateMosaic(puzzle.id, silhouette, puzzle.difficulty)).toEqual(puzzle);
  });

  test('no board leans on plain squares, and none repeats a shape more than twice', () => {
    for (const puzzle of MOSAIC) {
      const tally = new Map<string, number>();
      for (const piece of puzzle.pieces) {
        const key = [0, 1, 2, 3].map(rotation => shapeKey(orient(piece.cells, { rotation, flipped: false }))).sort()[0];
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      expect(Math.max(...tally.values())).toBeLessThanOrEqual(2);
    }
  });
});

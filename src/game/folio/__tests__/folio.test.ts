import { endlessId } from '../../endlessId';
import {
  applyFold,
  creasesOf,
  assertValidFolio,
  explainFolioHint,
  flatSheet,
  FOLIO,
  foldingSide,
  foldSheet,
  FolioPuzzle,
  FolioSquare,
  FolioState,
  generateFolio,
  getFolioById,
  initialFolioState,
  isFolioSolved,
  parFor,
  sheetOf,
  shapeForDifficulty,
  solveFolio,
  topInks,
  underInks,
} from '..';

/** A 3x1 strip: red, blue, red on top; paper underneath. */
const strip: FolioSquare[] = [
  { front: 'vermilion', back: 'paper' },
  { front: 'indigo', back: 'paper' },
  { front: 'vermilion', back: 'saffron' },
];

describe('folding', () => {
  test('the smaller side turns over; on a tie, the left or top', () => {
    const sheet = flatSheet({ width: 3, height: 2, squares: [...strip, ...strip] });
    expect(foldingSide(sheet, { axis: 'v', at: 1 })).toBe('low');
    expect(foldingSide(sheet, { axis: 'v', at: 2 })).toBe('high');
    expect(foldingSide(sheet, { axis: 'h', at: 1 })).toBe('low');
  });

  test('a folded square lands mirrored, upside down, on top', () => {
    const sheet = foldSheet(flatSheet({ width: 3, height: 1, squares: strip }), { axis: 'v', at: 1 });
    expect(sheet.width).toBe(2);
    expect(sheet.left).toBe(1);
    // The left square now lies on the middle one, back up.
    expect(sheet.stacks[0]).toEqual([{ square: 1, up: true }, { square: 0, up: false }]);
    expect(topInks(strip, sheet)).toEqual(['paper', 'vermilion']);
  });

  test('the right side folding leaves the left where it was', () => {
    const sheet = foldSheet(flatSheet({ width: 3, height: 1, squares: strip }), { axis: 'v', at: 2 });
    expect(sheet.left).toBe(0);
    expect(topInks(strip, sheet)).toEqual(['vermilion', 'saffron']);
  });

  test('a stack turned over is reversed: its bottom square comes up', () => {
    let sheet = flatSheet({ width: 4, height: 1, squares: [...strip, { front: 'indigo', back: 'vermilion' }] });
    sheet = foldSheet(sheet, { axis: 'v', at: 2 });
    // Two stacks of two; folding again turns the left one over whole.
    sheet = foldSheet(sheet, { axis: 'v', at: 1 });
    expect(sheet.width).toBe(1);
    expect(sheet.stacks[0]).toHaveLength(4);
    expect(sheet.stacks[0][3]).toEqual({ square: 2, up: false });
  });

  test('the folded corner shows what turning a stack over would show', () => {
    const sheet = flatSheet({ width: 3, height: 1, squares: strip });
    expect(underInks(strip, sheet)).toEqual(['paper', 'paper', 'saffron']);
  });

  test('a crease the sheet no longer has changes nothing', () => {
    const puzzle = getFolioById('folio-easy-01')!;
    const state = initialFolioState();
    expect(applyFold(puzzle, state, { axis: 'v', at: puzzle.width })).toBe(state);
  });
});

describe('the boards', () => {
  test('every curated board is valid, with the par its tier promises', () => {
    for (const entry of FOLIO) {
      const puzzle = getFolioById(entry.id)!;
      assertValidFolio(puzzle);
      expect(puzzle.par).toBe(shapeForDifficulty(entry.difficulty).folds);
      expect(puzzle.name).toBe(entry.name);
    }
  });

  test('easy sheets are bare paper underneath', () => {
    for (const entry of FOLIO.filter(e => e.difficulty === 'easy')) {
      expect(getFolioById(entry.id)!.squares.every(s => s.back === 'paper')).toBe(true);
    }
  });

  test('the same id always deals the same board', () => {
    expect(generateFolio('folio-medium-03', 'x', 'medium')).toEqual(generateFolio('folio-medium-03', 'x', 'medium'));
  });

  test('no two curated boards are the same', () => {
    const keys = FOLIO.map(e => {
      const p = getFolioById(e.id)!;
      return JSON.stringify([p.width, p.height, p.squares, p.target]);
    });
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('endless boards build from their id and are valid', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 25; i += 1) {
        const puzzle = getFolioById(endlessId('folio', tier, i))!;
        assertValidFolio(puzzle);
      }
    }
  });

  test('following its own shortest folds solves a board', () => {
    const puzzle = getFolioById('folio-hard-01')!;
    let state: FolioState = initialFolioState();
    for (const fold of solveFolio(puzzle, state)!) state = applyFold(puzzle, state, fold);
    expect(isFolioSolved(puzzle, state)).toBe(true);
    expect(state.folds).toHaveLength(parFor(puzzle));
  });
});

describe('hints', () => {
  const walk = (puzzle: FolioPuzzle, start: FolioState) => {
    let state = start;
    for (let i = 0; i < 12 && !isFolioSolved(puzzle, state); i += 1) {
      const hint = explainFolioHint(puzzle, state);
      expect(hint).not.toBeNull();
      state = hint!.state;
    }
    return state;
  };

  test('hints alone fold every curated board from flat', () => {
    for (const entry of FOLIO) {
      const puzzle = getFolioById(entry.id)!;
      expect(isFolioSolved(puzzle, walk(puzzle, initialFolioState()))).toBe(true);
    }
  });

  test('after a wrong fold the hint opens it back out', () => {
    for (const entry of FOLIO) {
      const puzzle = getFolioById(entry.id)!;
      const right = solveFolio(puzzle, initialFolioState())!;
      // Fold every crease but the right first one until the target is out of reach.
      const flat = flatSheet(puzzle);
      const wrong = creasesOf(flat).find(fold => {
          if (fold.axis === right[0].axis && fold.at === right[0].at) return false;
          return solveFolio(puzzle, { folds: [fold] }) === null;
        });
      if (!wrong) continue;
      const hint = explainFolioHint(puzzle, { folds: [wrong] })!;
      expect(hint.kind).toBe('fix');
      expect(hint.state.folds).toHaveLength(1);
      expect(isFolioSolved(puzzle, walk(puzzle, { folds: [wrong] }))).toBe(true);
    }
  });

  test('a solved board has no hint', () => {
    const puzzle = getFolioById('folio-easy-02')!;
    const done = { folds: solveFolio(puzzle, initialFolioState())! };
    expect(sheetOf(puzzle, done).width).toBe(puzzle.target.width);
    expect(explainFolioHint(puzzle, done)).toBeNull();
  });
});

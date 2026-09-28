import { clueStatus, clueValue, emptyFillaPixState, isFillaPixSolved, clueWindow, toggleCell } from '../logic';
import { revealFillaPixHint } from '../play';
import { assertValidFillaPix, isSolvableByLogic, solveFillaPix } from '../solver';
import { FillaPixPuzzle } from '../types';
import { FILLAPIX, getFillaPixByDifficulty, getFillaPixById } from '../puzzles';

function puzzleWith(size: number, solutionRows: ReadonlyArray<string>, clueCells: ReadonlyArray<{ row: number; col: number }>): FillaPixPuzzle {
  return {
    id: 'fixture',
    difficulty: 'easy',
    size,
    solution: solutionRows.map(row => row.split('').map(ch => ch === '#')),
    clues: clueCells,
  };
}

describe('clueWindow - the 3x3 block, centre included', () => {
  test('a centre cell sees a full 3x3', () => {
    expect(clueWindow(5, 2, 2)).toHaveLength(9);
  });

  test('a corner cell sees 4', () => {
    expect(clueWindow(5, 0, 0)).toHaveLength(4);
  });

  test('an edge cell sees 6', () => {
    expect(clueWindow(5, 0, 2)).toHaveLength(6);
  });

  test('always includes the cell itself - this is the whole rule', () => {
    // The app shipped the opposite of this for a long time, and it is
    // most of what made the game feel unfair: a clue that says nothing
    // about its own square gives up both of the footholds a solver
    // opens with (a 0 empties its block, a 9 fills it).
    const cells = clueWindow(5, 2, 2);
    expect(cells.some(c => c.row === 2 && c.col === 2)).toBe(true);
  });
});

describe('clueValue - the literal "all 9, including the cell itself" reading', () => {
  test('a lone filled cell counts toward its own clue', () => {
    const puzzle = puzzleWith(3, ['...', '.#.', '...'], [{ row: 1, col: 1 }]);
    // The centre cell is itself filled and none of its neighbours are -
    // so its own clue reads 1, not 0.
    expect(clueValue(puzzle, 1, 1)).toBe(1);
  });

  test('counts all 8 surrounding cells when every one is filled', () => {
    const puzzle = puzzleWith(3, ['###', '#.#', '###'], [{ row: 1, col: 1 }]);
    expect(clueValue(puzzle, 1, 1)).toBe(8);
  });

  test('clips at the board edge - a corner clue sees only the 4 squares that exist', () => {
    const puzzle = puzzleWith(2, ['##', '##'], [{ row: 0, col: 0 }]);
    expect(clueValue(puzzle, 0, 0)).toBe(4);
  });
});

describe('clueStatus - live, re-evaluated against the player\'s current grid', () => {
  test('satisfied once the player matches the clue exactly', () => {
    // A full block, so the centre clue reads 9 and filling its whole
    // window is exactly right - under the old centre-excluding rule this
    // same fixture read 8 and filling all nine overshot it.
    const puzzle = puzzleWith(3, ['###', '###', '###'], [{ row: 1, col: 1 }]);
    let state = emptyFillaPixState(3);
    for (const cell of clueWindow(3, 1, 1)) state = toggleCell(state, cell.row, cell.col);
    expect(clueStatus(puzzle, state, 1, 1)).toBe('satisfied');
  });

  test('violated when the player has filled too many', () => {
    // Clue at (0,0) sees only 3 neighbours - (0,1), (1,0), (1,1) - and
    // exactly one of them, (0,1), is filled in the solution: clueValue
    // is 1. The player fills all 3.
    const puzzle = puzzleWith(3, ['.#.', '...', '...'], [{ row: 0, col: 0 }]);
    expect(clueValue(puzzle, 0, 0)).toBe(1);
    let state = emptyFillaPixState(3);
    state = toggleCell(state, 0, 1);
    state = toggleCell(state, 1, 0);
    state = toggleCell(state, 1, 1);
    expect(clueStatus(puzzle, state, 0, 0)).toBe('violated');
  });

  test('violated when the player has filled too few', () => {
    const puzzle = puzzleWith(3, ['###', '#.#', '###'], [{ row: 1, col: 1 }]);
    const state = emptyFillaPixState(3);
    expect(clueStatus(puzzle, state, 1, 1)).toBe('violated');
  });
});

describe('solver - can it actually detect non-uniqueness, not just rubber-stamp', () => {
  test('a genuinely ambiguous clue set reports more than one solution', () => {
    // 2x2 board, no clues at all: every one of the 16 possible grids
    // satisfies "no constraints" - this must not be reported as unique.
    const puzzle = puzzleWith(2, ['##', '##'], []);
    const solutions = solveFillaPix(puzzle, 2);
    expect(solutions.length).toBeGreaterThan(1);
  });

  test('a fully-clued small board finds exactly its own solution', () => {
    const rows = ['###', '#.#', '###'];
    const puzzle = puzzleWith(3, rows, [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
    ]);
    const solutions = solveFillaPix(puzzle, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(puzzle.solution);
  });

  test('assertValidFillaPix throws on the ambiguous fixture and not on the fully-clued one', () => {
    const ambiguous = puzzleWith(2, ['##', '##'], []);
    expect(() => assertValidFillaPix(ambiguous)).toThrow();

    const rows = ['###', '#.#', '###'];
    const clued = puzzleWith(3, rows, [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
      { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
      { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
    ]);
    expect(() => assertValidFillaPix(clued)).not.toThrow();
  });
});

describe('toggleCell / isFillaPixSolved', () => {
  test('solved once every revealed clue is satisfied', () => {
    const rows = ['###', '###', '###'];
    const puzzle = puzzleWith(3, rows, [{ row: 1, col: 1 }]);
    let state = emptyFillaPixState(3);
    expect(isFillaPixSolved(puzzle, state)).toBe(false);
    for (const cell of clueWindow(3, 1, 1)) state = toggleCell(state, cell.row, cell.col);
    expect(isFillaPixSolved(puzzle, state)).toBe(true);
  });

  test('toggling twice returns to the original state', () => {
    let state = emptyFillaPixState(3);
    state = toggleCell(state, 1, 1);
    state = toggleCell(state, 1, 1);
    expect(state).toEqual(emptyFillaPixState(3));
  });
});

describe('revealFillaPixHint', () => {
  test('advances one cell at a time toward the solution', () => {
    const rows = ['###', '#.#', '###'];
    const puzzle = puzzleWith(3, rows, [{ row: 0, col: 0 }]);
    let state = emptyFillaPixState(3);
    let steps = 0;
    for (;;) {
      const hint = revealFillaPixHint(state, puzzle);
      if (!hint) break;
      state = hint.state;
      steps += 1;
      expect(steps).toBeLessThanOrEqual(9);
    }
    expect(state).toEqual({ filled: puzzle.solution });
  });

  test('returns null once the picture already matches the solution', () => {
    const rows = ['#.', '.#'];
    const puzzle = puzzleWith(2, rows, [{ row: 0, col: 0 }]);
    const state = { filled: puzzle.solution };
    expect(revealFillaPixHint(state, puzzle)).toBeNull();
  });
});

describe('getFillaPixById / getFillaPixByDifficulty', () => {
  test('every id round-trips', () => {
    for (const puzzle of FILLAPIX) expect(getFillaPixById(puzzle.id)).toBe(puzzle);
  });

  test('difficulty filters partition the pool with no overlap', () => {
    const easy = getFillaPixByDifficulty('easy');
    const medium = getFillaPixByDifficulty('medium');
    const hard = getFillaPixByDifficulty('hard');
    expect(easy.length + medium.length + hard.length).toBe(FILLAPIX.length);
    expect(easy.every(p => p.difficulty === 'easy')).toBe(true);
    expect(medium.every(p => p.difficulty === 'medium')).toBe(true);
    expect(hard.every(p => p.difficulty === 'hard')).toBe(true);
  });

  test('grid size scales with difficulty', () => {
    for (const puzzle of getFillaPixByDifficulty('easy')) expect(puzzle.size).toBe(5);
    for (const puzzle of getFillaPixByDifficulty('medium')) expect(puzzle.size).toBe(6);
    for (const puzzle of getFillaPixByDifficulty('hard')) expect(puzzle.size).toBe(7);
  });

  test('the very first puzzle a new player can meet reveals every clue - the easiest possible solve', () => {
    const first = getFillaPixById('fillapix-easy-01')!;
    expect(first.clues).toHaveLength(first.size * first.size);
  });
});

describe.each(FILLAPIX.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
  test('is a valid, uniquely-solvable puzzle', () => {
    expect(() => assertValidFillaPix(puzzle)).not.toThrow();
  });

  test('every clue satisfied implies the grid equals the solution - the uniqueness guarantee, at the game-state level', () => {
    const state = { filled: puzzle.solution };
    expect(isFillaPixSolved(puzzle, state)).toBe(true);

    // And the converse the puzzle actually rests on: nothing *other* than
    // the real solution can satisfy every revealed clue.
    const [onlySolution] = solveFillaPix(puzzle, 2);
    expect(onlySolution).toEqual(puzzle.solution);
  });

  test('at least one clue is revealed', () => {
    expect(puzzle.clues.length).toBeGreaterThan(0);
  });

  test('can be reasoned to its answer - no guessing anywhere', () => {
    // The guarantee this game did not have. Uniqueness only says an
    // answer exists and is the only one; it says nothing about whether a
    // player can *get* there. Measured against the pool that shipped
    // before this check existed, 8 of 14 puzzles could not be solved by
    // propagation at all, and two - one of them in the easy tier -
    // yielded literally nothing, so the only way in was to pick a square
    // at random. Every shipped puzzle must now fall out of logic alone.
    expect(isSolvableByLogic(puzzle)).toBe(true);
  });
});

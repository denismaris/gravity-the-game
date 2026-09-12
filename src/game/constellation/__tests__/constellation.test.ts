import {
  CONSTELLATIONS,
  assertValidConstellation,
  cluesEqual,
  deriveClues,
  emptyConstellationState,
  getConstellationById,
  isConstellationSolved,
  nextMark,
  remainingCells,
  revealHint,
  rowCandidates,
  runsOf,
  setMark,
  solveConstellation,
} from '..';

describe('runsOf', () => {
  test('encodes runs and drops gaps', () => {
    expect(runsOf([true, true, false, true])).toEqual([2, 1]);
    expect(runsOf([false, false])).toEqual([]);
    expect(runsOf([true, true, true])).toEqual([3]);
    expect(runsOf([true, false, true, false, true])).toEqual([1, 1, 1]);
  });
});

describe('deriveClues', () => {
  test('reads row and column runs off a grid', () => {
    const solution = [
      [true, false, true],
      [true, true, false],
      [false, false, true],
    ];
    const { rowClues, colClues } = deriveClues(solution);
    expect(rowClues).toEqual([[1, 1], [2], [1]]);
    expect(colClues).toEqual([[2], [1], [1, 1]]);
  });
});

describe('board logic', () => {
  const puzzle = CONSTELLATIONS[0];

  test('an empty board is not solved', () => {
    expect(isConstellationSolved(emptyConstellationState(puzzle), puzzle)).toBe(false);
  });

  test('setMark is pure and clamps to the board', () => {
    const s0 = emptyConstellationState(puzzle);
    const s1 = setMark(s0, 0, 2, 'filled');
    expect(s0.marks[0][2]).toBe('blank');
    expect(s1.marks[0][2]).toBe('filled');
    expect(setMark(s1, 0, 2, 'filled')).toBe(s1); // no-op returns same ref
    expect(setMark(s1, -1, 0, 'filled')).toBe(s1); // out of bounds
  });

  test('nextMark cycles blank -> filled -> marked -> blank', () => {
    expect(nextMark('blank')).toBe('filled');
    expect(nextMark('filled')).toBe('marked');
    expect(nextMark('marked')).toBe('blank');
  });

  test('filling exactly the solution cells solves it; a marked note does not matter', () => {
    let state = emptyConstellationState(puzzle);
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        if (puzzle.solution[r][c]) state = setMark(state, r, c, 'filled');
      }
    }
    expect(isConstellationSolved(state, puzzle)).toBe(true);
    // a player "definitely empty" note on a dark cell is still solved
    const dark = findDark(puzzle);
    state = setMark(state, dark.row, dark.col, 'marked');
    expect(isConstellationSolved(state, puzzle)).toBe(true);
  });

  test('an extra fill on a dark cell keeps it unsolved', () => {
    let state = fillSolution(puzzle);
    const dark = findDark(puzzle);
    state = setMark(state, dark.row, dark.col, 'filled');
    expect(isConstellationSolved(state, puzzle)).toBe(false);
  });

  test('revealHint corrects one wrong cell and eventually finishes the board', () => {
    let state = emptyConstellationState(puzzle);
    let guard = puzzle.rows * puzzle.cols + 1;
    while (!isConstellationSolved(state, puzzle) && guard > 0) {
      const hint = revealHint(state, puzzle);
      expect(hint).not.toBeNull();
      state = hint!.state;
      guard -= 1;
    }
    expect(isConstellationSolved(state, puzzle)).toBe(true);
    expect(revealHint(state, puzzle)).toBeNull();
  });

  test('remainingCells counts down to zero', () => {
    const empty = emptyConstellationState(puzzle);
    const total = puzzle.solution.flat().filter(Boolean).length;
    expect(remainingCells(empty, puzzle)).toBe(total);
    expect(remainingCells(fillSolution(puzzle), puzzle)).toBe(0);
  });
});

describe('rowCandidates', () => {
  test('an empty clue yields the single all-dark row', () => {
    expect(rowCandidates(4, [])).toEqual([[false, false, false, false]]);
  });

  test('a full-width run yields exactly one row', () => {
    expect(rowCandidates(3, [3])).toEqual([[true, true, true]]);
  });

  test('every candidate has the right run lengths and width', () => {
    for (const row of rowCandidates(6, [2, 1])) {
      expect(row).toHaveLength(6);
      expect(runsOf(row)).toEqual([2, 1]);
    }
    // count matches "stars and bars": 6 cells, runs 2+1 + 1 mandatory gap = 4, slack 2 over 3 gaps
    expect(rowCandidates(6, [2, 1])).toHaveLength(6);
  });
});

describe('the authored Constellation pack', () => {
  test('ids are unique and resolvable', () => {
    const ids = CONSTELLATIONS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of CONSTELLATIONS) expect(getConstellationById(p.id)).toBe(p);
  });

  describe.each(CONSTELLATIONS.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
    test('is well-formed and has a unique solution equal to its picture', () => {
      expect(() => assertValidConstellation(puzzle)).not.toThrow();
    });

    test('its stored clues match the ones derived from the picture', () => {
      const { rowClues, colClues } = deriveClues(puzzle.solution);
      puzzle.rowClues.forEach((clue, i) => expect(cluesEqual(clue, rowClues[i])).toBe(true));
      puzzle.colClues.forEach((clue, i) => expect(cluesEqual(clue, colClues[i])).toBe(true));
    });

    test('the solver returns exactly the stated picture', () => {
      const [only] = solveConstellation(puzzle, 2);
      expect(only.map(row => row.map(Boolean))).toEqual(
        puzzle.solution.map(row => row.map(Boolean)),
      );
    });
  });
});

function findDark(puzzle: (typeof CONSTELLATIONS)[number]): { row: number; col: number } {
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (!puzzle.solution[r][c]) return { row: r, col: c };
    }
  }
  throw new Error('puzzle has no dark cell');
}

function fillSolution(puzzle: (typeof CONSTELLATIONS)[number]) {
  let state = emptyConstellationState(puzzle);
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (puzzle.solution[r][c]) state = setMark(state, r, c, 'filled');
    }
  }
  return state;
}

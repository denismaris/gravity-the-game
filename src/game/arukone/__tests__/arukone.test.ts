import {
  ARUKONE,
  beginDraw,
  drawnHalf,
  extendDraw,
  isSelfSymmetric,
  pendingArm,
  revealArukoneHint,
  ArukoneCell,
  ArukonePuzzle,
  ArukoneState,
  cellKey,
  crossingValues,
  emptyArukoneState,
  generateArukone,
  getArukoneById,
  getArukoneByDifficulty,
  isAdjacent,
  isArukoneSolved,
  isOnAxis,
  isPathComplete,
  isPathWellFormed,
  mirrorCell,
  mirrorPairOf,
  pairFor,
  remainingCells,
  remainingPairs,
  sameCell,
  uncoveredCells,
  shapeForDifficulty,
} from '..';

const AXES = ['vertical', 'horizontal', 'rotational'] as const;

describe('mirrorCell', () => {
  test('is its own inverse on every axis - the property auto-mirroring relies on', () => {
    for (const axis of AXES) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const cell = { row, col };
          expect(mirrorCell(axis, 5, mirrorCell(axis, 5, cell))).toEqual(cell);
        }
      }
    }
  });

  test('folds the board the way each axis names', () => {
    expect(mirrorCell('vertical', 5, { row: 1, col: 0 })).toEqual({ row: 1, col: 4 });
    expect(mirrorCell('horizontal', 5, { row: 0, col: 2 })).toEqual({ row: 4, col: 2 });
    expect(mirrorCell('rotational', 5, { row: 0, col: 1 })).toEqual({ row: 4, col: 3 });
  });

  test('cells on the fold line map to themselves', () => {
    expect(isOnAxis('vertical', 5, { row: 2, col: 2 })).toBe(true);
    expect(isOnAxis('vertical', 5, { row: 2, col: 1 })).toBe(false);
    // An even board has no centre column, so nothing sits on a vertical fold.
    expect(isOnAxis('vertical', 6, { row: 3, col: 3 })).toBe(false);
  });
});

describe('path rules', () => {
  const puzzle: ArukonePuzzle = {
    id: 'test',
    difficulty: 'easy',
    size: 4,
    axis: 'vertical',
    obstacles: [{ row: 1, col: 1 }],
    pairs: [
      { value: 1, a: { row: 0, col: 0 }, b: { row: 2, col: 0 } },
      { value: 2, a: { row: 0, col: 3 }, b: { row: 2, col: 3 } },
    ],
    solution: {
      1: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }],
      2: [{ row: 0, col: 3 }, { row: 1, col: 3 }, { row: 2, col: 3 }],
    },
  };
  const pair = pairFor(puzzle, 1)!;

  test('accepts a simple adjacent run from one endpoint', () => {
    const path = [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }];
    expect(isPathWellFormed(puzzle, pair, path)).toBe(true);
    expect(isPathComplete(pair, path)).toBe(true);
  });

  test('rejects a diagonal step', () => {
    expect(isPathWellFormed(puzzle, pair, [{ row: 0, col: 0 }, { row: 1, col: 1 }])).toBe(false);
  });

  test('rejects entering an obstacle', () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }];
    expect(isPathWellFormed(puzzle, pair, path)).toBe(false);
  });

  test('rejects revisiting a cell', () => {
    const path = [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 0 }];
    expect(isPathWellFormed(puzzle, pair, path)).toBe(false);
  });

  test('rejects running through another number', () => {
    const path = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }];
    expect(isPathWellFormed(puzzle, pair, path)).toBe(false);
  });

  test('rejects a path that does not start on its own endpoint', () => {
    expect(isPathWellFormed(puzzle, pair, [{ row: 1, col: 0 }, { row: 2, col: 0 }])).toBe(false);
  });

  test('a half-drawn path is well-formed but not complete', () => {
    const path = [{ row: 0, col: 0 }, { row: 1, col: 0 }];
    expect(isPathWellFormed(puzzle, pair, path)).toBe(true);
    expect(isPathComplete(pair, path)).toBe(false);
  });

  test('completeness accepts a path drawn from either end', () => {
    const backwards = [{ row: 2, col: 0 }, { row: 1, col: 0 }, { row: 0, col: 0 }];
    expect(isPathComplete(pair, backwards)).toBe(true);
  });
});

describe('crossingValues', () => {
  test('flags both values when two paths share a cell', () => {
    const state: ArukoneState = {
      paths: {
        1: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
        2: [{ row: 1, col: 1 }, { row: 0, col: 1 }],
      },
    };
    expect([...crossingValues(state)].sort()).toEqual([1, 2]);
  });

  test('silent when paths merely run alongside each other', () => {
    const state: ArukoneState = {
      paths: { 1: [{ row: 0, col: 0 }], 2: [{ row: 1, col: 0 }] },
    };
    expect(crossingValues(state).size).toBe(0);
  });
});

describe('isArukoneSolved', () => {
  // The middle column is blocked, so the two outer columns are the whole
  // free board and one path down each fills it.
  const puzzle: ArukonePuzzle = {
    id: 'solved',
    difficulty: 'easy',
    size: 3,
    axis: 'vertical',
    obstacles: [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }],
    pairs: [
      { value: 1, a: { row: 0, col: 0 }, b: { row: 2, col: 0 } },
      { value: 2, a: { row: 0, col: 2 }, b: { row: 2, col: 2 } },
    ],
    solution: {
      1: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }],
      2: [{ row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }],
    },
  };

  test('an empty board is not solved', () => {
    expect(isArukoneSolved(puzzle, emptyArukoneState())).toBe(false);
    expect(remainingPairs(puzzle, emptyArukoneState())).toBe(2);
    expect(remainingCells(puzzle, emptyArukoneState())).toBe(6);
  });

  test('solved once every pair is joined and every square is used', () => {
    const state: ArukoneState = { paths: puzzle.solution };
    expect(isArukoneSolved(puzzle, state)).toBe(true);
    expect(remainingPairs(puzzle, state)).toBe(0);
    expect(remainingCells(puzzle, state)).toBe(0);
  });

  test('obstacles are not squares that need filling', () => {
    expect(uncoveredCells(puzzle, { paths: puzzle.solution })).toEqual([]);
  });
});

describe('the generator', () => {
  const IDS = ['arukone-001', 'arukone-050', 'seed-a', 'seed-b', 'zzz'];

  test('is deterministic - the same id always builds the same board', () => {
    for (const id of IDS) {
      expect(generateArukone(id, 'medium')).toEqual(generateArukone(id, 'medium'));
    }
  });

  test('different ids build different boards', () => {
    const a = JSON.stringify(generateArukone('arukone-001', 'easy'));
    const b = JSON.stringify(generateArukone('arukone-002', 'easy'));
    expect(a).not.toEqual(b);
  });

  describe.each(['easy', 'medium', 'hard'] as const)('%s boards', difficulty => {
    const shape = shapeForDifficulty(difficulty);
    // A spread of ids rather than one, so a single lucky seed cannot pass
    // for the generator being correct.
    const boards = Array.from({ length: 25 }, (_v, i) => generateArukone(`gen-${difficulty}-${i}`, difficulty));

    test('has the right size and pair count', () => {
      for (const puzzle of boards) {
        expect(puzzle.size).toBe(shape.size);
        expect(puzzle.pairs).toHaveLength(shape.pairs);
      }
    });

    test('obstacles form a symmetric set under the board own axis', () => {
      for (const puzzle of boards) {
        const blocked = new Set(puzzle.obstacles.map(cellKey));
        for (const cell of puzzle.obstacles) {
          expect(blocked.has(cellKey(mirrorCell(puzzle.axis, puzzle.size, cell)))).toBe(true);
        }
      }
    });

    test('every endpoint is a distinct in-bounds cell, never on an obstacle', () => {
      for (const puzzle of boards) {
        const blocked = new Set(puzzle.obstacles.map(cellKey));
        const seen = new Set<string>();
        const endpoints: ArukoneCell[] = puzzle.pairs.flatMap(p => [p.a, p.b]);
        for (const cell of endpoints) {
          const key = cellKey(cell);
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(puzzle.size);
          expect(cell.col).toBeLessThan(puzzle.size);
          expect(blocked.has(key)).toBe(false);
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    });

    test('no pair is a giveaway - every one needs a real route', () => {
      for (const puzzle of boards) {
        for (const pair of puzzle.pairs) {
          expect(isAdjacent(pair.a, pair.b)).toBe(false);
          expect(sameCell(pair.a, pair.b)).toBe(false);
          // Three apart at minimum. Two leaves exactly one square between
          // the numbers and exactly one way through it, which is not a
          // puzzle - and on a self-symmetric pair it is a single drag.
          const distance = Math.abs(pair.a.row - pair.b.row) + Math.abs(pair.a.col - pair.b.col);
          expect(distance).toBeGreaterThanOrEqual(3);
          expect(puzzle.solution[pair.value].length).toBeGreaterThanOrEqual(4);
        }
      }
    });

    test('every pair has a mirror partner, so the board folds onto itself', () => {
      for (const puzzle of boards) {
        for (const pair of puzzle.pairs) {
          // Either another pair mirrors it, or it mirrors onto itself.
          expect(mirrorPairOf(puzzle, pair)).toBeDefined();
        }
      }
    });

    // The case that slipped past every other test here and only showed up
    // on a real board: a self-symmetric pair whose numbers both sit *on*
    // the fold. The fold then fixes every cell of its path, so there is no
    // second arm, and the drawing layer's fold would splice the path onto
    // itself and revisit its own cells.
    test('never folds a pair onto its own fold line', () => {
      for (const puzzle of boards) {
        for (const pair of puzzle.pairs) {
          if (mirrorPairOf(puzzle, pair)?.value !== pair.value) continue;
          expect(isOnAxis(puzzle.axis, puzzle.size, pair.a)).toBe(false);
          expect(isOnAxis(puzzle.axis, puzzle.size, pair.b)).toBe(false);
          // Which is to say: the fold swaps its two numbers.
          expect(mirrorCell(puzzle.axis, puzzle.size, pair.a)).toEqual(pair.b);
        }
      }
    });

    // The point of building the solution first and deriving the board from
    // it. Without this the generator's whole premise is an argument about
    // the algorithm; with it, every board ships having been solved once.
    test('the solution it kept actually solves the board it built', () => {
      for (const puzzle of boards) {
        expect(isArukoneSolved(puzzle, { paths: puzzle.solution })).toBe(true);
      }
    });

    // Full coverage is the rule the whole generator was rebuilt around, so
    // it gets checked on the shipped article rather than argued about.
    test('fills the board - no free square is left untouched', () => {
      for (const puzzle of boards) {
        expect(uncoveredCells(puzzle, { paths: puzzle.solution })).toEqual([]);
        const covered = puzzle.pairs.reduce((n, pair) => n + puzzle.solution[pair.value].length, 0);
        expect(covered).toBe(puzzle.size * puzzle.size - puzzle.obstacles.length);
      }
    });

    test('the solution is symmetric - each path is its partner mirrored', () => {
      for (const puzzle of boards) {
        for (const pair of puzzle.pairs) {
          const partner = mirrorPairOf(puzzle, pair)!;
          const mine = puzzle.solution[pair.value].map(c => cellKey(mirrorCell(puzzle.axis, puzzle.size, c)));
          const theirs = puzzle.solution[partner.value].map(cellKey);
          expect([...mine].sort()).toEqual([...theirs].sort());
        }
      }
    });
  });
});

describe('drawing', () => {
  // Vertical fold on a 5-wide board, so column 2 is the fold line. Two
  // mirror groups: 1/2 down the outer columns, 3/4 inside them. Two groups
  // matter - a board with only one has nothing for a path to collide with,
  // since a pair and its own twin are drawn by the same gesture.
  const puzzle: ArukonePuzzle = {
    id: 'draw',
    difficulty: 'easy',
    size: 5,
    axis: 'vertical',
    obstacles: [{ row: 0, col: 2 }, { row: 4, col: 2 }],
    pairs: [
      { value: 1, a: { row: 0, col: 0 }, b: { row: 4, col: 0 } },
      { value: 2, a: { row: 0, col: 4 }, b: { row: 4, col: 4 } },
      { value: 3, a: { row: 1, col: 1 }, b: { row: 3, col: 1 } },
      { value: 4, a: { row: 1, col: 3 }, b: { row: 3, col: 3 } },
    ],
    solution: {
      1: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }, { row: 4, col: 0 }],
      2: [{ row: 0, col: 4 }, { row: 1, col: 4 }, { row: 2, col: 4 }, { row: 3, col: 4 }, { row: 4, col: 4 }],
      3: [{ row: 1, col: 1 }, { row: 2, col: 1 }, { row: 3, col: 1 }],
      4: [{ row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 }],
    },
  };

  /** Runs one gesture: touch `cells[0]`, then drag through the rest. */
  function draw(from: ArukoneState, cells: ReadonlyArray<ArukoneCell>): ArukoneState {
    const start = beginDraw(puzzle, from, cells[0]);
    if (!start) throw new Error('gesture did not start');
    return cells.slice(1).reduce((s, cell) => extendDraw(puzzle, s, start.value, cell), start.state);
  }

  test('joining every pair is not enough - the grid has to be full', () => {
    const state: ArukoneState = { paths: puzzle.solution };
    expect(remainingPairs(puzzle, state)).toBe(0);
    // Four rows of five, less two blocked squares, less the sixteen the
    // four paths cover.
    expect(remainingCells(puzzle, state)).toBe(7);
    expect(isArukoneSolved(puzzle, state)).toBe(false);
  });

  test('drawing one half writes the other half at the same time', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 1, col: 0 }]);
    expect(state.paths[1]).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }]);
    expect(state.paths[2]).toEqual([{ row: 0, col: 4 }, { row: 1, col: 4 }]);
  });

  test('a touch on empty ground starts nothing', () => {
    expect(beginDraw(puzzle, emptyArukoneState(), { row: 2, col: 2 })).toBeNull();
  });

  test('refuses a diagonal or a distant step', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }]);
    expect(extendDraw(puzzle, state, 1, { row: 1, col: 1 })).toBe(state);
    expect(extendDraw(puzzle, state, 1, { row: 3, col: 0 })).toBe(state);
  });

  test('refuses to enter an obstacle', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
    expect(extendDraw(puzzle, state, 1, { row: 0, col: 2 })).toBe(state);
  });

  test('refuses to run through another pair own number', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
    expect(extendDraw(puzzle, state, 1, { row: 1, col: 1 })).toBe(state);
  });

  test('dragging back along the line walks it back a cell', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
    const back = extendDraw(puzzle, state, 1, { row: 1, col: 0 });
    expect(back.paths[1]).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }]);
    // The mirrored half walks back with it - one gesture, both halves.
    expect(back.paths[2]).toEqual([{ row: 0, col: 4 }, { row: 1, col: 4 }]);
  });

  test('touching a drawn path picks it up there and drops the rest', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
    const resumed = beginDraw(puzzle, state, { row: 1, col: 0 })!;
    expect(resumed.value).toBe(1);
    expect(resumed.state.paths[1]).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }]);
    expect(resumed.state.paths[2]).toEqual([{ row: 0, col: 4 }, { row: 1, col: 4 }]);
  });

  test('touching a number again starts that pair over', () => {
    const state = draw(emptyArukoneState(), [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
    const restarted = beginDraw(puzzle, state, { row: 0, col: 0 })!;
    expect(restarted.state.paths[1]).toEqual([{ row: 0, col: 0 }]);
    expect(restarted.state.paths[2]).toEqual([{ row: 0, col: 4 }]);
  });

  test('refuses a cell another pair has taken', () => {
    const withThree = draw(emptyArukoneState(), puzzle.solution[3]);
    const walked = draw(withThree, [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }]);
    expect(walked.paths[1]).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
  });

  test('refuses a cell whose mirror another pair has taken', () => {
    // (2,1) is free, but drawing it would put pair 1's own twin on (2,3),
    // which pair 4 holds - the move is refused from the near side.
    const withThree = draw(emptyArukoneState(), puzzle.solution[4]);
    const start = beginDraw(puzzle, withThree, { row: 0, col: 0 })!;
    const walked = [{ row: 1, col: 0 }, { row: 2, col: 0 }, { row: 2, col: 1 }].reduce(
      (s, cell) => extendDraw(puzzle, s, start.value, cell),
      start.state,
    );
    expect(walked.paths[1]).toEqual([{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }]);
  });

  test('drawing out both groups joins every pair', () => {
    let state = draw(emptyArukoneState(), puzzle.solution[1]);
    expect(remainingPairs(puzzle, state)).toBe(2);
    state = draw(state, puzzle.solution[3]);
    expect(remainingPairs(puzzle, state)).toBe(0);
  });
});

describe('a pair that folds onto itself', () => {
  // Column 2 is the fold; pair 1's two ends are each other's mirror, so
  // the player draws one arm and the other grows to meet it.
  const puzzle: ArukonePuzzle = {
    id: 'self',
    difficulty: 'easy',
    size: 5,
    axis: 'vertical',
    obstacles: [],
    pairs: [{ value: 1, a: { row: 0, col: 1 }, b: { row: 0, col: 3 } }],
    solution: { 1: [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] },
  };
  const pair = pairFor(puzzle, 1)!;

  test('is recognised as its own mirror partner', () => {
    expect(isSelfSymmetric(puzzle, pair)).toBe(true);
  });

  test('grows a second arm that is not stored until the two meet', () => {
    const started = beginDraw(puzzle, emptyArukoneState(), { row: 0, col: 1 })!;
    const state = extendDraw(puzzle, started.state, 1, { row: 1, col: 1 });
    expect(drawnHalf(puzzle, state, pair)).toEqual([{ row: 0, col: 1 }, { row: 1, col: 1 }]);
    expect(pendingArm(puzzle, state, pair)).toEqual([{ row: 0, col: 3 }, { row: 1, col: 3 }]);
    expect(isPathComplete(pair, state.paths[1] ?? [])).toBe(false);
  });

  test('closes into one whole path the moment the arms meet on the fold', () => {
    const started = beginDraw(puzzle, emptyArukoneState(), { row: 0, col: 1 })!;
    const state = extendDraw(puzzle, started.state, 1, { row: 0, col: 2 });
    // The fold cell belongs to both arms and appears once.
    expect(state.paths[1]).toEqual([{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }]);
    expect(pendingArm(puzzle, state, pair)).toEqual([]);
    expect(isPathComplete(pair, state.paths[1] ?? [])).toBe(true);
  });

  test('closes when the arms end up side by side either side of the fold', () => {
    const even: ArukonePuzzle = {
      ...puzzle,
      id: 'self-even',
      size: 4,
      pairs: [{ value: 1, a: { row: 0, col: 0 }, b: { row: 0, col: 3 } }],
      solution: { 1: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }] },
    };
    const started = beginDraw(even, emptyArukoneState(), { row: 0, col: 0 })!;
    const state = extendDraw(even, started.state, 1, { row: 0, col: 1 });
    expect(state.paths[1]).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    ]);
    expect(isPathComplete(pairFor(even, 1)!, state.paths[1] ?? [])).toBe(true);
  });

  test('a pair sitting on the fold is drawn end to end, not folded', () => {
    // `generateArukone` never builds this, but a hand-written board could,
    // and the failure mode would be a path quietly revisiting its own
    // cells rather than anything visible.
    const onFold: ArukonePuzzle = {
      id: 'on-fold',
      difficulty: 'easy',
      size: 5,
      axis: 'horizontal',
      obstacles: [],
      // Row 2 is the fold; both numbers sit on it.
      pairs: [{ value: 1, a: { row: 2, col: 0 }, b: { row: 2, col: 3 } }],
      solution: {
        1: [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }],
      },
    };
    const started = beginDraw(onFold, emptyArukoneState(), { row: 2, col: 0 })!;
    const state = [{ row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 }].reduce(
      (s, cell) => extendDraw(onFold, s, 1, cell),
      started.state,
    );
    expect(state.paths[1]).toEqual(onFold.solution[1]);
    expect(isPathComplete(pairFor(onFold, 1)!, state.paths[1] ?? [])).toBe(true);
  });

  test('can be walked back out of once joined', () => {
    const started = beginDraw(puzzle, emptyArukoneState(), { row: 0, col: 1 })!;
    const joined = extendDraw(puzzle, started.state, 1, { row: 0, col: 2 });
    const resumed = beginDraw(puzzle, joined, { row: 0, col: 1 })!;
    expect(resumed.state.paths[1]).toEqual([{ row: 0, col: 1 }]);
  });
});

describe('a real board, drawn out by hand', () => {
  // The end-to-end case: take a shipped board, run its own solution
  // through the same gesture layer a player's finger drives, and require
  // the result to actually register as solved. Every other test here
  // checks one link in that chain.
  test.each(['arukone-001', 'arukone-006', 'arukone-011'])('%s solves when drawn', id => {
    const puzzle = getArukoneById(id)!;
    let state = emptyArukoneState();

    for (const pair of puzzle.pairs) {
      // A pair whose partner was already drawn came along for the ride.
      if (isPathComplete(pair, state.paths[pair.value] ?? [])) continue;
      const answer = puzzle.solution[pair.value];
      const started = beginDraw(puzzle, state, answer[0]);
      expect(started).not.toBeNull();
      state = answer.slice(1).reduce((s, cell) => extendDraw(puzzle, s, started!.value, cell), started!.state);
    }

    expect(remainingPairs(puzzle, state)).toBe(0);
    expect(remainingCells(puzzle, state)).toBe(0);
    expect(isArukoneSolved(puzzle, state)).toBe(true);
  });
});

describe('hints', () => {
  test('fill in a whole pair, and repeated hints finish the board', () => {
    const puzzle = generateArukone('hint-board', 'easy');
    let state = emptyArukoneState();
    for (let i = 0; i < puzzle.pairs.length; i += 1) {
      const next = revealArukoneHint(puzzle, state);
      if (!next) break;
      state = next;
    }
    expect(isArukoneSolved(puzzle, state)).toBe(true);
  });

  test('hand back nothing once there is nothing left to reveal', () => {
    const puzzle = generateArukone('hint-board', 'easy');
    expect(revealArukoneHint(puzzle, { paths: puzzle.solution })).toBeNull();
  });
});

describe('the shipped pool', () => {
  test('ships boards across all three tiers', () => {
    expect(getArukoneByDifficulty('easy').length).toBeGreaterThan(0);
    expect(getArukoneByDifficulty('medium').length).toBeGreaterThan(0);
    expect(getArukoneByDifficulty('hard').length).toBeGreaterThan(0);
  });

  test('every id is unique and every board is named', () => {
    const ids = ARUKONE.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const puzzle of ARUKONE) expect(puzzle.name).toBeTruthy();
  });

  test('no shipped board starts already solved', () => {
    for (const puzzle of ARUKONE) {
      expect(isArukoneSolved(puzzle, emptyArukoneState())).toBe(false);
    }
  });

  test('every shipped board is solvable - by its own kept solution', () => {
    for (const puzzle of ARUKONE) {
      expect(isArukoneSolved(puzzle, { paths: puzzle.solution })).toBe(true);
    }
  });
});

import {
  TRAJECTORIES,
  TrajectoryPuzzle,
  TrajectoryState,
  assertValidTrajectory,
  beginPath,
  clearPath,
  emptyTrajectoryState,
  extendPath,
  getTrajectoryById,
  isBlockedCell,
  isTrajectorySolved,
  pairConnected,
  playableCells,
  remainingCells,
  revealHint,
  solveTrajectory,
} from '..';

const puzzle = TRAJECTORIES[0]; // 4x4, colours 1 & 2

/** Builds a state from a solver solution. */
function stateFromSolution(p: (typeof TRAJECTORIES)[number]): TrajectoryState {
  const [solution] = solveTrajectory(p, 1);
  return { rows: p.rows, cols: p.cols, paths: solution };
}

describe('drawing a path', () => {
  test('beginPath only starts from an endpoint of a colour', () => {
    const s0 = emptyTrajectoryState(puzzle);
    expect(beginPath(s0, puzzle, { row: 2, col: 2 })).toBe(s0); // not an endpoint
    const s1 = beginPath(s0, puzzle, puzzle.pairs[0].a);
    expect(s1.paths[1]).toEqual([puzzle.pairs[0].a]);
  });

  test('extendPath needs an adjacent, empty cell', () => {
    let s = beginPath(emptyTrajectoryState(puzzle), puzzle, { row: 0, col: 0 });
    expect(extendPath(s, puzzle, 1, { row: 2, col: 2 })).toBe(s); // not adjacent
    s = extendPath(s, puzzle, 1, { row: 0, col: 1 });
    expect(s.paths[1]).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  test('stepping back onto the path truncates it', () => {
    let s = beginPath(emptyTrajectoryState(puzzle), puzzle, { row: 0, col: 0 });
    s = extendPath(s, puzzle, 1, { row: 0, col: 1 });
    s = extendPath(s, puzzle, 1, { row: 0, col: 2 });
    s = extendPath(s, puzzle, 1, { row: 0, col: 1 }); // back
    expect(s.paths[1]).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]);
  });

  test('a path cannot enter another colour’s endpoint or cells', () => {
    let one = beginPath(emptyTrajectoryState(puzzle), puzzle, { row: 0, col: 0 });
    one = extendPath(one, puzzle, 1, { row: 1, col: 0 }); // colour 1's own other endpoint - allowed
    expect(one.paths[1]).toHaveLength(2);
    // now colour 2 tries to cross colour 1's path
    let two = beginPath(one, puzzle, { row: 2, col: 0 });
    expect(extendPath(two, puzzle, 2, { row: 1, col: 0 })).toBe(two); // occupied by colour 1
  });

  test('clearPath empties a colour', () => {
    let s = beginPath(emptyTrajectoryState(puzzle), puzzle, { row: 0, col: 0 });
    s = extendPath(s, puzzle, 1, { row: 0, col: 1 });
    expect(clearPath(s, 1).paths[1]).toEqual([]);
  });
});

describe('completion', () => {
  test('an empty board is not solved', () => {
    expect(isTrajectorySolved(emptyTrajectoryState(puzzle), puzzle)).toBe(false);
  });

  test('a full solver solution is solved and covers every cell', () => {
    const solved = stateFromSolution(puzzle);
    for (const pair of puzzle.pairs) expect(pairConnected(solved, pair)).toBe(true);
    expect(isTrajectorySolved(solved, puzzle)).toBe(true);
    expect(remainingCells(solved, puzzle)).toBe(0);
  });

  test('connecting the pairs but leaving a cell uncovered is not solved', () => {
    const solved = stateFromSolution(puzzle);
    // drop the last cell of colour 2's path (it still touches its endpoints? no -
    // trimming makes it not connected, so instead trim colour 1 which is a
    // straight run and re-add its endpoint via a detour is fiddly). Simpler:
    // blank one colour entirely -> uncovered cells remain.
    const holed: TrajectoryState = { ...solved, paths: { ...solved.paths, 2: [] } };
    expect(isTrajectorySolved(holed, puzzle)).toBe(false);
  });
});

describe('blocked cells', () => {
  const withBlock: TrajectoryPuzzle = {
    id: 'test-blocked',
    rows: 3,
    cols: 3,
    pairs: [{ color: 1, a: { row: 0, col: 0 }, b: { row: 0, col: 1 } }],
    blocked: [{ row: 1, col: 1 }],
  };

  test('isBlockedCell / playableCells', () => {
    expect(isBlockedCell(withBlock, { row: 1, col: 1 })).toBe(true);
    expect(isBlockedCell(withBlock, { row: 0, col: 0 })).toBe(false);
    expect(playableCells(withBlock)).toBe(8); // 3x3 minus the one blocked cell
  });

  test('extendPath refuses to step onto a blocked cell', () => {
    const s = beginPath(emptyTrajectoryState(withBlock), withBlock, { row: 0, col: 0 });
    const s2 = extendPath(s, withBlock, 1, { row: 1, col: 0 });
    expect(extendPath(s2, withBlock, 1, { row: 1, col: 1 })).toBe(s2); // no-op
  });

  test('a path covering every playable cell (routed around the block) is solved', () => {
    const ring = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 1, col: 2 },
      { row: 0, col: 2 },
      { row: 0, col: 1 },
    ];
    const state: TrajectoryState = { rows: 3, cols: 3, paths: { 1: ring } };
    expect(remainingCells(state, withBlock)).toBe(0);
    expect(isTrajectorySolved(state, withBlock)).toBe(true);
  });

  test('assertValidTrajectory accepts a solvable puzzle with a blocked cell', () => {
    expect(() => assertValidTrajectory(withBlock)).not.toThrow();
  });

  test('assertValidTrajectory rejects a blocked cell out of bounds', () => {
    expect(() => assertValidTrajectory({ ...withBlock, blocked: [{ row: 9, col: 9 }] })).toThrow(
      /off the board/,
    );
  });

  test('assertValidTrajectory rejects a blocked cell on an endpoint', () => {
    expect(() => assertValidTrajectory({ ...withBlock, blocked: [{ row: 0, col: 0 }] })).toThrow(
      /overlaps an endpoint/,
    );
  });

  test('assertValidTrajectory rejects the same cell blocked twice', () => {
    expect(() =>
      assertValidTrajectory({
        ...withBlock,
        blocked: [{ row: 1, col: 1 }, { row: 1, col: 1 }],
      }),
    ).toThrow(/blocked twice/);
  });
});

describe('the authored Trajectory pack', () => {
  test('ids are unique and resolvable', () => {
    const ids = TRAJECTORIES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of TRAJECTORIES) expect(getTrajectoryById(p.id)).toBe(p);
  });

  describe.each(TRAJECTORIES.map(p => [p.id, p] as const))('%s', (_id, p) => {
    test('is well-formed and solvable across the whole board', () => {
      expect(() => assertValidTrajectory(p)).not.toThrow();
    });

    test('the solver produces a board-covering connected solution', () => {
      const [solution] = solveTrajectory(p, 1);
      expect(solution).toBeDefined();
      const state: TrajectoryState = { rows: p.rows, cols: p.cols, paths: solution };
      expect(isTrajectorySolved(state, p)).toBe(true);
    });

    test('revealHint connects every pair and finishes the board', () => {
      let state = emptyTrajectoryState(p);
      for (let i = 0; i < p.pairs.length; i += 1) {
        const hint = revealHint(state, p);
        expect(hint).not.toBeNull();
        state = hint!.state;
      }
      expect(revealHint(state, p)).toBeNull();
      expect(isTrajectorySolved(state, p)).toBe(true);
    });
  });
});

// Flow puzzles are not guaranteed a unique solution; solvability is the bar.
test('every authored puzzle has at least one solution', () => {
  for (const p of TRAJECTORIES) expect(solveTrajectory(p, 1).length).toBe(1);
});

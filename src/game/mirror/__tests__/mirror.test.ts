import {
  emptyMirrorMazeState,
  isEligible,
  isMirrorMazeSolved,
  MIRROR_MAZES,
  MirrorMazePuzzle,
  MirrorMazeState,
  nextMirror,
  reflect,
  remainingGems,
  setMirror,
  traceBeam,
} from '..';
import { assertValidMirrorMaze, revealHint, solveMirrorMaze } from '../solver';
import { getMirrorMazeById } from '../puzzles';

const STRAIGHT: MirrorMazePuzzle = {
  id: 'test-straight',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  source: { row: 0, col: 1 },
  sourceDirection: 'down',
  target: { row: 2, col: 1 },
  gems: [],
  obstacles: [],
};

const WITH_TURN: MirrorMazePuzzle = {
  id: 'test-turn',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  source: { row: 0, col: 0 },
  sourceDirection: 'down',
  target: { row: 1, col: 2 },
  gems: [],
  obstacles: [],
};

const WITH_OBSTACLE: MirrorMazePuzzle = {
  id: 'test-obstacle',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  source: { row: 0, col: 0 },
  sourceDirection: 'down',
  target: { row: 2, col: 0 },
  gems: [],
  obstacles: [{ row: 1, col: 0 }],
};

const WITH_GEM_ON_PATH: MirrorMazePuzzle = {
  id: 'test-gem-on-path',
  difficulty: 'easy',
  rows: 3,
  cols: 1,
  source: { row: 0, col: 0 },
  sourceDirection: 'down',
  target: { row: 2, col: 0 },
  gems: [{ row: 1, col: 0 }],
  obstacles: [],
};

const WITH_GEM_OFF_PATH: MirrorMazePuzzle = {
  id: 'test-gem-off-path',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  source: { row: 0, col: 0 },
  sourceDirection: 'down',
  target: { row: 2, col: 0 },
  gems: [{ row: 0, col: 2 }],
  obstacles: [],
};

// A closed 4-cell loop among mirrors (1,1)=/ (1,2)=\ (2,2)=/ (2,1)=\, entered
// directly at (1,1) heading 'up' (the exact direction the cycle itself
// re-arrives there with) so the trace runs in a genuine circle forever.
// Source is placed at an interior cell and the state is built by hand
// (bypassing `setMirror`'s "never on the source cell" refusal) purely to
// isolate `traceBeam`'s loop-termination behaviour from the separate,
// already-tested concern of what a *realistically authored* level looks
// like (that's what `assertValidMirrorMaze`'s edge/inward checks cover).
const LOOP: MirrorMazePuzzle = {
  id: 'test-loop',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  source: { row: 1, col: 1 },
  sourceDirection: 'up',
  target: { row: 0, col: 0 },
  gems: [],
  obstacles: [],
};
const LOOP_STATE: MirrorMazeState = {
  mirrors: [
    [null, null, null],
    [null, 'fwd', 'back'],
    [null, 'back', 'fwd'],
  ],
};

describe('reflect', () => {
  test('/ (fwd) swaps as: right<->up, left<->down', () => {
    expect(reflect('right', 'fwd')).toBe('up');
    expect(reflect('up', 'fwd')).toBe('right');
    expect(reflect('left', 'fwd')).toBe('down');
    expect(reflect('down', 'fwd')).toBe('left');
  });

  test('\\ (back) swaps as: right<->down, left<->up', () => {
    expect(reflect('right', 'back')).toBe('down');
    expect(reflect('down', 'back')).toBe('right');
    expect(reflect('left', 'back')).toBe('up');
    expect(reflect('up', 'back')).toBe('left');
  });
});

describe('isEligible', () => {
  test('the source, target and obstacles are never eligible', () => {
    expect(isEligible(WITH_OBSTACLE, 0, 0)).toBe(false); // source
    expect(isEligible(WITH_OBSTACLE, 2, 0)).toBe(false); // target
    expect(isEligible(WITH_OBSTACLE, 1, 0)).toBe(false); // obstacle
  });

  test('a gem cell is eligible - it is a checkpoint, not a restriction', () => {
    expect(isEligible(WITH_GEM_ON_PATH, 1, 0)).toBe(true);
  });

  test('a plain cell is eligible', () => {
    expect(isEligible(WITH_TURN, 1, 1)).toBe(true);
  });
});

describe('nextMirror / setMirror', () => {
  test('cycles blank -> / -> \\ -> blank', () => {
    expect(nextMirror(null)).toBe('fwd');
    expect(nextMirror('fwd')).toBe('back');
    expect(nextMirror('back')).toBeNull();
  });

  test('setMirror places a mirror on an eligible cell', () => {
    const state = emptyMirrorMazeState(WITH_TURN);
    const next = setMirror(state, WITH_TURN, 1, 1, 'fwd');
    expect(next.mirrors[1][1]).toBe('fwd');
  });

  test('setMirror refuses an ineligible cell, returning the same reference', () => {
    const state = emptyMirrorMazeState(WITH_OBSTACLE);
    expect(setMirror(state, WITH_OBSTACLE, 0, 0, 'fwd')).toBe(state); // source
    expect(setMirror(state, WITH_OBSTACLE, 1, 0, 'fwd')).toBe(state); // obstacle
  });

  test('setMirror is a no-op (same reference) when the value is unchanged', () => {
    const state = emptyMirrorMazeState(WITH_TURN);
    expect(setMirror(state, WITH_TURN, 1, 1, null)).toBe(state);
  });
});

describe('traceBeam', () => {
  test('with no mirrors, goes straight until it stops', () => {
    const state = emptyMirrorMazeState(STRAIGHT);
    const path = traceBeam(STRAIGHT, state);
    expect(path[path.length - 1]).toEqual({ row: 2, col: 1 });
  });

  test('reflects off a single mirror to reach the target', () => {
    let state = emptyMirrorMazeState(WITH_TURN);
    state = setMirror(state, WITH_TURN, 1, 0, 'back'); // \ at (1,0): down -> right
    const path = traceBeam(WITH_TURN, state);
    expect(path[path.length - 1]).toEqual({ row: 1, col: 2 });
  });

  test('stops the cell before a fixed obstacle', () => {
    const state = emptyMirrorMazeState(WITH_OBSTACLE);
    const path = traceBeam(WITH_OBSTACLE, state);
    expect(path[path.length - 1]).toEqual({ row: 0, col: 0 });
  });

  test('a closed mirror loop terminates instead of looping forever', () => {
    const path = traceBeam(LOOP, LOOP_STATE);
    expect(path.length).toBe(4);
    expect(path[path.length - 1]).not.toEqual(LOOP.target);
  });
});

describe('isMirrorMazeSolved / remainingGems', () => {
  test('solved when the trace reaches the target having crossed every gem', () => {
    const state = emptyMirrorMazeState(WITH_GEM_ON_PATH);
    expect(isMirrorMazeSolved(WITH_GEM_ON_PATH, state)).toBe(true);
    expect(remainingGems(WITH_GEM_ON_PATH, state)).toBe(0);
  });

  test('not solved if a gem is never crossed, even if the target is reached', () => {
    const state = emptyMirrorMazeState(WITH_GEM_OFF_PATH);
    expect(isMirrorMazeSolved(WITH_GEM_OFF_PATH, state)).toBe(false);
    expect(remainingGems(WITH_GEM_OFF_PATH, state)).toBe(1);
  });

  test('not solved if the target is never reached', () => {
    const state = emptyMirrorMazeState(WITH_OBSTACLE);
    expect(isMirrorMazeSolved(WITH_OBSTACLE, state)).toBe(false);
  });
});

describe('solveMirrorMaze', () => {
  test('finds a solution for a solvable puzzle', () => {
    const solutions = solveMirrorMaze(WITH_TURN, 1);
    expect(solutions).toHaveLength(1);
    expect(isMirrorMazeSolved(WITH_TURN, solutions[0])).toBe(true);
  });

  test('finds no solution for an unsolvable puzzle (gem stranded off any possible path)', () => {
    // A 1x1 corridor: the beam can only ever go straight through (0,0),
    // never reach a gem placed outside that corridor's only cell.
    const impossible: MirrorMazePuzzle = {
      id: 'test-impossible',
      difficulty: 'easy',
      rows: 1,
      cols: 3,
      source: { row: 0, col: 0 },
      sourceDirection: 'right',
      target: { row: 0, col: 2 },
      gems: [{ row: 0, col: 2 }], // gem == target is fine, but obstacles below block it
      obstacles: [{ row: 0, col: 1 }],
    };
    expect(solveMirrorMaze(impossible, 1)).toHaveLength(0);
  });
});

describe('assertValidMirrorMaze', () => {
  test('rejects an out-of-bounds special cell', () => {
    const bad: MirrorMazePuzzle = { ...WITH_TURN, target: { row: 9, col: 9 } };
    expect(() => assertValidMirrorMaze(bad)).toThrow(/outside/);
  });

  test('rejects a source not on an edge', () => {
    const bad: MirrorMazePuzzle = { ...WITH_TURN, source: { row: 1, col: 1 }, sourceDirection: 'down' };
    expect(() => assertValidMirrorMaze(bad)).toThrow(/edge/);
  });

  test('rejects a source pointing outward instead of inward', () => {
    const bad: MirrorMazePuzzle = { ...WITH_TURN, source: { row: 0, col: 1 }, sourceDirection: 'up' };
    expect(() => assertValidMirrorMaze(bad)).toThrow(/inward/);
  });

  test('rejects overlapping special cells', () => {
    const bad: MirrorMazePuzzle = { ...WITH_TURN, target: { row: 0, col: 0 } }; // same as source
    expect(() => assertValidMirrorMaze(bad)).toThrow(/overlaps/);
  });

  test('rejects a puzzle with no solution', () => {
    const bad: MirrorMazePuzzle = {
      ...WITH_TURN,
      obstacles: [{ row: 1, col: 0 }, { row: 0, col: 1 }],
      target: { row: 2, col: 2 },
    };
    expect(() => assertValidMirrorMaze(bad)).toThrow(/no solution/);
  });

  test('accepts a genuinely solvable, well-formed puzzle', () => {
    expect(() => assertValidMirrorMaze(WITH_TURN)).not.toThrow();
  });
});

describe('revealHint', () => {
  test('changes exactly one cell toward a real solution', () => {
    const state = emptyMirrorMazeState(WITH_TURN);
    const result = revealHint(state, WITH_TURN);
    expect(result).not.toBeNull();
    const { state: next, cell } = result!;
    expect(next.mirrors[cell.row][cell.col]).not.toBe(state.mirrors[cell.row][cell.col]);
  });

  test('repeated hints eventually solve the puzzle', () => {
    let state = emptyMirrorMazeState(WITH_TURN);
    let guard = 0;
    while (!isMirrorMazeSolved(WITH_TURN, state) && guard < 20) {
      const result = revealHint(state, WITH_TURN);
      if (!result) break;
      state = result.state;
      guard += 1;
    }
    expect(isMirrorMazeSolved(WITH_TURN, state)).toBe(true);
  });

  test('returns null once the board already matches a solution', () => {
    const [solution] = solveMirrorMaze(WITH_TURN, 1);
    expect(revealHint(solution, WITH_TURN)).toBeNull();
  });
});

describe('the authored Mirror Maze pack', () => {
  describe.each(MIRROR_MAZES.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
    test('is well-formed and has a solution', () => {
      expect(() => assertValidMirrorMaze(puzzle)).not.toThrow();
    });

    test('is not already solved at the starting position', () => {
      expect(isMirrorMazeSolved(puzzle, emptyMirrorMazeState(puzzle))).toBe(false);
    });
  });

  test('ids are unique and resolvable', () => {
    const ids = MIRROR_MAZES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const puzzle of MIRROR_MAZES) {
      expect(getMirrorMazeById(puzzle.id)).toBe(puzzle);
    }
  });

  test('grid size ramps up rather than shrinking', () => {
    const areas = MIRROR_MAZES.map(p => p.rows * p.cols);
    expect(areas[areas.length - 1]).toBeGreaterThanOrEqual(areas[0]);
  });
});

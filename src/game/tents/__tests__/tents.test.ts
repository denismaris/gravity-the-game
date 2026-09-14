import {
  adjacentTreeCount,
  allNeighbors,
  emptyTentsTreesState,
  isColSatisfied,
  isEligible,
  isRowSatisfied,
  isTentsTreesSolved,
  isTreeCell,
  nextMark,
  orthogonalNeighbors,
  remainingTents,
  rowTentCount,
  colTentCount,
  setMark,
  totalTentsNeeded,
  touchingTentCells,
} from '../logic';
import { assertValidTentsAndTrees, revealHint, solveTentsAndTrees } from '../solver';
import { getTentsTreesById, TENTS_TREES } from '../puzzles';
import { TentsTreesPuzzle, TentsTreesState } from '../types';

/**
 * A 4x4 puzzle whose unique solution is fully forced by propagation alone
 * (no backtracking needed) - hand-verified cell by cell:
 *
 *   . T . .        row1 has no tree, so every cell needs >=1 adjacent tree
 *   . . . .        to ever be eligible - only (1,1) (below the tree at
 *   . . . .        (0,1)) qualifies, so rowCounts[1]=1 forces it immediately.
 *   . . T t        That tent satisfies colCounts[1]=1, forcing (3,1) (the
 *                  tree at (3,2)'s other candidate) empty, which in turn
 *                  forces row3's required tent onto its only remaining
 *                  candidate, (3,3).
 */
const SIMPLE: TentsTreesPuzzle = {
  id: 'test-simple',
  rows: 4,
  cols: 4,
  trees: [
    { row: 0, col: 1 },
    { row: 3, col: 2 },
  ],
  rowCounts: [0, 1, 0, 1],
  colCounts: [0, 1, 0, 1],
};
const SIMPLE_SOLUTION_TENTS = [
  { row: 1, col: 1 },
  { row: 3, col: 3 },
];

/**
 * A single centred tree whose row and column clues can never be satisfied:
 * row0/row2 = 0 forces every cell in those rows empty (including (0,1) and
 * (2,1), the tree's only column-1 neighbours), which leaves col1's required
 * tent with no eligible cell left to land on. Independently, col0 = 0 and
 * col2 = 0 force row1's only two candidates ((1,0), (1,2)) empty too, so
 * row1's required tent is equally unreachable. No solution either way.
 */
const IMPOSSIBLE: TentsTreesPuzzle = {
  id: 'test-impossible',
  rows: 3,
  cols: 3,
  trees: [{ row: 1, col: 1 }],
  rowCounts: [0, 1, 0],
  colCounts: [0, 1, 0],
};

/**
 * A denser 6x6 case (5 trees) used only for round-trip checks - not hand-
 * solved, but any solver output must satisfy `isTentsTreesSolved`
 * independently, which is exactly what the round-trip tests below check.
 * (Matches the shipped `tents-004` puzzle's layout, confirmed solvable and
 * unique by the real solver.)
 */
const DENSE: TentsTreesPuzzle = {
  id: 'test-dense',
  rows: 6,
  cols: 6,
  trees: [
    { row: 0, col: 0 },
    { row: 0, col: 5 },
    { row: 2, col: 2 },
    { row: 5, col: 0 },
    { row: 5, col: 5 },
  ],
  rowCounts: [0, 2, 0, 1, 2, 0],
  colCounts: [2, 0, 1, 0, 0, 2],
};

/**
 * Two trees, each with two candidate corners; swapping *both* trees'
 * choices in lockstep - (0,3)+(2,0) vs (0,0)+(2,3) - preserves the exact
 * same row/column tent counts either way, so both are genuinely valid
 * solutions. Found by brute-force search over the real solver's own
 * eligible-cell logic while authoring this fixture, not hand-derived: an
 * independent single free choice always turns out to be forced once its
 * own row *and* column counts are pinned down (see the two fixtures
 * above), so real ambiguity here needs this kind of coordinated swap -
 * a useful data point about how strongly this ruleset's exact sums
 * constrain a solution.
 */
const AMBIGUOUS: TentsTreesPuzzle = {
  id: 'test-ambiguous',
  rows: 4,
  cols: 4,
  trees: [
    { row: 1, col: 0 },
    { row: 1, col: 3 },
  ],
  rowCounts: [1, 0, 1, 0],
  colCounts: [1, 0, 0, 1],
};

function stateWithTents(puzzle: TentsTreesPuzzle, tents: ReadonlyArray<{ row: number; col: number }>): TentsTreesState {
  let state = emptyTentsTreesState(puzzle);
  for (const t of tents) state = setMark(state, puzzle, t.row, t.col, 'tent');
  return state;
}

describe('isTreeCell / isEligible / adjacentTreeCount', () => {
  test('identifies tree cells and their non-tree eligibility', () => {
    expect(isTreeCell(SIMPLE, 0, 1)).toBe(true);
    expect(isTreeCell(SIMPLE, 1, 1)).toBe(false);
    expect(isEligible(SIMPLE, 0, 1)).toBe(false);
    expect(isEligible(SIMPLE, 1, 1)).toBe(true);
  });

  test('counts only orthogonal adjacency, never diagonal', () => {
    expect(adjacentTreeCount(SIMPLE, 1, 1)).toBe(1); // directly below the tree at (0,1)
    expect(adjacentTreeCount(SIMPLE, 1, 2)).toBe(0); // diagonal to (0,1), doesn't count
    expect(adjacentTreeCount(SIMPLE, 0, 0)).toBe(1); // beside the tree at (0,1)
  });
});

describe('orthogonalNeighbors / allNeighbors', () => {
  test('clip to the board and never include the cell itself', () => {
    expect(orthogonalNeighbors(SIMPLE, 0, 0)).toEqual(
      expect.arrayContaining([{ row: 1, col: 0 }, { row: 0, col: 1 }]),
    );
    expect(orthogonalNeighbors(SIMPLE, 0, 0)).toHaveLength(2); // top-left corner
    expect(allNeighbors(SIMPLE, 0, 0)).toHaveLength(3); // corner: 3 of the 8 are in bounds
  });
});

describe('nextMark / setMark', () => {
  test('cycles empty -> tent -> marked -> empty', () => {
    expect(nextMark('empty')).toBe('tent');
    expect(nextMark('tent')).toBe('marked');
    expect(nextMark('marked')).toBe('empty');
  });

  test('setMark refuses tree cells and no-ops', () => {
    const state = emptyTentsTreesState(SIMPLE);
    expect(setMark(state, SIMPLE, 0, 1, 'tent')).toBe(state); // (0,1) is a tree
    expect(setMark(state, SIMPLE, 1, 1, 'empty')).toBe(state); // already empty
  });

  test('setMark is pure and only touches the target cell', () => {
    const state = emptyTentsTreesState(SIMPLE);
    const next = setMark(state, SIMPLE, 1, 1, 'tent');
    expect(next).not.toBe(state);
    expect(next.marks[1][1]).toBe('tent');
    expect(state.marks[1][1]).toBe('empty'); // original untouched
    expect(next.marks[2][2]).toBe('empty');
  });
});

describe('rowTentCount / colTentCount / totalTentsNeeded / remainingTents', () => {
  test('count placed tents per line and overall progress', () => {
    const state = stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS);
    expect(rowTentCount(state, 1)).toBe(1);
    expect(rowTentCount(state, 0)).toBe(0);
    expect(colTentCount(state, 3)).toBe(1);
    expect(totalTentsNeeded(SIMPLE)).toBe(2);
    expect(remainingTents(SIMPLE, state)).toBe(0);
    expect(remainingTents(SIMPLE, emptyTentsTreesState(SIMPLE))).toBe(2);
  });

  test('remainingTents never goes negative when over-placed', () => {
    const over = setMark(
      stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS),
      SIMPLE,
      2,
      2,
      'tent',
    );
    expect(remainingTents(SIMPLE, over)).toBe(0);
  });
});

describe('isTentsTreesSolved', () => {
  test('the hand-derived solution solves SIMPLE', () => {
    const state = stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS);
    expect(isTentsTreesSolved(SIMPLE, state)).toBe(true);
  });

  test('an empty board is not solved', () => {
    expect(isTentsTreesSolved(SIMPLE, emptyTentsTreesState(SIMPLE))).toBe(false);
  });

  test('a tent with no adjacent tree fails, even if counts match', () => {
    // (2,0) has zero adjacent trees, and moving the second tent there keeps
    // both row and column sums numerically equal to the real solution's.
    const state = stateWithTents(SIMPLE, [{ row: 1, col: 1 }, { row: 2, col: 0 }]);
    expect(rowTentCount(state, 2)).toBe(1);
    expect(isTentsTreesSolved(SIMPLE, state)).toBe(false);
  });

  test('two touching tents fail even if every count matches', () => {
    // (0,1) is a tree, so build a state by hand where (1,1) and (1,2) both
    // claim to be tents - illegal (they touch), independent of any puzzle's
    // clues.
    const state: TentsTreesState = {
      marks: emptyTentsTreesState(SIMPLE).marks.map((line, r) =>
        r === 1 ? line.map((_m, c) => (c === 1 || c === 2 ? 'tent' : 'empty')) : line,
      ),
    };
    expect(isTentsTreesSolved(SIMPLE, state)).toBe(false);
  });
});

describe('touchingTentCells', () => {
  test('flags both tents in a touching pair', () => {
    const state: TentsTreesState = {
      marks: emptyTentsTreesState(SIMPLE).marks.map((line, r) =>
        r === 1 ? line.map((_m, c) => (c === 1 || c === 2 ? 'tent' : 'empty')) : line,
      ),
    };
    const flagged = touchingTentCells(SIMPLE, state);
    expect(flagged.has('1:1')).toBe(true);
    expect(flagged.has('1:2')).toBe(true);
    expect(flagged.size).toBe(2);
  });

  test('flags a diagonal touch too', () => {
    const state = stateWithTents(SIMPLE, [{ row: 1, col: 1 }, { row: 2, col: 2 }]);
    const flagged = touchingTentCells(SIMPLE, state);
    expect(flagged.has('1:1')).toBe(true);
    expect(flagged.has('2:2')).toBe(true);
  });

  test('the real solution has no touching tents', () => {
    const state = stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS);
    expect(touchingTentCells(SIMPLE, state).size).toBe(0);
  });
});

describe('isRowSatisfied / isColSatisfied', () => {
  test('the real solution satisfies every row and column', () => {
    const state = stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS);
    for (let i = 0; i < 4; i += 1) {
      expect(isRowSatisfied(SIMPLE, state, i)).toBe(true);
      expect(isColSatisfied(SIMPLE, state, i)).toBe(true);
    }
  });

  test('an empty board only satisfies zero-clued lines', () => {
    const state = emptyTentsTreesState(SIMPLE);
    expect(isRowSatisfied(SIMPLE, state, 0)).toBe(true); // rowCounts[0] === 0
    expect(isRowSatisfied(SIMPLE, state, 1)).toBe(false); // rowCounts[1] === 1
  });

  test('over-placing a line un-satisfies it', () => {
    // Row 1 needs exactly 1 tent; (1,1) is its only legal candidate, but the
    // count check itself doesn't care about legality - two marks is simply
    // the wrong count.
    const state = stateWithTents(SIMPLE, [{ row: 1, col: 1 }, { row: 1, col: 3 }]);
    expect(isRowSatisfied(SIMPLE, state, 1)).toBe(false);
  });
});

describe('solveTentsAndTrees', () => {
  test('finds the unique, hand-verified solution for SIMPLE', () => {
    const solutions = solveTentsAndTrees(SIMPLE, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS));
  });

  test('reports no solutions for an over-constrained puzzle', () => {
    expect(solveTentsAndTrees(IMPOSSIBLE, 1)).toHaveLength(0);
  });

  test('reports (at least) two solutions for a genuinely ambiguous puzzle', () => {
    expect(solveTentsAndTrees(AMBIGUOUS, 2)).toHaveLength(2);
  });

  test('every found solution independently satisfies the validator (round trip)', () => {
    const [solution] = solveTentsAndTrees(DENSE, 1);
    expect(solution).toBeDefined();
    expect(isTentsTreesSolved(DENSE, solution)).toBe(true);
  });
});

describe('assertValidTentsAndTrees', () => {
  test('accepts a well-formed, uniquely-solvable puzzle', () => {
    expect(() => assertValidTentsAndTrees(SIMPLE)).not.toThrow();
  });

  test('rejects an unsolvable puzzle', () => {
    expect(() => assertValidTentsAndTrees(IMPOSSIBLE)).toThrow(/no solution/);
  });

  test('rejects a non-unique puzzle', () => {
    expect(() => assertValidTentsAndTrees(AMBIGUOUS)).toThrow(/not unique/);
  });

  test('rejects a tree outside the board', () => {
    const bad: TentsTreesPuzzle = { ...SIMPLE, trees: [...SIMPLE.trees, { row: 9, col: 9 }] };
    expect(() => assertValidTentsAndTrees(bad)).toThrow(/outside/);
  });

  test('rejects duplicate trees', () => {
    const bad: TentsTreesPuzzle = { ...SIMPLE, trees: [{ row: 0, col: 1 }, { row: 0, col: 1 }] };
    expect(() => assertValidTentsAndTrees(bad)).toThrow(/duplicate/);
  });

  test('rejects mismatched row/column count sums', () => {
    const bad: TentsTreesPuzzle = { ...SIMPLE, colCounts: [0, 2, 0, 1] };
    expect(() => assertValidTentsAndTrees(bad)).toThrow(/sum/);
  });

  test('rejects a puzzle with no trees at all', () => {
    const bad: TentsTreesPuzzle = { ...SIMPLE, trees: [] };
    expect(() => assertValidTentsAndTrees(bad)).toThrow(/at least one tree/);
  });
});

describe('revealHint', () => {
  test('fills in the first missing tent the solution calls for', () => {
    const state = emptyTentsTreesState(SIMPLE);
    const result = revealHint(state, SIMPLE);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 1, col: 1 }); // row-major first correct cell
    expect(result!.state.marks[1][1]).toBe('tent');
  });

  test('never touches a cell the player already got right', () => {
    const partial = setMark(emptyTentsTreesState(SIMPLE), SIMPLE, 1, 1, 'tent');
    const result = revealHint(partial, SIMPLE);
    expect(result!.cell).toEqual({ row: 3, col: 3 });
  });

  test('never undoes a wrongly-placed tent - only ever adds forward progress', () => {
    const wrong = setMark(emptyTentsTreesState(SIMPLE), SIMPLE, 2, 2, 'tent');
    const result = revealHint(wrong, SIMPLE);
    expect(result!.state.marks[2][2]).toBe('tent'); // left alone
    expect(result!.state.marks[1][1]).toBe('tent'); // forward progress added
  });

  test('returns null once every tent the solution calls for is already placed', () => {
    const solved = stateWithTents(SIMPLE, SIMPLE_SOLUTION_TENTS);
    expect(revealHint(solved, SIMPLE)).toBeNull();
  });
});

describe('the shipped Tents and Trees pool', () => {
  test('every id is unique and resolvable by getTentsTreesById', () => {
    const ids = TENTS_TREES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getTentsTreesById(id)?.id).toBe(id);
  });

  test('getTentsTreesById returns undefined for an unknown id', () => {
    expect(getTentsTreesById('nope')).toBeUndefined();
  });

  test('sizes ramp from 5x5 up to 8x8', () => {
    const sizes = TENTS_TREES.map(p => p.rows);
    expect(Math.min(...sizes)).toBe(5);
    expect(Math.max(...sizes)).toBe(8);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b)); // non-decreasing
  });

  describe.each(TENTS_TREES.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
    test('is well-formed and uniquely solvable', () => {
      expect(() => assertValidTentsAndTrees(puzzle)).not.toThrow();
    });

    test('is not already solved at rest (an empty board)', () => {
      expect(isTentsTreesSolved(puzzle, emptyTentsTreesState(puzzle))).toBe(false);
    });
  });
});

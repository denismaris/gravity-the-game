import {
  colValues,
  constraintKey,
  constraintPartner,
  duplicateLineGroups,
  duplicateLines,
  emptyBinairoState,
  hasTripleRun,
  isBinairoSolved,
  isColHealthy,
  isConstraintViolated,
  isGiven,
  isRowHealthy,
  isTwinViolated,
  nextValue,
  remainingCells,
  setValue,
  tripleRunCells,
  tripleRunGroups,
  twinKey,
  twinPartner,
  unbalancedLines,
  violatedConstraints,
  violatedTwins,
} from '../logic';
import { assertValidBinairo, revealHint, solveBinairo } from '../solver';
import { BINAIRO, BINAIRO_SOLUTION_GRIDS, getBinairoById } from '../puzzles';
import { BinairoConstraint, BinairoPuzzle, BinairoState, BinairoValue } from '../types';

/**
 * A hand-verified 4x4 solution, built by rotating the base row `0,0,1,1`
 * (checked *circularly* - including the wrap-around windows (2,3,0) and
 * (3,0,1) - for triple-freedom, which is what guarantees every rotation
 * used as a row, and every resulting column, is independently valid; see
 * `rotateGrid`'s comment in puzzles.ts for the full argument):
 *
 *   0 0 1 1
 *   0 1 1 0
 *   1 1 0 0
 *   1 0 0 1
 *
 * `SIMPLE` blanks only the puzzle's top-left two cells. Row 0 already has
 * two 1s (its full quota), so the quota rule alone forces both blanks to
 * 0 without any backtracking - a clean, fully-traced propagation case.
 */
const SIMPLE_SOLUTION_GRID: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 0, 1, 1],
  [0, 1, 1, 0],
  [1, 1, 0, 0],
  [1, 0, 0, 1],
];
const SIMPLE: BinairoPuzzle = {
  id: 'test-simple',
  size: 4,
  givens: [
    [null, null, 1, 1],
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [1, 0, 0, 1],
  ],
};
const SIMPLE_SOLUTION: BinairoState = { values: SIMPLE_SOLUTION_GRID };

/** A row that already has three equal values placed - an immediate,
 * un-propagatable contradiction, independent of anything else on the
 * board. */
const IMPOSSIBLE: BinairoPuzzle = {
  id: 'test-impossible',
  size: 4,
  givens: [
    [0, 0, 0, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
};

/** A fully blank board - many valid completions exist. */
const UNCLUED: BinairoPuzzle = {
  id: 'test-unclued',
  size: 4,
  givens: [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
  ],
};

/**
 * A second 4x4 solution (distinct from `SIMPLE_SOLUTION_GRID`, hand-
 * verified the same way - see that constant's own comment), blanked only
 * at (0,0) and (1,0). The base ruleset alone already pins this down to
 * exactly one solution ((0,0)=0, (1,0)=1) - checked directly below, not
 * assumed - which is what makes it a clean base for the constraint tests
 * that follow: a constraint *consistent* with that lone solution should
 * change nothing, and one that *contradicts* it should make the puzzle
 * unsolvable, proving the solver is actually enforcing constraints rather
 * than silently ignoring them.
 */
const CONSTRAINT_BASE_SOLUTION: ReadonlyArray<ReadonlyArray<0 | 1>> = [
  [0, 0, 1, 1],
  [1, 1, 0, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0],
];
function constraintBasePuzzle(id: string, constraints?: ReadonlyArray<BinairoConstraint>): BinairoPuzzle {
  const givens = CONSTRAINT_BASE_SOLUTION.map(row => row.slice() as (0 | 1 | null)[]);
  givens[0][0] = null;
  givens[1][0] = null;
  return { id, size: 4, givens, constraints };
}

/**
 * Same base solution and same "blank exactly the two cells under test,
 * base rules alone already pin both" design as `constraintBasePuzzle`,
 * parameterized by which cells to blank so twin tests can pick a pair
 * whose forced values happen to agree (a clean "consistent" case) or
 * disagree (a clean "contradicting" case) from the one grid.
 */
function twinBasePuzzle(id: string, blank: ReadonlyArray<{ row: number; col: number }>, twinCells?: ReadonlyArray<{ row: number; col: number }>): BinairoPuzzle {
  const givens = CONSTRAINT_BASE_SOLUTION.map(row => row.slice() as (0 | 1 | null)[]);
  for (const cell of blank) givens[cell.row][cell.col] = null;
  return { id, size: 4, givens, twinCells };
}

describe('hasTripleRun', () => {
  test('detects a run of three, ignoring blanks', () => {
    expect(hasTripleRun([0, 0, 0, 1])).toBe(true);
    expect(hasTripleRun([0, 0, 1, 0])).toBe(false);
    expect(hasTripleRun([null, 0, 0])).toBe(false);
    expect(hasTripleRun([1, 1, 0, 1, 1])).toBe(false);
  });
});

describe('tripleRunGroups', () => {
  test('a plain triple is one group spanning its three cells', () => {
    const state: BinairoState = {
      values: [[0, 0, 0, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]],
    };
    const groups = tripleRunGroups(state);
    expect(groups).toEqual([{ orientation: 'row', index: 0, start: 0, end: 2 }]);
  });

  test('a run of four is one group, not two overlapping ones', () => {
    const state: BinairoState = {
      values: [[1, 1, 1, 1], [null, null, null, null], [null, null, null, null], [null, null, null, null]],
    };
    const groups = tripleRunGroups(state);
    expect(groups).toEqual([{ orientation: 'row', index: 0, start: 0, end: 3 }]);
  });

  test('finds a column run the same way', () => {
    const state: BinairoState = {
      values: [[0, null, null, null], [0, null, null, null], [0, null, null, null], [null, null, null, null]],
    };
    const groups = tripleRunGroups(state);
    expect(groups).toEqual([{ orientation: 'col', index: 0, start: 0, end: 2 }]);
  });

  test('a healthy board has no groups', () => {
    expect(tripleRunGroups(SIMPLE_SOLUTION)).toEqual([]);
  });
});

describe('tripleRunCells', () => {
  test('flags exactly the three cells of a row triple', () => {
    const state: BinairoState = {
      values: [
        [0, 0, 0, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
      ],
    };
    const cells = tripleRunCells(state);
    expect(cells.has('0:0')).toBe(true);
    expect(cells.has('0:1')).toBe(true);
    expect(cells.has('0:2')).toBe(true);
    expect(cells.has('0:3')).toBe(false);
    expect(cells.size).toBe(3);
  });

  test('flags a column triple the same way', () => {
    const state: BinairoState = {
      values: [[1, null, null, null], [1, null, null, null], [1, null, null, null], [null, null, null, null]],
    };
    const cells = tripleRunCells(state);
    expect(cells.has('0:0')).toBe(true);
    expect(cells.has('1:0')).toBe(true);
    expect(cells.has('2:0')).toBe(true);
    expect(cells.size).toBe(3);
  });

  test('a healthy board has no flagged cells', () => {
    expect(tripleRunCells(SIMPLE_SOLUTION).size).toBe(0);
  });
});

describe('unbalancedLines', () => {
  test('flags a full row whose split is unequal', () => {
    const state: BinairoState = { values: [[0, 1, 0, 0], [null, null, null, null], [null, null, null, null], [null, null, null, null]] };
    expect(unbalancedLines(SIMPLE, state).rows.has(0)).toBe(true);
  });

  test('a still-blank row is never flagged, however skewed so far', () => {
    const state: BinairoState = { values: [[0, 0, 0, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]] };
    expect(unbalancedLines(SIMPLE, state).rows.has(0)).toBe(false);
  });

  test('the real solution has no unbalanced lines', () => {
    const result = unbalancedLines(SIMPLE, SIMPLE_SOLUTION);
    expect(result.rows.size).toBe(0);
    expect(result.cols.size).toBe(0);
  });
});

describe('duplicateLines', () => {
  test('flags two identical full rows, not a lone one', () => {
    const state: BinairoState = {
      values: [[0, 0, 1, 1], [0, 0, 1, 1], [1, 1, 0, 0], [null, null, null, null]],
    };
    const result = duplicateLines(SIMPLE, state);
    expect(result.rows.has(0)).toBe(true);
    expect(result.rows.has(1)).toBe(true);
    expect(result.rows.has(2)).toBe(false);
  });

  test('a row matching another only once it is filled in is not flagged early', () => {
    const state: BinairoState = {
      values: [[0, 0, 1, null], [0, 0, 1, 1], [null, null, null, null], [null, null, null, null]],
    };
    expect(duplicateLines(SIMPLE, state).rows.size).toBe(0);
  });

  test('the real solution has no duplicate lines', () => {
    const result = duplicateLines(SIMPLE, SIMPLE_SOLUTION);
    expect(result.rows.size).toBe(0);
    expect(result.cols.size).toBe(0);
  });
});

describe('duplicateLineGroups', () => {
  test('groups the matching rows together, one group per distinct content', () => {
    const state: BinairoState = {
      values: [[0, 0, 1, 1], [0, 0, 1, 1], [1, 1, 0, 0], [1, 1, 0, 0]],
    };
    const groups = duplicateLineGroups(SIMPLE, state);
    expect(groups.rows).toEqual([[0, 1], [2, 3]]);
  });

  test('a lone full row forms no group', () => {
    const groups = duplicateLineGroups(SIMPLE, SIMPLE_SOLUTION);
    expect(groups.rows).toEqual([]);
    expect(groups.cols).toEqual([]);
  });
});

describe('isRowHealthy / isColHealthy', () => {
  test('every row and column of the real solution is healthy', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(isRowHealthy(SIMPLE, SIMPLE_SOLUTION, i)).toBe(true);
      expect(isColHealthy(SIMPLE, SIMPLE_SOLUTION, i)).toBe(true);
    }
  });

  test('a blank row is not healthy', () => {
    expect(isRowHealthy(SIMPLE, emptyBinairoState(SIMPLE), 0)).toBe(false);
  });

  test('a full but unbalanced or tripled row is not healthy', () => {
    const unbalanced: BinairoState = { values: [[0, 1, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 1]] };
    expect(isRowHealthy(SIMPLE, unbalanced, 0)).toBe(false);

    const tripled: BinairoState = { values: [[0, 0, 0, 1], [0, 1, 1, 0], [1, 1, 0, 0], [1, 0, 0, 1]] };
    expect(isRowHealthy(SIMPLE, tripled, 0)).toBe(false);
  });
});

describe('isGiven / nextValue / setValue', () => {
  test('cycles blank -> ring (0) -> dot (1) -> blank', () => {
    expect(nextValue(null)).toBe(0);
    expect(nextValue(0)).toBe(1);
    expect(nextValue(1)).toBeNull();
  });

  test('setValue refuses given cells and no-ops', () => {
    const state = emptyBinairoState(SIMPLE);
    expect(isGiven(SIMPLE, 1, 0)).toBe(true);
    expect(setValue(state, SIMPLE, 1, 0, 1)).toBe(state);
    expect(setValue(state, SIMPLE, 0, 0, null)).toBe(state); // already blank
  });

  test('setValue is pure and only touches the target cell', () => {
    const state = emptyBinairoState(SIMPLE);
    const next = setValue(state, SIMPLE, 0, 0, 0);
    expect(next).not.toBe(state);
    expect(next.values[0][0]).toBe(0);
    expect(state.values[0][0]).toBeNull();
  });
});

describe('emptyBinairoState / colValues / remainingCells', () => {
  test('starts from the givens, not from scratch', () => {
    const state = emptyBinairoState(SIMPLE);
    expect(state.values[1]).toEqual([0, 1, 1, 0]);
    expect(state.values[0]).toEqual([null, null, 1, 1]);
  });

  test('colValues reads a column top to bottom', () => {
    expect(colValues(SIMPLE_SOLUTION, 0)).toEqual([0, 0, 1, 1]);
  });

  test('remainingCells counts blanks only', () => {
    expect(remainingCells(emptyBinairoState(SIMPLE))).toBe(2);
    expect(remainingCells(SIMPLE_SOLUTION)).toBe(0);
  });
});

describe('isBinairoSolved', () => {
  test('the real solution solves SIMPLE', () => {
    expect(isBinairoSolved(SIMPLE, SIMPLE_SOLUTION)).toBe(true);
  });

  test('a partially-filled board is not solved', () => {
    expect(isBinairoSolved(SIMPLE, emptyBinairoState(SIMPLE))).toBe(false);
  });

  test('a triple run fails even if the rest of the board is fine', () => {
    const broken: BinairoState = {
      values: [
        [0, 0, 0, 1],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 1, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, broken)).toBe(false);
  });

  test('an unbalanced row fails even with no triple and no duplicate', () => {
    // Row 0 has three 0s and one 1 - no run of three, not a repeat of any
    // other row, but the wrong split for a 4-wide board (needs 2 and 2).
    const unbalanced: BinairoState = {
      values: [
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, unbalanced)).toBe(false);
  });

  test('two identical rows fail even if each is individually valid', () => {
    const duplicateRows: BinairoState = {
      values: [
        [0, 0, 1, 1],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ],
    };
    expect(isBinairoSolved(SIMPLE, duplicateRows)).toBe(false);
  });
});

describe('solveBinairo', () => {
  test('finds the unique solution for SIMPLE via quota propagation alone', () => {
    const solutions = solveBinairo(SIMPLE, 2);
    expect(solutions).toHaveLength(1);
    expect(solutions[0]).toEqual(SIMPLE_SOLUTION);
  });

  test('reports no solutions when a triple is already given', () => {
    expect(solveBinairo(IMPOSSIBLE, 1)).toHaveLength(0);
  });

  test('reports multiple solutions for a fully blank board', () => {
    expect(solveBinairo(UNCLUED, 2)).toHaveLength(2);
  });

  test('every solution found independently satisfies the validator (round trip)', () => {
    for (const solution of solveBinairo(UNCLUED, 3)) {
      expect(isBinairoSolved(UNCLUED, solution)).toBe(true);
    }
  });
});

describe('constraint tiles', () => {
  const rightSame: BinairoConstraint = { row: 0, col: 1, direction: 'right', kind: 'same' };
  // A distinct edge from `rightSame` - two markers can never share one edge, so the
  // key-collision that would cause is never a real case, only a test-authoring trap.
  const rightDifferent: BinairoConstraint = { row: 3, col: 0, direction: 'right', kind: 'different' };
  const downSame: BinairoConstraint = { row: 2, col: 2, direction: 'down', kind: 'same' };

  describe('constraintPartner', () => {
    test('right points one column over on the same row', () => {
      expect(constraintPartner(rightSame)).toEqual({ row: 0, col: 2 });
    });
    test('down points one row down in the same column', () => {
      expect(constraintPartner(downSame)).toEqual({ row: 3, col: 2 });
    });
  });

  describe('isConstraintViolated / violatedConstraints', () => {
    const values: BinairoValue[][] = [
      [0, 0, 1, 1],
      [1, 1, 0, 0],
      [0, 1, null, 1],
      [1, 0, 0, 0],
    ];
    const state: BinairoState = { values };

    test('never violated while either side is still blank', () => {
      // (2,2) is blank - not yet decided, so not yet broken either way.
      expect(isConstraintViolated(state, downSame)).toBe(false);
    });

    test('a `same` constraint is violated when both sides are decided and differ', () => {
      // (0,1)=0, (0,2)=1 - both decided, unequal.
      expect(isConstraintViolated(state, rightSame)).toBe(true);
    });

    test('a `different` constraint is satisfied when both sides are decided and differ', () => {
      // (3,0)=1, (3,1)=0 - both decided, unequal.
      expect(isConstraintViolated(state, rightDifferent)).toBe(false);
    });

    test('violatedConstraints reports exactly the broken ones, keyed', () => {
      const puzzle: BinairoPuzzle = { id: 'x', size: 4, givens: values, constraints: [rightSame, rightDifferent, downSame] };
      const violated = violatedConstraints(puzzle, state);
      expect(violated.has(constraintKey(rightSame))).toBe(true);
      expect(violated.has(constraintKey(rightDifferent))).toBe(false);
      expect(violated.has(constraintKey(downSame))).toBe(false);
      expect(violated.size).toBe(1);
    });
  });

  describe('isBinairoSolved with constraints', () => {
    const solution: BinairoState = { values: CONSTRAINT_BASE_SOLUTION };

    test('a puzzle with no constraints is unaffected', () => {
      const puzzle = constraintBasePuzzle('no-constraints');
      expect(isBinairoSolved(puzzle, solution)).toBe(true);
    });

    test('solved requires every constraint to be met, not just unbroken', () => {
      // (0,0)=0, (1,0)=1 in the true solution - 'different' holds.
      const satisfied: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'different' };
      const contradicted: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'same' };
      expect(isBinairoSolved(constraintBasePuzzle('sat', [satisfied]), solution)).toBe(true);
      expect(isBinairoSolved(constraintBasePuzzle('con', [contradicted]), solution)).toBe(false);
    });

    test('a constraint between two still-blank cells blocks "solved" even if every base rule passes', () => {
      const betweenBlanks: BinairoConstraint = { row: 0, col: 0, direction: 'right', kind: 'same' };
      const state: BinairoState = { values: [[null, null, 1, 1], [1, 1, 0, 0], [0, 1, 0, 1], [1, 0, 1, 0]] };
      const puzzle: BinairoPuzzle = { id: 'blank-pair', size: 4, givens: state.values, constraints: [betweenBlanks] };
      expect(isBinairoSolved(puzzle, state)).toBe(false);
    });
  });

  describe('solver enforcement', () => {
    test('the base puzzle alone already has exactly one solution', () => {
      expect(solveBinairo(constraintBasePuzzle('base'), 3)).toHaveLength(1);
    });

    test('a constraint consistent with the lone solution leaves it unique', () => {
      const consistent: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'different' };
      const solutions = solveBinairo(constraintBasePuzzle('consistent', [consistent]), 3);
      expect(solutions).toHaveLength(1);
      expect(solutions[0].values).toEqual(CONSTRAINT_BASE_SOLUTION);
    });

    test('a constraint contradicting the lone solution makes the puzzle unsolvable - proof the solver actually enforces it, not just checks it at the end', () => {
      const contradicting: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'same' };
      expect(solveBinairo(constraintBasePuzzle('contradicting', [contradicting]), 3)).toHaveLength(0);
    });

    test('assertValidBinairo rejects a puzzle whose constraints contradict its own unique solution', () => {
      const contradicting: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'same' };
      expect(() => assertValidBinairo(constraintBasePuzzle('invalid', [contradicting]))).toThrow(/no solution/);
    });

    test('assertValidBinairo accepts a puzzle whose constraints agree with its unique solution', () => {
      const consistent: BinairoConstraint = { row: 0, col: 0, direction: 'down', kind: 'different' };
      expect(() => assertValidBinairo(constraintBasePuzzle('valid', [consistent]))).not.toThrow();
    });
  });
});

describe('twin cells', () => {
  // On a 4x4 board, (0,0)'s twin is (3,3) - and in `CONSTRAINT_BASE_SOLUTION`
  // both happen to be 0, a clean "consistent" pair. (0,2)'s twin is (3,1) -
  // 1 and 0 respectively, a clean "contradicting" pair from the same grid.
  const anchor = { row: 0, col: 0 };
  const anchorTwin = { row: 3, col: 3 };
  const differingAnchor = { row: 0, col: 2 };
  const differingAnchorTwin = { row: 3, col: 1 };

  describe('twinPartner', () => {
    test('is the 180-degree mirror opposite on a size x size board', () => {
      expect(twinPartner(4, anchor)).toEqual(anchorTwin);
      expect(twinPartner(4, { row: 1, col: 2 })).toEqual({ row: 2, col: 1 });
    });

    test('is its own inverse - applying it twice returns the original cell', () => {
      const cell = { row: 1, col: 3 };
      expect(twinPartner(6, twinPartner(6, cell))).toEqual(cell);
    });
  });

  describe('isTwinViolated / violatedTwins', () => {
    const values: BinairoValue[][] = [
      [0, 0, 1, 1],
      [1, 1, 0, 0],
      [0, 1, null, 1],
      [1, 0, 0, 0],
    ];
    const state: BinairoState = { values };
    const puzzle: BinairoPuzzle = { id: 'x', size: 4, givens: values };

    test('never violated while either side is still blank', () => {
      // (2,2) is itself blank - not yet decided, so its twin pair with
      // (1,1) isn't yet broken either way.
      expect(isTwinViolated(puzzle, state, { row: 2, col: 2 })).toBe(false);
    });

    test('violated when both sides are decided and differ', () => {
      // (0,0)=0, twin (3,3)=0 - equal, not violated.
      expect(isTwinViolated(puzzle, state, { row: 0, col: 0 })).toBe(false);
      // (0,1)=0, twin (3,2)=0 - equal, not violated either.
      expect(isTwinViolated(puzzle, state, { row: 0, col: 1 })).toBe(false);
      // (0,2)=1, twin (3,1)=0 - decided and unequal.
      expect(isTwinViolated(puzzle, state, differingAnchor)).toBe(true);
    });

    test('violatedTwins reports exactly the broken pairs, keyed', () => {
      const withTwins: BinairoPuzzle = { ...puzzle, twinCells: [anchor, differingAnchor] };
      const violated = violatedTwins(withTwins, state);
      expect(violated.has(twinKey(anchor))).toBe(false);
      expect(violated.has(twinKey(differingAnchor))).toBe(true);
      expect(violated.size).toBe(1);
    });
  });

  describe('isBinairoSolved with twins', () => {
    const solution: BinairoState = { values: CONSTRAINT_BASE_SOLUTION };

    test('a puzzle with no twin cells is unaffected', () => {
      expect(isBinairoSolved(twinBasePuzzle('no-twins', [anchor]), solution)).toBe(true);
    });

    test('solved requires every twin pair to match, not just be unbroken', () => {
      expect(isBinairoSolved(twinBasePuzzle('sat', [anchor], [anchor]), solution)).toBe(true);
      expect(isBinairoSolved(twinBasePuzzle('con', [differingAnchor], [differingAnchor]), solution)).toBe(false);
    });

    test('a twin pair between two still-blank cells blocks "solved" even if every base rule passes', () => {
      const state: BinairoState = { values: [[null, 0, 1, 1], [1, 1, 0, 0], [0, 1, 0, 1], [1, 0, 1, null]] };
      const puzzle: BinairoPuzzle = { id: 'blank-pair', size: 4, givens: state.values, twinCells: [anchor] };
      expect(isBinairoSolved(puzzle, state)).toBe(false);
    });
  });

  describe('solver enforcement', () => {
    test('the base puzzle alone already has exactly one solution', () => {
      expect(solveBinairo(twinBasePuzzle('base', [anchor, anchorTwin]), 3)).toHaveLength(1);
    });

    test('a twin pair consistent with the lone solution leaves it unique', () => {
      const solutions = solveBinairo(twinBasePuzzle('consistent', [anchor, anchorTwin], [anchor]), 3);
      expect(solutions).toHaveLength(1);
      expect(solutions[0].values).toEqual(CONSTRAINT_BASE_SOLUTION);
    });

    test('a twin pair contradicting the lone solution makes the puzzle unsolvable - proof the solver actually enforces it, not just checks it at the end', () => {
      const solutions = solveBinairo(twinBasePuzzle('contradicting', [differingAnchor, differingAnchorTwin], [differingAnchor]), 3);
      expect(solutions).toHaveLength(0);
    });

    test('assertValidBinairo rejects a puzzle whose twin cells contradict its own unique solution', () => {
      const puzzle = twinBasePuzzle('invalid', [differingAnchor, differingAnchorTwin], [differingAnchor]);
      expect(() => assertValidBinairo(puzzle)).toThrow(/no solution/);
    });

    test('assertValidBinairo accepts a puzzle whose twin cells agree with its unique solution', () => {
      const puzzle = twinBasePuzzle('valid', [anchor, anchorTwin], [anchor]);
      expect(() => assertValidBinairo(puzzle)).not.toThrow();
    });

    test('twin cells and =/x constraints can coexist in the same puzzle without interfering', () => {
      const givens = CONSTRAINT_BASE_SOLUTION.map(row => row.slice() as (0 | 1 | null)[]);
      givens[0][0] = null; // twinned with (3,3)
      givens[0][2] = null; // constrained (down) against (1,2)
      const downConstraint: BinairoConstraint = { row: 0, col: 2, direction: 'down', kind: 'different' };
      const puzzle: BinairoPuzzle = { id: 'combined', size: 4, givens, twinCells: [anchor], constraints: [downConstraint] };
      const solutions = solveBinairo(puzzle, 3);
      expect(solutions).toHaveLength(1);
      expect(solutions[0].values).toEqual(CONSTRAINT_BASE_SOLUTION);
    });
  });
});

describe('assertValidBinairo', () => {
  test('accepts a well-formed, uniquely-solvable puzzle', () => {
    expect(() => assertValidBinairo(SIMPLE)).not.toThrow();
  });

  test('rejects an unsolvable puzzle', () => {
    expect(() => assertValidBinairo(IMPOSSIBLE)).toThrow(/no solution/);
  });

  test('rejects a non-unique puzzle', () => {
    expect(() => assertValidBinairo(UNCLUED)).toThrow(/not unique/);
  });

  test('rejects an odd size', () => {
    const bad: BinairoPuzzle = { ...SIMPLE, size: 5 };
    expect(() => assertValidBinairo(bad)).toThrow(/even/);
  });

  test('rejects a givens grid with the wrong number of rows', () => {
    const bad: BinairoPuzzle = { ...SIMPLE, givens: SIMPLE.givens.slice(0, 3) };
    expect(() => assertValidBinairo(bad)).toThrow(/rows/);
  });
});

describe('revealHint', () => {
  test('fills the first blank cell (row-major) with the solution value', () => {
    const result = revealHint(emptyBinairoState(SIMPLE), SIMPLE);
    expect(result).not.toBeNull();
    expect(result!.cell).toEqual({ row: 0, col: 0 });
    expect(result!.state.values[0][0]).toBe(0);
  });

  test('never touches a wrongly-filled cell - only ever fills blanks', () => {
    const wrong = setValue(emptyBinairoState(SIMPLE), SIMPLE, 0, 0, 1); // solution wants 0
    const result = revealHint(wrong, SIMPLE);
    expect(result!.state.values[0][0]).toBe(1); // left alone
    expect(result!.cell).toEqual({ row: 0, col: 1 }); // next blank instead
  });

  test('returns null once the board is already fully solved', () => {
    expect(revealHint(SIMPLE_SOLUTION, SIMPLE)).toBeNull();
  });
});

describe('the shipped Binairo pool', () => {
  test('every id is unique and resolvable by getBinairoById', () => {
    const ids = BINAIRO.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getBinairoById(id)?.id).toBe(id);
  });

  test('getBinairoById returns undefined for an unknown id', () => {
    expect(getBinairoById('nope')).toBeUndefined();
  });

  test('sizes ramp from 6x6 up to 10x10, all even', () => {
    const sizes = BINAIRO.map(p => p.size);
    expect(Math.min(...sizes)).toBe(6);
    expect(Math.max(...sizes)).toBe(10);
    expect(sizes.every(s => s % 2 === 0)).toBe(true);
    // Monotonic within the constraint-tile puzzles - the ramp broken
    // exactly once, deliberately, by the first twin-cell puzzle
    // (`binairo-013`): a brand new mechanic is introduced on a small,
    // easy-to-see board before it ever meets a harder one, the same
    // reason a new mechanic in any of this app's other games always
    // debuts on an easy level rather than dropping into a late one.
    const rampSizes = BINAIRO.filter(p => !p.twinCells || p.twinCells.length === 0).map(p => p.size);
    expect(rampSizes).toEqual([...rampSizes].sort((a, b) => a - b));
  });

  describe.each(BINAIRO.map((p, i) => [p.id, p, BINAIRO_SOLUTION_GRIDS[i]] as const))('%s', (_id, puzzle, solutionGrid) => {
    test('is well-formed and uniquely solvable', () => {
      expect(() => assertValidBinairo(puzzle)).not.toThrow();
    });

    test('is not already solved at rest (the givens alone)', () => {
      expect(isBinairoSolved(puzzle, emptyBinairoState(puzzle))).toBe(false);
    });

    test('every given cell matches its own solution grid, and solving reproduces it exactly', () => {
      for (let r = 0; r < puzzle.size; r += 1) {
        for (let c = 0; c < puzzle.size; c += 1) {
          const given = puzzle.givens[r][c];
          if (given !== null) expect(given).toBe(solutionGrid[r][c]);
        }
      }
      const [solved] = solveBinairo(puzzle, 1);
      expect(solved?.values).toEqual(solutionGrid);
    });

    test('every declared constraint, if any, is satisfied by the solution grid', () => {
      const state: BinairoState = { values: solutionGrid };
      for (const constraint of puzzle.constraints ?? []) {
        expect(isConstraintViolated(state, constraint)).toBe(false);
      }
    });
  });

  test('every puzzle carries at least one extra mechanic - a constraint tile or a twin pair - not just a harder tier at the end', () => {
    for (const puzzle of BINAIRO) {
      const extraMechanics = (puzzle.constraints?.length ?? 0) + (puzzle.twinCells?.length ?? 0);
      expect(extraMechanics).toBeGreaterThan(0);
    }
  });

  test('twin cells, where present, are load-bearing - removing them would leave the puzzle ambiguous', () => {
    for (const puzzle of BINAIRO) {
      if (!puzzle.twinCells || puzzle.twinCells.length === 0) continue;
      const withoutTwins: BinairoPuzzle = { ...puzzle, twinCells: undefined };
      expect(solveBinairo(withoutTwins, 2).length).not.toBe(1);
    }
  });

  test('constraint count scales with size, larger boards never carrying fewer', () => {
    const bySize = new Map<number, number[]>();
    for (const puzzle of BINAIRO) {
      const counts = bySize.get(puzzle.size) ?? [];
      counts.push(puzzle.constraints?.length ?? 0);
      bySize.set(puzzle.size, counts);
    }
    const sizes = Array.from(bySize.keys()).sort((a, b) => a - b);
    let previousMax = 0;
    for (const size of sizes) {
      const counts = bySize.get(size)!;
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(previousMax);
      previousMax = Math.max(...counts);
    }
  });
});

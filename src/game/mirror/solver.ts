import { MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState, MirrorKind } from './types';
import { STEP, inBounds, isEligible, isObstacle, positionKey, reflect, setMirror, stateKey } from './logic';

/** `undefined` = not yet decided by the search (distinct from `null`, "no
 * mirror" - a real, final answer). */
type Decided = MirrorKind | null | undefined;
type WorkingGrid = Decided[][];

const CHOICES: ReadonlyArray<MirrorKind | null> = ['fwd', 'back', null];

type TraceResult =
  | { readonly status: 'solved' }
  | { readonly status: 'failed' }
  | { readonly status: 'pending'; readonly cell: MirrorMazeCell };

/**
 * The same stepping logic as `traceBeam` in logic.ts, generalized to a
 * partially-decided grid: stops and reports `pending` the moment it reaches
 * a cell whose mirror hasn't been decided yet, instead of assuming "no
 * mirror" the way a finished `MirrorMazeState` would. This is what lets the
 * search below branch only at cells the beam actually reaches, rather than
 * deciding every eligible cell on the board up front (a 5x5 grid can have
 * ~15-20 eligible cells - 3^20 is intractable, but the beam typically only
 * ever crosses a handful of them).
 */
function traceWithDecisions(puzzle: MirrorMazePuzzle, grid: WorkingGrid): TraceResult {
  let row = puzzle.source.row;
  let col = puzzle.source.col;
  let direction = puzzle.sourceDirection;

  const seenStates = new Set<string>([stateKey(row, col, direction)]);
  const visited = new Set<string>([positionKey(row, col)]);

  while (true) {
    if (row === puzzle.target.row && col === puzzle.target.col) {
      const allGems = puzzle.gems.every(g => visited.has(positionKey(g.row, g.col)));
      return { status: allGems ? 'solved' : 'failed' };
    }

    const decided = grid[row][col];
    if (decided === undefined) return { status: 'pending', cell: { row, col } };
    if (decided) direction = reflect(direction, decided);

    const { dRow, dCol } = STEP[direction];
    const nextRow = row + dRow;
    const nextCol = col + dCol;

    if (!inBounds(puzzle, nextRow, nextCol)) return { status: 'failed' };
    if (isObstacle(puzzle, nextRow, nextCol)) return { status: 'failed' };

    const nextStateKey = stateKey(nextRow, nextCol, direction);
    if (seenStates.has(nextStateKey)) return { status: 'failed' }; // would loop forever

    row = nextRow;
    col = nextCol;
    seenStates.add(nextStateKey);
    visited.add(positionKey(row, col));
  }
}

function buildInitialGrid(puzzle: MirrorMazePuzzle): WorkingGrid {
  return Array.from({ length: puzzle.rows }, (_row, r) =>
    Array.from({ length: puzzle.cols }, (_col, c): Decided => (isEligible(puzzle, r, c) ? undefined : null)),
  );
}

/**
 * Searches for up to `limit` valid mirror layouts (pass 2 to check for
 * ambiguity, mirroring `solveSudoku`'s `limit` parameter). "Trace-and-branch"
 * DFS: re-traces from the source on every branch, and only makes a 3-way
 * decision (`/`, `\`, or empty) at the exact cell the beam is currently
 * pending on - never on cells the beam under the current partial assignment
 * doesn't reach. `preferred`, when given, biases branch order toward
 * matching the player's current mirrors first, so the first solution found
 * tends to differ from their board in the fewest cells - a heuristic for a
 * minimally-disruptive hint, not a proven-minimum-edit-distance guarantee.
 */
export function solveMirrorMaze(
  puzzle: MirrorMazePuzzle,
  limit = 1,
  preferred?: MirrorMazeState,
): ReadonlyArray<MirrorMazeState> {
  const grid = buildInitialGrid(puzzle);
  const solutions: MirrorMazeState[] = [];

  const snapshot = (): MirrorMazeState => ({
    mirrors: grid.map(line => line.map(cell => (cell === undefined ? null : cell))),
  });

  function dfs(): void {
    if (solutions.length >= limit) return;

    const result = traceWithDecisions(puzzle, grid);
    if (result.status === 'solved') {
      solutions.push(snapshot());
      return;
    }
    if (result.status === 'failed') return;

    const { row, col } = result.cell;
    const preferredChoice = preferred?.mirrors[row]?.[col] ?? null;
    const order = [preferredChoice, ...CHOICES.filter(choice => choice !== preferredChoice)];

    for (const choice of order) {
      grid[row][col] = choice;
      dfs();
      grid[row][col] = undefined;
      if (solutions.length >= limit) return;
    }
  }

  dfs();
  return solutions;
}

/**
 * Validates a hand-authored puzzle: structurally well-formed (in bounds,
 * source on an edge and pointing inward, source/target/gems/obstacles all
 * pairwise distinct cells), and solvable. Deliberately checks solvability
 * only, not uniqueness - the same bar `assertValidTrajectory` already sets
 * in this codebase, for the same underlying reason: many mirror layouts are
 * functionally equivalent for cells the beam's actual solution never
 * touches, making a full uniqueness proof expensive for little real payoff.
 * A puzzle's "the empty board doesn't already solve it" property is checked
 * generically per-puzzle in the test suite, not here (see mirror.test.ts).
 */
export function assertValidMirrorMaze(puzzle: MirrorMazePuzzle): void {
  if (puzzle.rows <= 0 || puzzle.cols <= 0) {
    throw new Error(`Mirror maze ${puzzle.id}: rows/cols must be positive.`);
  }

  const { source, sourceDirection, target, gems, obstacles } = puzzle;

  const checkBounds = (label: string, cell: MirrorMazeCell): void => {
    if (!inBounds(puzzle, cell.row, cell.col)) {
      throw new Error(
        `Mirror maze ${puzzle.id}: ${label} at (${cell.row}, ${cell.col}) is outside the ${puzzle.rows}x${puzzle.cols} board.`,
      );
    }
  };
  checkBounds('source', source);
  checkBounds('target', target);
  gems.forEach(g => checkBounds('gem', g));
  obstacles.forEach(o => checkBounds('obstacle', o));

  const onEdge =
    source.row === 0 || source.row === puzzle.rows - 1 || source.col === 0 || source.col === puzzle.cols - 1;
  if (!onEdge) {
    throw new Error(`Mirror maze ${puzzle.id}: source at (${source.row}, ${source.col}) must be on an edge cell.`);
  }

  const pointsInward =
    (source.row === 0 && sourceDirection === 'down') ||
    (source.row === puzzle.rows - 1 && sourceDirection === 'up') ||
    (source.col === 0 && sourceDirection === 'right') ||
    (source.col === puzzle.cols - 1 && sourceDirection === 'left');
  if (!pointsInward) {
    throw new Error(
      `Mirror maze ${puzzle.id}: source direction "${sourceDirection}" does not point inward from (${source.row}, ${source.col}).`,
    );
  }

  const labeled: Array<{ label: string; cell: MirrorMazeCell }> = [
    { label: 'source', cell: source },
    { label: 'target', cell: target },
    ...gems.map(cell => ({ label: 'gem', cell })),
    ...obstacles.map(cell => ({ label: 'obstacle', cell })),
  ];
  const seen = new Map<string, string>();
  for (const { label, cell } of labeled) {
    const key = positionKey(cell.row, cell.col);
    const existingLabel = seen.get(key);
    if (existingLabel) {
      throw new Error(
        `Mirror maze ${puzzle.id}: ${label} at (${cell.row}, ${cell.col}) overlaps the ${existingLabel}.`,
      );
    }
    seen.set(key, label);
  }

  if (solveMirrorMaze(puzzle, 1).length === 0) {
    throw new Error(`Mirror maze ${puzzle.id}: no solution exists.`);
  }
}

/**
 * Always re-solves from the puzzle's own fixed data (never trusts the
 * player's current mirrors as ground truth beyond checking where they
 * deviate) - the same contract as `revealHint` everywhere else in this app.
 * Unlike Sudoku (which only ever fills blanks), a wrong-but-non-blank mirror
 * is a real, correctable state here, so this scans for the first cell where
 * the player's layout differs from a solution at all, matching
 * Constellation's "correct the first wrong cell" hint idiom rather than
 * Sudoku's "only fill blanks" one.
 */
export function revealHint(
  state: MirrorMazeState,
  puzzle: MirrorMazePuzzle,
): { state: MirrorMazeState; cell: MirrorMazeCell } | null {
  const [solution] = solveMirrorMaze(puzzle, 1, state);
  if (!solution) return null;

  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (!isEligible(puzzle, row, col)) continue;
      if (state.mirrors[row][col] !== solution.mirrors[row][col]) {
        const corrected = setMirror(state, puzzle, row, col, solution.mirrors[row][col]);
        return { state: corrected, cell: { row, col } };
      }
    }
  }
  return null;
}

import { clueValue, clueWindow } from './logic';
import { FillaPixCell, FillaPixPuzzle } from './types';

/**
 * Authoring-time-only solver: given a puzzle (its full picture plus
 * *which* cells reveal a clue), find every grid consistent with just the
 * revealed clues. Never imported by the screen at runtime - a hint just
 * reads `puzzle.solution` directly (see `play.ts`), since that solution
 * is already known and already verified unique before the puzzle ships.
 *
 * This is the same "solve, then assert the solution count is exactly 1"
 * shape every other solver-backed game in this app already uses
 * (`src/game/binairo/solver.ts`, `mirror/solver.ts`, `tents/solver.ts`,
 * `towers/solver.ts`) - Fill-a-Pix's own version of it.
 */

type CellMark = 'filled' | 'empty' | 'unknown';

interface Constraint {
  readonly window: ReadonlyArray<FillaPixCell>;
  readonly target: number;
}

function buildConstraints(puzzle: FillaPixPuzzle): ReadonlyArray<Constraint> {
  return puzzle.clues.map(cell => ({
    window: clueWindow(puzzle.size, cell.row, cell.col),
    target: clueValue(puzzle, cell.row, cell.col),
  }));
}

/** How many constraints' windows include each cell - used to branch on
 * the most-constrained remaining cell first, the same "prefer the
 * option with the fewest ways forward" spirit as the Warnsdorff ordering
 * `src/game/arukone/generator.ts` uses for path growth. Cells touched by
 * *zero* constraints (possible when a difficulty tier reveals very few
 * clues) still get branched on eventually - which is exactly what lets
 * this solver correctly report "not unique" when a picture's revealed
 * clues leave some cell genuinely free either way. */
function touchCounts(size: number, constraints: ReadonlyArray<Constraint>): number[][] {
  const counts = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  for (const c of constraints) for (const cell of c.window) counts[cell.row][cell.col] += 1;
  return counts;
}

/** What a constraint still needs, given what is already known. */
interface Pending {
  readonly constraint: Constraint;
  /** Cells in its window still undecided. */
  readonly unknowns: ReadonlyArray<FillaPixCell>;
  /** Filled cells still to be placed among those unknowns. */
  readonly remaining: number;
}

function pendingFor(grid: CellMark[][], constraint: Constraint): Pending | null {
  let knownFilled = 0;
  const unknowns: FillaPixCell[] = [];
  for (const cell of constraint.window) {
    const mark = grid[cell.row][cell.col];
    if (mark === 'filled') knownFilled += 1;
    else if (mark === 'unknown') unknowns.push(cell);
  }
  const remaining = constraint.target - knownFilled;
  if (remaining < 0 || remaining > unknowns.length) return null;
  return { constraint, unknowns, remaining };
}

/**
 * Propagates every constraint to a fixpoint, mutating `grid` in place.
 * Returns false the moment any constraint becomes impossible to satisfy
 * (this branch of the search is dead).
 *
 * Two rules, and the second one is the game.
 *
 * The first is the obvious one: a clue whose count is already met empties
 * the rest of its block, and a clue needing exactly as many as it has
 * squares left fills them all. On its own it is far weaker than a human
 * solver - measured, it could not finish **seven of the fourteen shipped
 * pictures even with every single clue revealed**, which had the effect
 * of condemning perfectly fair puzzles as unsolvable.
 *
 * The second is the technique Fill-a-Pix actually runs on: comparing two
 * overlapping clues. Where two blocks share squares, each clue bounds how
 * many filled cells that shared region can hold, and the tighter of the
 * two bounds often forces the squares *outside* the overlap - the "these
 * two clues differ by exactly the column between them" deduction that
 * every human solver makes constantly. Without it there is no meaningful
 * sense in which this game can be reasoned about at all.
 */
function propagate(grid: CellMark[][], constraints: ReadonlyArray<Constraint>): boolean {
  let changed = true;
  while (changed) {
    changed = false;

    for (const constraint of constraints) {
      const pending = pendingFor(grid, constraint);
      if (!pending) return false;
      const { unknowns, remaining } = pending;
      if (unknowns.length === 0) continue;
      if (remaining === 0) {
        for (const u of unknowns) grid[u.row][u.col] = 'empty';
        changed = true;
      } else if (remaining === unknowns.length) {
        for (const u of unknowns) grid[u.row][u.col] = 'filled';
        changed = true;
      }
    }
    if (changed) continue;

    // Pairwise overlap. Only run once the cheap rule has gone quiet,
    // since it is quadratic in the clue count and the cheap rule does
    // most of the work whenever it can.
    for (let i = 0; i < constraints.length; i += 1) {
      const a = pendingFor(grid, constraints[i]);
      if (!a) return false;
      if (a.unknowns.length === 0) continue;

      for (let j = i + 1; j < constraints.length; j += 1) {
        const b = pendingFor(grid, constraints[j]);
        if (!b) return false;
        if (b.unknowns.length === 0) continue;

        const inB = new Set(b.unknowns.map(c => `${c.row}:${c.col}`));
        const shared = a.unknowns.filter(c => inB.has(`${c.row}:${c.col}`));
        if (shared.length === 0) continue;
        const onlyA = a.unknowns.filter(c => !inB.has(`${c.row}:${c.col}`));
        const inShared = new Set(shared.map(c => `${c.row}:${c.col}`));
        const onlyB = b.unknowns.filter(c => !inShared.has(`${c.row}:${c.col}`));

        // How many of the shared squares can be filled, as bounded by
        // each clue independently - then take the tighter of the two.
        const minShared = Math.max(0, a.remaining - onlyA.length, b.remaining - onlyB.length);
        const maxShared = Math.min(shared.length, a.remaining, b.remaining);
        if (minShared > maxShared) return false;

        // With the shared region bounded, each clue's own outside is too.
        const resolve = (side: Pending, outside: ReadonlyArray<FillaPixCell>): boolean => {
          if (outside.length === 0) return false;
          const minOutside = side.remaining - maxShared;
          const maxOutside = side.remaining - minShared;
          if (minOutside === outside.length) {
            for (const cell of outside) grid[cell.row][cell.col] = 'filled';
            return true;
          }
          if (maxOutside === 0) {
            for (const cell of outside) grid[cell.row][cell.col] = 'empty';
            return true;
          }
          return false;
        };

        if (resolve(a, onlyA)) changed = true;
        if (resolve(b, onlyB)) changed = true;
      }
    }
  }
  return true;
}

function pickBranchCell(size: number, grid: CellMark[][], counts: number[][]): FillaPixCell | null {
  let best: FillaPixCell | null = null;
  let bestCount = -1;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (grid[row][col] !== 'unknown') continue;
      if (counts[row][col] > bestCount) {
        bestCount = counts[row][col];
        best = { row, col };
      }
    }
  }
  return best;
}

/** Finds up to `limit` grids consistent with `puzzle`'s revealed clues,
 * stopping the search early once `limit` is reached - so callers that
 * only care "is this unique" (the common case) pass `limit: 2` and never
 * pay for a full enumeration. */
export function solveFillaPix(puzzle: FillaPixPuzzle, limit: number): ReadonlyArray<ReadonlyArray<ReadonlyArray<boolean>>> {
  const constraints = buildConstraints(puzzle);
  const counts = touchCounts(puzzle.size, constraints);
  const solutions: Array<ReadonlyArray<ReadonlyArray<boolean>>> = [];

  function search(grid: CellMark[][]): void {
    if (solutions.length >= limit) return;
    if (!propagate(grid, constraints)) return;

    const branch = pickBranchCell(puzzle.size, grid, counts);
    if (!branch) {
      solutions.push(grid.map(row => row.map(mark => mark === 'filled')));
      return;
    }

    for (const guess of ['filled', 'empty'] as const) {
      if (solutions.length >= limit) return;
      const next = grid.map(row => row.slice());
      next[branch.row][branch.col] = guess;
      search(next);
    }
  }

  const initial: CellMark[][] = Array.from({ length: puzzle.size }, () => Array.from({ length: puzzle.size }, () => 'unknown' as CellMark));
  search(initial);
  return solutions;
}

/**
 * Whether the puzzle falls out of **pure constraint propagation** - no
 * branching, no guessing, no backtracking.
 *
 * This is the difference between a puzzle and a coin flip, and for a
 * long time nothing checked it. `generateFillaPix` only ever asked
 * whether the revealed clues pinned down a *unique* grid, which they can
 * do while still leaving no chain of reasoning that reaches it: the
 * search below is free to guess a cell and backtrack, and a player is
 * not. Measured against the pool that shipped under that rule, **8 of 14
 * puzzles could not be solved by logic at all**, and two of them - one
 * in the *easy* tier - determined nothing whatsoever by propagation, so
 * the only way in was to pick a square at random and see what happened.
 *
 * `propagate` here is the same routine the search uses, run once from an
 * empty grid, which is exactly the reasoning a human can actually
 * perform: "this clue's count is already met, so the rest of its block
 * is empty", and its mirror.
 */
export function isSolvableByLogic(puzzle: FillaPixPuzzle): boolean {
  const constraints = buildConstraints(puzzle);
  const grid: CellMark[][] = Array.from({ length: puzzle.size }, () =>
    Array.from({ length: puzzle.size }, () => 'unknown' as CellMark),
  );
  if (!propagate(grid, constraints)) return false;
  return grid.every(row => row.every(mark => mark !== 'unknown'));
}

/** Throws unless `puzzle`'s revealed clues pin down exactly one grid.
 * Called by the pool-wide "every shipped puzzle" test, the same
 * `assertValidX` shape every other solver-backed game already ships. */
export function assertValidFillaPix(puzzle: FillaPixPuzzle): void {
  const solutions = solveFillaPix(puzzle, 2);
  if (solutions.length === 0) throw new Error(`Fill-a-Pix ${puzzle.id}: no solution exists for its revealed clues.`);
  if (solutions.length > 1) throw new Error(`Fill-a-Pix ${puzzle.id}: revealed clues do not have a unique solution.`);
  if (!isSolvableByLogic(puzzle)) {
    throw new Error(
      `Fill-a-Pix ${puzzle.id}: unique, but not reachable by propagation - a player would have to guess.`,
    );
  }
}

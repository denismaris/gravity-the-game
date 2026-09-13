import { TrajectoryCell, TrajectoryPuzzle, TrajectoryState } from './types';
import { pairConnected } from './logic';

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

type Solution = Record<number, TrajectoryCell[]>;

/**
 * Depth-first flow solver: grow each colour's path from one endpoint to the
 * other, filling the whole board, pruning any state that strands an empty
 * cell. Returns solutions up to `limit`. Small authored boards (<= 8x8)
 * solve well within `nodeCap`.
 */
export function solveTrajectory(puzzle: TrajectoryPuzzle, limit = 1, nodeCap = 400000): Solution[] {
  const { rows, cols, pairs } = puzzle;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(-1));
  const target = new Map<number, TrajectoryCell>();
  const paths = new Map<number, TrajectoryCell[]>();
  const colors = pairs.map(p => p.color).slice().sort((a, b) => a - b);

  // Blocked cells are seeded as permanently non-empty (-2, distinct from any
  // real colour and from -1/"empty") - every check below already treats
  // "not -1" as impassable, so this alone keeps paths off them and keeps
  // them out of `emptyRemaining`/`strands` without touching either.
  for (const cell of puzzle.blocked ?? []) {
    grid[cell.row][cell.col] = -2;
  }

  for (const pair of pairs) {
    grid[pair.a.row][pair.a.col] = pair.color;
    grid[pair.b.row][pair.b.col] = pair.color;
    target.set(pair.color, { ...pair.b });
    paths.set(pair.color, [{ ...pair.a }]);
  }

  const done = new Set<number>();
  const solutions: Solution[] = [];
  let nodes = 0;

  const inb = (r: number, c: number): boolean => r >= 0 && r < rows && c >= 0 && c < cols;

  const emptyRemaining = (): number => {
    let n = 0;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) if (grid[r][c] === -1) n += 1;
    return n;
  };

  const isActiveHead = (r: number, c: number): boolean => {
    for (const color of colors) {
      if (done.has(color)) continue;
      const p = paths.get(color)!;
      const h = p[p.length - 1];
      if (h.row === r && h.col === c) return true;
    }
    return false;
  };

  const isEndpointOfUndoneColor = (r: number, c: number): boolean => {
    for (const pair of pairs) {
      if (done.has(pair.color)) continue;
      if ((pair.a.row === r && pair.a.col === c) || (pair.b.row === r && pair.b.col === c)) {
        return true;
      }
    }
    return false;
  };

  // A non-endpoint flow cell always ends up with exactly two path neighbours,
  // so an empty cell with fewer than two neighbours a path could still reach
  // it through can never be covered - prune. "Reachable" is kept permissive
  // (empty, an active head, or an endpoint of an unfinished colour) so the
  // prune never rejects a real solution.
  const strands = (): boolean => {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (grid[r][c] !== -1) continue;
        let free = 0;
        for (const [dr, dc] of NEIGHBOURS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inb(nr, nc)) continue;
          if (
            grid[nr][nc] === -1 ||
            isActiveHead(nr, nc) ||
            isEndpointOfUndoneColor(nr, nc)
          ) {
            free += 1;
          }
        }
        if (free < 2) return true;
      }
    }
    return false;
  };

  const record = (): void => {
    const rec: Solution = {};
    for (const [color, path] of paths) rec[color] = path.map(cell => ({ ...cell }));
    solutions.push(rec);
  };

  const dfs = (): void => {
    if (solutions.length >= limit || nodes > nodeCap) return;
    nodes += 1;

    const color = colors.find(k => !done.has(k));
    if (color === undefined) {
      if (emptyRemaining() === 0) record();
      return;
    }

    const path = paths.get(color)!;
    const head = path[path.length - 1];
    const tgt = target.get(color)!;

    for (const [dr, dc] of NEIGHBOURS) {
      const nr = head.row + dr;
      const nc = head.col + dc;
      if (!inb(nr, nc)) continue;

      if (nr === tgt.row && nc === tgt.col) {
        path.push({ row: nr, col: nc });
        done.add(color);
        if (!strands()) dfs();
        done.delete(color);
        path.pop();
        if (solutions.length >= limit) return;
        continue;
      }

      if (grid[nr][nc] !== -1) continue;
      grid[nr][nc] = color;
      path.push({ row: nr, col: nc });
      if (!strands()) dfs();
      path.pop();
      grid[nr][nc] = -1;
      if (solutions.length >= limit) return;
    }
  };

  dfs();
  return solutions;
}

/**
 * Throws unless `puzzle` is well-formed AND has at least one solution.
 * (Flow uniqueness is expensive to guarantee; authored puzzles are checked
 * for solvability and hand-designed to feel unambiguous.)
 */
export function assertValidTrajectory(puzzle: TrajectoryPuzzle): void {
  const { id, rows, cols, pairs } = puzzle;
  if (rows <= 0 || cols <= 0) throw new Error(`Trajectory ${id}: rows/cols must be positive.`);
  if (pairs.length === 0) throw new Error(`Trajectory ${id}: needs at least one pair.`);

  const seen = new Set<string>();
  const colorSet = new Set<number>();
  for (const pair of pairs) {
    if (colorSet.has(pair.color)) throw new Error(`Trajectory ${id}: colour ${pair.color} used twice.`);
    colorSet.add(pair.color);
    for (const cell of [pair.a, pair.b]) {
      if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
        throw new Error(`Trajectory ${id}: endpoint (${cell.row}, ${cell.col}) is off the board.`);
      }
      const k = `${cell.row}:${cell.col}`;
      if (seen.has(k)) throw new Error(`Trajectory ${id}: two endpoints share cell (${k}).`);
      seen.add(k);
    }
    if (pair.a.row === pair.b.row && pair.a.col === pair.b.col) {
      throw new Error(`Trajectory ${id}: colour ${pair.color} has both endpoints on one cell.`);
    }
  }

  const blockedKeys = new Set<string>();
  for (const cell of puzzle.blocked ?? []) {
    if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
      throw new Error(`Trajectory ${id}: blocked cell (${cell.row}, ${cell.col}) is off the board.`);
    }
    const k = `${cell.row}:${cell.col}`;
    if (blockedKeys.has(k)) throw new Error(`Trajectory ${id}: cell (${k}) is blocked twice.`);
    blockedKeys.add(k);
    if (seen.has(k)) throw new Error(`Trajectory ${id}: a blocked cell overlaps an endpoint at (${k}).`);
  }

  if (solveTrajectory(puzzle, 1).length === 0) {
    throw new Error(`Trajectory ${id}: no solution covers the whole board.`);
  }
}

/**
 * Solver-backed hint: draws the whole path for the first pair the player
 * hasn't connected yet, from a real solution. Returns `null` when every
 * pair is already connected.
 */
export function revealHint(
  state: TrajectoryState,
  puzzle: TrajectoryPuzzle,
): { state: TrajectoryState; color: number } | null {
  const [solution] = solveTrajectory(puzzle, 1);
  if (!solution) return null;

  for (const pair of puzzle.pairs) {
    if (pairConnected(state, pair)) continue;
    return {
      state: { ...state, paths: { ...state.paths, [pair.color]: solution[pair.color] } },
      color: pair.color,
    };
  }
  return null;
}

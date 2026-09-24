/**
 * Shared maze-shape generation - a random connected blob of grid cells,
 * threaded into a spanning tree of corridors. Used by the calming
 * interstitial (`src/interstitial/CalmingInterstitialScreen.tsx`) to build
 * each fresh maze its own slide-until-wall ball rolls through.
 */

export interface Cell {
  readonly col: number;
  readonly row: number;
}

export interface MazeShape {
  readonly cols: number;
  readonly rows: number;
  readonly active: ReadonlySet<string>;
  readonly openEdges: ReadonlySet<string>;
  readonly start: Cell;
}

export const DIRS: ReadonlyArray<{ dc: number; dr: number }> = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

export function cellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

export function edgeKey(a: Cell, b: Cell): string {
  return a.row === b.row ? `h:${Math.min(a.col, b.col)}:${a.row}` : `v:${a.col}:${Math.min(a.row, b.row)}`;
}

/**
 * Grows a random connected blob of `targetCount` cells from the grid's own
 * centre outward - connected by construction (every new cell attaches to
 * one already in the shape). Each step weights every candidate cell by how
 * many active neighbours it already has - squared when `style` is
 * `'blob'`, heavily favouring filling in notches into a solid, roomy
 * shape; inverted when `style` is `'corridor'`, favouring a cell with
 * *few* active neighbours instead, so growth keeps extending a thin
 * frontier rather than thickening it - a winding, uniformly one-cell-wide
 * path, matching a rolling-ball maze's own corridors rather than a filled
 * region with walls threaded through it.
 *
 * `rng` defaults to `Math.random` but accepts an injected generator, so a
 * caller that ever needs a *reproducible* shape (a fixed test fixture, for
 * instance) can pass a seeded one instead.
 */
export function carveShape(
  cols: number,
  rows: number,
  targetCount: number,
  rng: () => number = Math.random,
  style: 'blob' | 'corridor' = 'blob',
): { active: Set<string>; start: Cell } {
  const start: Cell = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };
  const active = new Set<string>([cellKey(start.col, start.row)]);

  const activeNeighborCount = (cell: Cell): number =>
    DIRS.filter(d => active.has(cellKey(cell.col + d.dc, cell.row + d.dr))).length;

  while (active.size < targetCount) {
    const candidates = new Map<string, Cell>();
    for (const k of active) {
      const [col, row] = k.split(':').map(Number);
      for (const d of DIRS) {
        const n = { col: col + d.dc, row: row + d.dr };
        if (n.col < 0 || n.col >= cols || n.row < 0 || n.row >= rows) continue;
        const nk = cellKey(n.col, n.row);
        if (!active.has(nk)) candidates.set(nk, n);
      }
    }
    if (candidates.size === 0) break;

    const weighted = Array.from(candidates.values()).map(cell => {
      const n = activeNeighborCount(cell);
      // 'corridor' picks up almost every candidate is a single-attachment
      // frontier cell (n=1, since a brand new candidate is adjacent to
      // exactly the one active cell that found it) - the steep falloff
      // means a cell that would touch a *second* active cell (n>=2, which
      // thickens a corridor into a room) is only ever chosen once no
      // thinner option is left, keeping growth thread-like instead of
      // room-like.
      return { cell, weight: style === 'blob' ? n ** 2 + 1 : 8 ** (1 - n) };
    });
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = rng() * total;
    let chosen = weighted[weighted.length - 1].cell;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) {
        chosen = w.cell;
        break;
      }
    }
    active.add(cellKey(chosen.col, chosen.row));
  }

  return { active, start };
}

/**
 * A randomized recursive-backtracker perfect maze (a spanning tree: every
 * active cell reachable from `start`, no loops) restricted to `active`'s
 * own irregular shape. A tree alone isn't sufficient for the interstitial's
 * own slide-until-wall movement to fully cover it - see its own
 * `isBranchPoint`/`slidePath` for the extra rule that's needed on top of
 * this.
 */
export function buildSpanningTree(
  cols: number,
  rows: number,
  active: ReadonlySet<string>,
  start: Cell,
  rng: () => number = Math.random,
): Set<string> {
  const openEdges = new Set<string>();
  const visited = new Set<string>([cellKey(start.col, start.row)]);
  const stack: Cell[] = [start];

  while (stack.length > 0) {
    const cell = stack[stack.length - 1];
    const candidates = DIRS.map(d => ({ col: cell.col + d.dc, row: cell.row + d.dr })).filter(
      n =>
        n.col >= 0 &&
        n.col < cols &&
        n.row >= 0 &&
        n.row < rows &&
        active.has(cellKey(n.col, n.row)) &&
        !visited.has(cellKey(n.col, n.row)),
    );
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const next = candidates[Math.floor(rng() * candidates.length)];
    openEdges.add(edgeKey(cell, next));
    visited.add(cellKey(next.col, next.row));
    stack.push(next);
  }

  return openEdges;
}

export function generateMazeShape(
  cols: number,
  rows: number,
  fillRatio: number,
  rng: () => number = Math.random,
  style: 'blob' | 'corridor' = 'blob',
): MazeShape {
  const targetCount = Math.round(cols * rows * fillRatio);
  const { active, start } = carveShape(cols, rows, targetCount, rng, style);
  const openEdges = buildSpanningTree(cols, rows, active, start, rng);
  return { cols, rows, active, openEdges, start };
}

/** True if there's an open passage from `cell` to its neighbour in
 * direction `(dc, dr)` - both must be active cells within bounds *and*
 * the edge between them must be open. The one shared primitive every
 * consumer's own movement/collision logic (discrete slide, continuous
 * roll) is built from. */
export function hasOpenEdge(maze: MazeShape, cell: Cell, dc: number, dr: number): boolean {
  const next = { col: cell.col + dc, row: cell.row + dr };
  if (next.col < 0 || next.col >= maze.cols || next.row < 0 || next.row >= maze.rows) return false;
  if (!maze.active.has(cellKey(next.col, next.row))) return false;
  return maze.openEdges.has(edgeKey(cell, next));
}

/** True if every active cell is reachable from `start` by walking open
 * edges alone (no movement-mechanic rules applied) - the baseline
 * connectivity guarantee every consumer of a `MazeShape` can rely on
 * regardless of how it moves through it. `buildSpanningTree` guarantees
 * this by construction; this function is the independent check that
 * verifies it rather than assumes it (used by this module's own tests). */
export function isFullyConnected(maze: MazeShape): boolean {
  const visited = new Set<string>([cellKey(maze.start.col, maze.start.row)]);
  const queue: Cell[] = [maze.start];
  while (queue.length > 0) {
    const cell = queue.shift() as Cell;
    for (const d of DIRS) {
      if (!hasOpenEdge(maze, cell, d.dc, d.dr)) continue;
      const next = { col: cell.col + d.dc, row: cell.row + d.dr };
      const nk = cellKey(next.col, next.row);
      if (visited.has(nk)) continue;
      visited.add(nk);
      queue.push(next);
    }
  }
  return visited.size === maze.active.size;
}

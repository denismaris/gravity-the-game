import { Cell, DIRS, MazeShape, cellKey, edgeKey } from './shape';

/**
 * Fresh mazes for the calming break - a new set every break, never the same
 * three in the same order.
 *
 * The break used to cycle five hand-picked layouts from the first one every
 * time, so every pause opened on the same maze. These are carved at runtime
 * instead, from the one rule that matters for a rolling ball: it stops only
 * at walls.
 *
 * So a maze is carved *out of rolls*. From a stop, pick a direction and a
 * length, carve that run of floor, and mark the square just past its end as
 * wall - permanently. Later rolls only ever add floor, and the only thing
 * that could make an earlier roll stop short is floor turning back into
 * wall, which never happens. So every roll used to carve the maze still
 * works in the finished maze, which means every square can be painted by
 * rolling wall to wall - by construction, not by luck. (The previous
 * approach enumerated symmetric layouts and filtered for this; 71 of 8185
 * survived. Carving gets it for free.)
 *
 * Half the mazes are carved mirror-symmetric, for the ordered look of the
 * original set; the other half free, for variety.
 */

export const RELAX_MAX_COLS = 7;
export const RELAX_MAX_ROWS = 9;

/** One break's mazes, gentlest first. */
export interface RelaxTier {
  readonly minCells: number;
  readonly maxCells: number;
  /** Distinct squares the ball can come to rest on - a proxy for how many
   * swipes the maze takes. */
  readonly minStops: number;
}

export const RELAX_TIERS: ReadonlyArray<RelaxTier> = [
  { minCells: 20, maxCells: 30, minStops: 6 },
  { minCells: 27, maxCells: 38, minStops: 8 },
  { minCells: 33, maxCells: 46, minStops: 10 },
];

export interface RelaxMazeStats {
  readonly cells: number;
  readonly connected: boolean;
  /** Every square painted by rolling from the start, stopping only at walls. */
  readonly finishable: boolean;
  /** No trap: wherever the ball comes to rest - by any play, mid-roll
   * turns included - it can still roll its way back to the start, and so
   * on to every square. `finishable` alone is not enough: rolls are not
   * reversible, so a maze can be finishable from the start and still let
   * the ball into a pocket it can never leave, with squares unpainted
   * elsewhere. Players hit exactly that. */
  readonly trapFree: boolean;
  readonly stops: number;
  readonly deadEnds: number;
  /** Solid 2x2 blocks of floor - a few read as a room, many as a slab. */
  readonly solidBlocks: number;
  /** Independent loops - ways round, rather than only back. */
  readonly loops: number;
  /** The trimmed extent, and how much of it is floor. A maze that is one
   * thin arch or a lone squiggle across a big box reads as unfinished. */
  readonly width: number;
  readonly height: number;
  readonly density: number;
  /** The longest corridor that sticks out of the shape to a dead end,
   * counted from the junction it leaves. Long thin arms make silhouettes
   * that read as something other than a maze, so a break never shows one. */
  readonly longestSpur: number;
}

/* eslint-disable no-bitwise -- mulberry32 is bitwise by definition */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

const FLOOR = 1;
const WALL = 2;

/** One carve attempt: a grid of floor squares and the start, or null. */
function carve(random: () => number, mirror: boolean): { floor: boolean[][]; start: Cell } | null {
  const cols = RELAX_MAX_COLS;
  const rows = RELAX_MAX_ROWS;
  // 0 undecided, FLOOR, or WALL (a stop's backstop - never carved).
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  const inside = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows;
  const mark = (c: number, r: number, value: number): boolean => {
    const points = mirror ? [[c, r], [cols - 1 - c, r]] : [[c, r]];
    if (points.some(([x, y]) => grid[y][x] !== 0 && grid[y][x] !== value)) return false;
    for (const [x, y] of points) grid[y][x] = value;
    return true;
  };

  const start: Cell = { col: Math.floor(random() * cols), row: Math.floor(random() * rows) };
  mark(start.col, start.row, FLOOR);
  const stops: Cell[] = [start];
  let at = start;
  const rolls = 10 + Math.floor(random() * 10);
  for (let made = 0, tries = 0; made < rolls && tries < 200; tries += 1) {
    // Now and then branch from an earlier stop, so the maze grows loops
    // and side passages rather than one long snake.
    if (random() < 0.3) at = stops[Math.floor(random() * stops.length)];
    const { dc, dr } = DIRS[Math.floor(random() * DIRS.length)];
    let room = 0;
    while (inside(at.col + dc * (room + 1), at.row + dr * (room + 1)) && grid[at.row + dr * (room + 1)][at.col + dc * (room + 1)] !== WALL) room += 1;
    if (room === 0) continue;
    const length = 1 + Math.floor(random() * room);
    const end = { col: at.col + dc * length, row: at.row + dr * length };
    const past = { col: end.col + dc, row: end.row + dr };
    // Stopping here needs a wall just past the end - floor there already
    // would carry the ball on through.
    if (inside(past.col, past.row) && grid[past.row][past.col] === FLOOR) continue;
    const before = grid.map(line => line.slice());
    let ok = true;
    for (let step = 1; step <= length && ok; step += 1) ok = mark(at.col + dc * step, at.row + dr * step, FLOOR);
    if (ok && inside(past.col, past.row)) ok = mark(past.col, past.row, WALL);
    if (!ok) {
      for (let r = 0; r < rows; r += 1) grid[r] = before[r];
      continue;
    }
    at = end;
    stops.push(end);
    made += 1;
  }
  return { floor: grid.map(line => line.map(v => v === FLOOR)), start };
}

/** What a maze is like to play - see `RelaxMazeStats`. Reads the finished
 * maze afresh rather than trusting how it was carved. */
export function relaxMazeStats(floor: ReadonlyArray<ReadonlyArray<boolean>>, start: Cell): RelaxMazeStats {
  const rows = floor.length;
  const cols = floor[0]?.length ?? 0;
  const on = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows && floor[r][c];
  let cells = 0;
  let deadEnds = 0;
  let solidBlocks = 0;
  let first: Cell | null = null;
  let edges = 0;
  let minC = cols;
  let maxC = -1;
  let minR = rows;
  let maxR = -1;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!on(c, r)) continue;
      cells += 1;
      first ??= { col: c, row: r };
      if (on(c + 1, r)) edges += 1;
      if (on(c, r + 1)) edges += 1;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      if (DIRS.filter(d => on(c + d.dc, r + d.dr)).length <= 1) deadEnds += 1;
      if (on(c + 1, r) && on(c, r + 1) && on(c + 1, r + 1)) solidBlocks += 1;
    }
  }

  const reached = new Set<string>();
  const stack: Cell[] = first ? [first] : [];
  if (first) reached.add(cellKey(first.col, first.row));
  while (stack.length > 0) {
    const { col, row } = stack.pop()!;
    for (const { dc, dr } of DIRS) {
      const key = cellKey(col + dc, row + dr);
      if (on(col + dc, row + dr) && !reached.has(key)) {
        reached.add(key);
        stack.push({ col: col + dc, row: row + dr });
      }
    }
  }

  const stopKeys = new Set([cellKey(start.col, start.row)]);
  const painted = new Set(stopKeys);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const { dc, dr } of DIRS) {
      let { col, row } = from;
      while (on(col + dc, row + dr)) {
        col += dc;
        row += dr;
        painted.add(cellKey(col, row));
      }
      const key = cellKey(col, row);
      if (!stopKeys.has(key)) {
        stopKeys.add(key);
        queue.push({ col, row });
      }
    }
  }

  // Every square the ball can come to rest on: the start, and any square
  // with a wall ahead of a direction it can roll in from.
  const roll = (from: Cell, dc: number, dr: number): Cell => {
    let { col, row } = from;
    while (on(col + dc, row + dr)) {
      col += dc;
      row += dr;
    }
    return { col, row };
  };
  const rests: Cell[] = [start];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (on(c, r) && DIRS.some(({ dc, dr }) => !on(c + dc, r + dr) && on(c - dc, r - dr))) rests.push({ col: c, row: r });
    }
  }
  const startKey = cellKey(start.col, start.row);
  const canReturn = new Set<string>([startKey]);
  const returns = (from: Cell): boolean => {
    const seen = new Set([cellKey(from.col, from.row)]);
    const todo = [from];
    while (todo.length > 0) {
      const at = todo.pop()!;
      for (const { dc, dr } of DIRS) {
        const next = roll(at, dc, dr);
        const key = cellKey(next.col, next.row);
        if (canReturn.has(key)) return true;
        if (!seen.has(key)) {
          seen.add(key);
          todo.push(next);
        }
      }
    }
    return false;
  };
  let trapFree = true;
  for (const rest of rests) {
    const key = cellKey(rest.col, rest.row);
    if (canReturn.has(key)) continue;
    if (returns(rest)) canReturn.add(key);
    else trapFree = false;
  }

  // Spurs: from each dead end, walk back along single-file squares to the
  // first junction (or a corner where the corridor stops being single-file).
  const degree = (c: number, r: number) => DIRS.filter(d => on(c + d.dc, r + d.dr)).length;
  let longestSpur = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!on(c, r) || degree(c, r) !== 1) continue;
      let length = 1;
      let prev = { col: -1, row: -1 };
      let at = { col: c, row: r };
      for (;;) {
        const next = DIRS.map(d => ({ col: at.col + d.dc, row: at.row + d.dr })).find(n => on(n.col, n.row) && !(n.col === prev.col && n.row === prev.row));
        if (!next || degree(next.col, next.row) !== 2) break;
        prev = at;
        at = next;
        length += 1;
      }
      longestSpur = Math.max(longestSpur, length);
    }
  }

  return {
    longestSpur,
    cells,
    connected: cells > 0 && reached.size === cells,
    finishable: on(start.col, start.row) && painted.size === cells,
    trapFree,
    stops: stopKeys.size,
    deadEnds,
    solidBlocks,
    loops: cells > 0 ? edges - cells + 1 : 0,
    width: maxC - minC + 1,
    height: maxR - minR + 1,
    density: cells > 0 ? cells / ((maxC - minC + 1) * (maxR - minR + 1)) : 0,
  };
}

function fitsTier(stats: RelaxMazeStats, tier: RelaxTier): boolean {
  return (
    stats.connected &&
    stats.finishable &&
    stats.trapFree &&
    stats.cells >= tier.minCells &&
    stats.cells <= tier.maxCells &&
    stats.stops >= tier.minStops &&
    stats.deadEnds <= 3 &&
    stats.solidBlocks <= 2 &&
    stats.loops >= 2 &&
    stats.width >= 5 &&
    stats.height >= 6 &&
    stats.density >= 0.55 &&
    safeSilhouette(stats)
  );
}

/** Whether a maze's outline is safe to show: no long arm sticking out, and
 * not much taller than wide (or wider than tall). Random carving can, now and then, draw something
 * that is not a maze at all - these two rules are what such outlines have
 * in common, and every maze shown passes them, fallbacks included. */
export function safeSilhouette(stats: RelaxMazeStats): boolean {
  return stats.longestSpur <= 2 && Math.max(stats.width, stats.height) <= Math.min(stats.width, stats.height) * 1.6;
}

/** Trims empty rows and columns off every side, so the maze fills the
 * arena and its squares come out as large as the screen allows. */
function toShape(floor: ReadonlyArray<ReadonlyArray<boolean>>, start: Cell): MazeShape {
  const usedRows = floor.map((line, r) => (line.some(Boolean) ? r : -1)).filter(r => r >= 0);
  const usedCols = floor[0].map((_v, c) => (floor.some(line => line[c]) ? c : -1)).filter(c => c >= 0);
  const top = usedRows[0];
  const left = usedCols[0];
  const rows = usedRows[usedRows.length - 1] - top + 1;
  const cols = usedCols[usedCols.length - 1] - left + 1;
  const active = new Set<string>();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) if (floor[r + top][c + left]) active.add(cellKey(c, r));
  }
  const openEdges = new Set<string>();
  for (const key of active) {
    const [col, row] = key.split(':').map(Number);
    for (const { dc, dr } of DIRS) {
      if (active.has(cellKey(col + dc, row + dr))) openEdges.add(edgeKey({ col, row }, { col: col + dc, row: row + dr }));
    }
  }
  return { cols, rows, active, openEdges, start: { col: start.col - left, row: start.row - top } };
}

/** One maze of `tier`'s size, from `random`. Falls back to looser limits
 * rather than failing - a break must always have a maze to show. */
export function generateRelaxMaze(random: () => number, tier: RelaxTier): MazeShape {
  let fallback: { floor: boolean[][]; start: Cell } | null = null;
  for (let attempt = 0; attempt < 4000; attempt += 1) {
    // Small mazes are mirror-symmetric only now and then: at that size the
    // symmetric carvings are few (so they repeat) and their outlines are
    // the likeliest to read as a figure. Larger tiers need them to fill out.
    const carved = carve(random, random() < (tier.maxCells <= 30 ? 0.2 : 0.5));
    if (!carved) continue;
    const stats = relaxMazeStats(carved.floor, carved.start);
    if (fitsTier(stats, tier)) return toShape(carved.floor, carved.start);
    if (!fallback && stats.connected && stats.finishable && stats.trapFree && safeSilhouette(stats) && stats.cells >= 12) fallback = carved;
  }
  if (fallback) return toShape(fallback.floor, fallback.start);
  // Unreachable in practice (see the generator tests); a plain ring, so
  // the break still works.
  const ring = Array.from({ length: 5 }, (_v, r) => Array.from({ length: 5 }, (_w, c) => r === 0 || r === 4 || c === 0 || c === 4));
  return toShape(ring, { col: 0, row: 0 });
}

/** A whole break's mazes, one per tier, gentlest first. `seed` makes it
 * reproducible; the screen passes a fresh one each break. */
export function relaxBreakMazes(seed: number, count: number = RELAX_TIERS.length): MazeShape[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_v, i) => generateRelaxMaze(random, RELAX_TIERS[Math.min(i, RELAX_TIERS.length - 1)]));
}

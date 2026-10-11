import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * Weathervanes: vanes stand on some squares of a rooftop. Each points up,
 * right, down or left, at the nearest vane that way; a tap turns it a
 * quarter, clockwise. The wind is set when every vane points at another,
 * every vane is pointed at by exactly one, and no two point at each other
 * - so the wind runs round the roof in loops.
 *
 * From the middle tier, chimneys stand on some squares. Wind does not pass
 * a chimney: a vane pointing at one points into open air.
 */

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface VanePuzzle {
  readonly id: string;
  readonly name: string;
  readonly difficulty: PuzzleDifficulty;
  readonly size: number;
  readonly vanes: ReadonlyArray<Cell>;
  /** Squares the wind cannot pass (absent: none). */
  readonly chimneys?: ReadonlyArray<Cell>;
  /** Vanes set from the start, which do not turn (null: the player's). */
  readonly fixed: ReadonlyArray<Dir | null>;
  /** How each vane starts (fixed ones as fixed, the rest scattered). */
  readonly start: ReadonlyArray<Dir>;
  readonly solution: ReadonlyArray<Dir>;
}

export interface VaneState {
  readonly dirs: ReadonlyArray<Dir>;
}

export const STEP: ReadonlyArray<Cell> = [
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
];

/** A roof's shape: its size and the chimneys on it. */
export interface Roof {
  readonly size: number;
  readonly chimneys?: ReadonlyArray<Cell>;
}

/** For each vane, the nearest vane in each direction (-1: none, or a
 * chimney first). */
export function neighboursOf(roof: Roof, vanes: ReadonlyArray<Cell>): number[][] {
  const { size } = roof;
  const at = new Map(vanes.map((v, i) => [`${v.row},${v.col}`, i]));
  const blocked = new Set((roof.chimneys ?? []).map(c => `${c.row},${c.col}`));
  return vanes.map(v =>
    STEP.map(d => {
      for (let k = 1; k < size; k += 1) {
        const key = `${v.row + d.row * k},${v.col + d.col * k}`;
        if (blocked.has(key)) return -1;
        const hit = at.get(key);
        if (hit !== undefined) return hit;
        if (v.row + d.row * k < 0 || v.col + d.col * k < 0 || v.row + d.row * k >= size || v.col + d.col * k >= size) break;
      }
      return -1;
    }),
  );
}

const neighbourCache = new WeakMap<VanePuzzle, number[][]>();
export function neighbours(puzzle: VanePuzzle): number[][] {
  let n = neighbourCache.get(puzzle);
  if (!n) {
    n = neighboursOf(puzzle, puzzle.vanes);
    neighbourCache.set(puzzle, n);
  }
  return n;
}

export function initialVaneState(puzzle: VanePuzzle): VaneState {
  return { dirs: [...puzzle.start] };
}

/** Turns vane `i` a quarter, clockwise (fixed vanes stay). */
export function turn(puzzle: VanePuzzle, state: VaneState, i: number): VaneState {
  if (puzzle.fixed[i] !== null) return state;
  return { dirs: state.dirs.map((d, k) => (k === i ? (((d + 1) % 4) as Dir) : d)) };
}

/** What each vane points at (-1: open air). */
export function targets(puzzle: VanePuzzle, state: VaneState): number[] {
  const n = neighbours(puzzle);
  return state.dirs.map((d, i) => n[i][d]);
}

export type VaneTrouble = 'air' | 'crowded' | 'pair';

/**
 * What is wrong with each vane, if anything: pointing at open air, at a
 * vane another also points at, or at one pointing straight back.
 */
export function troubles(puzzle: VanePuzzle, state: VaneState): Array<VaneTrouble | null> {
  const t = targets(puzzle, state);
  const into = new Array<number>(t.length).fill(0);
  t.forEach(x => x >= 0 && (into[x] += 1));
  return t.map((x, i) => (x < 0 ? 'air' : t[x] === i ? 'pair' : into[x] > 1 ? 'crowded' : null));
}

/** How many vanes nothing points at yet. */
export function unreached(puzzle: VanePuzzle, state: VaneState): number {
  const t = targets(puzzle, state);
  return t.filter((_x, i) => !t.includes(i)).length;
}

export function isVaneSolved(puzzle: VanePuzzle, state: VaneState): boolean {
  return troubles(puzzle, state).every(x => x === null) && unreached(puzzle, state) === 0;
}

/** The loops the wind runs in once set, each as vane indices in order. */
export function loops(puzzle: VanePuzzle, state: VaneState): number[][] {
  const t = targets(puzzle, state);
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < t.length; i += 1) {
    if (seen.has(i)) continue;
    const loop: number[] = [];
    let k = i;
    while (k >= 0 && !seen.has(k)) {
      seen.add(k);
      loop.push(k);
      k = t[k];
    }
    if (k === i) out.push(loop);
  }
  return out;
}

/**
 * Settings that set the wind, up to `limit`, honouring `fixed`. Vanes are
 * decided fewest-choices first; a vane may not point at open air, at a
 * vane already pointed at, or back at one pointing at it.
 */
export function solveVanes(roof: Roof, vanes: ReadonlyArray<Cell>, fixed: ReadonlyArray<Dir | null>, limit = 2, budget = 300000): Dir[][] {
  const n = neighboursOf(roof, vanes);
  const count = vanes.length;
  const dirs: Array<Dir | null> = [...fixed];
  const pointedBy = new Array<number>(count).fill(-1);
  const out: Dir[][] = [];
  let nodes = 0;
  // Fixed vanes first.
  for (let i = 0; i < count; i += 1) {
    const d = fixed[i];
    if (d === null) continue;
    const to = n[i][d];
    if (to < 0 || pointedBy[to] >= 0) return [];
    pointedBy[to] = i;
  }
  for (let i = 0; i < count; i += 1) {
    const d = fixed[i];
    if (d !== null && dirs[n[i][d]] !== null && n[n[i][d]][dirs[n[i][d]]!] === i) return [];
  }
  const options = (i: number): Dir[] =>
    ([0, 1, 2, 3] as const).filter(d => {
      const to = n[i][d];
      if (to < 0 || pointedBy[to] >= 0) return false;
      const back = dirs[to];
      return !(back !== null && n[to][back] === i);
    });
  const walk = (): void => {
    if (out.length >= limit || (nodes += 1) > budget) return;
    let pick = -1;
    let pickOptions: Dir[] = [];
    for (let i = 0; i < count; i += 1) {
      if (dirs[i] !== null) continue;
      const o = options(i);
      if (o.length === 0) return;
      if (pick < 0 || o.length < pickOptions.length) {
        pick = i;
        pickOptions = o;
      }
    }
    if (pick < 0) {
      out.push([...dirs] as Dir[]);
      return;
    }
    // A vane nothing points at, and nothing undecided can, is a dead end.
    for (let v = 0; v < count; v += 1) {
      if (pointedBy[v] >= 0) continue;
      let reachable = false;
      for (let u = 0; u < count && !reachable; u += 1) {
        if (dirs[u] !== null) continue;
        for (let d = 0; d < 4; d += 1) {
          if (n[u][d] !== v) continue;
          const back = dirs[v];
          if (back === null || n[v][back] !== u) {
            reachable = true;
            break;
          }
        }
      }
      if (!reachable) return;
    }
    for (const d of pickOptions) {
      const to = n[pick][d];
      dirs[pick] = d;
      pointedBy[to] = pick;
      walk();
      dirs[pick] = null;
      pointedBy[to] = -1;
      if (out.length >= limit) return;
    }
  };
  walk();
  return out;
}

/**
 * What a player can work out from `known` (vanes set or settled) by the
 * game's plain steps, repeated until they give no more: a vane cannot
 * point at open air, at a vane another already points at, or back at a
 * vane pointing at it; and a vane only one other vane can still point at
 * must be pointed at by that one. Returns each vane's ways still open.
 */
export function reasonVanes(roof: Roof, vanes: ReadonlyArray<Cell>, known: ReadonlyArray<Dir | null>): Dir[][] {
  const n = neighboursOf(roof, vanes);
  const count = vanes.length;
  const open: Dir[][] = vanes.map((_v, i) => (known[i] !== null ? [known[i]!] : ([0, 1, 2, 3] as const).filter(d => n[i][d] >= 0)));
  for (let changed = true; changed; ) {
    changed = false;
    const prune = (i: number, keep: (d: Dir) => boolean) => {
      const before = open[i].length;
      open[i] = open[i].filter(keep);
      if (open[i].length !== before) changed = true;
    };
    for (let i = 0; i < count; i += 1) {
      if (open[i].length !== 1) continue;
      const to = n[i][open[i][0]];
      // Nothing else may point at `to`, and `to` may not point back.
      for (let k = 0; k < count; k += 1) if (k !== i) prune(k, d => n[k][d] !== to);
      prune(to, d => n[to][d] !== i);
    }
    for (let v = 0; v < count; v += 1) {
      const sources: Array<[number, Dir]> = [];
      for (let u = 0; u < count; u += 1) for (const d of open[u]) if (n[u][d] === v) sources.push([u, d]);
      if (sources.length === 1 && open[sources[0][0]].length > 1) {
        const [u, d] = sources[0];
        prune(u, x => x === d);
      }
    }
    if (open.some(o => o.length === 0)) break;
  }
  return open;
}

/** Whether a roof can be read out vane by vane from its pins, no guess. */
export function readable(roof: Roof, vanes: ReadonlyArray<Cell>, fixed: ReadonlyArray<Dir | null>): boolean {
  return reasonVanes(roof, vanes, fixed).every(o => o.length === 1);
}

export interface VaneHint {
  readonly vane: number;
  readonly dir: Dir;
  readonly state: VaneState;
  readonly reason: string;
}

const WAY = ['up', 'right', 'down', 'left'] as const;

/** The next vane to set, with why: a vane in trouble first, then any
 * vane not yet as the finished roof has it. */
export function vaneHint(puzzle: VanePuzzle, state: VaneState): VaneHint | null {
  const trouble = troubles(puzzle, state);
  const wrong = state.dirs.map((d, i) => (d !== puzzle.solution[i] ? i : -1)).filter(i => i >= 0);
  if (wrong.length === 0) return null;
  // Prefer a vane the settled ones already force, so the hint reads as
  // reasoning: from the pins and every vane already right.
  const settled = state.dirs.map((d, i) => (puzzle.fixed[i] !== null || d === puzzle.solution[i] ? d : null));
  const open = reasonVanes(puzzle, puzzle.vanes, settled);
  const forced = wrong.find(i => open[i].length === 1);
  const vane = wrong.find(i => trouble[i] !== null && open[i].length === 1) ?? forced ?? wrong.find(i => trouble[i] !== null) ?? wrong[0];
  const dir = puzzle.solution[vane];
  if (forced !== undefined && vane === forced && trouble[vane] === null) {
    return {
      vane,
      dir,
      state: { dirs: state.dirs.map((d, i) => (i === vane ? dir : d)) },
      reason: `It can only point ${WAY[dir]}. Every other way meets open air, a vane already pointed at, or one pointing straight back.`,
    };
  }
  const why =
    trouble[vane] === 'air'
      ? 'It points at open air, and every vane must point at another.'
      : trouble[vane] === 'pair'
        ? 'It and its neighbour point at each other. The wind cannot run in a loop of two.'
        : trouble[vane] === 'crowded'
          ? 'The vane it points at is already pointed at by another.'
          : 'Each vane needs exactly one vane pointing at it.';
  return { vane, dir, state: { dirs: state.dirs.map((d, i) => (i === vane ? dir : d)) }, reason: `${why} Turned ${WAY[dir]}, it keeps the loops whole.` };
}

// ---------------------------------------------------------------------------
// Making roofs
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A loop's corners, in order round it: a rectangle, or an L of six. */
function randomLoop(size: number, random: () => number, corners: 4 | 6): Cell[] {
  const pick3 = () => {
    const xs = new Set<number>();
    while (xs.size < 3) xs.add(Math.floor(random() * size));
    return [...xs].sort((x, y) => x - y);
  };
  if (corners === 4) {
    const [r1, r2] = pick3().slice(random() < 0.5 ? 0 : 1);
    const [c1, c2] = pick3().slice(random() < 0.5 ? 0 : 1);
    return [{ row: r1, col: c1 }, { row: r1, col: c2 }, { row: r2, col: c2 }, { row: r2, col: c1 }];
  }
  const [r1, r2, r3] = pick3();
  const [c1, c2, c3] = pick3();
  const l = [{ row: r1, col: c1 }, { row: r1, col: c3 }, { row: r2, col: c3 }, { row: r2, col: c2 }, { row: r3, col: c2 }, { row: r3, col: c1 }];
  // Any of the four ways round, so the notch is not always bottom right.
  const flipR = random() < 0.5;
  const flipC = random() < 0.5;
  return l.map(c => ({ row: flipR ? size - 1 - c.row : c.row, col: flipC ? size - 1 - c.col : c.col }));
}

export interface RoofShape {
  readonly size: number;
  readonly vanes: number;
  readonly chimneys: number;
}

/**
 * A roof of `shape.vanes` vanes on a `shape.size` square with exactly one
 * way to set the wind, readable vane by vane. The wind's loops are drawn
 * first - rectangles and L shapes - and a vane stood on every corner; one
 * setting is found, and chimneys are put up where they cut across wind
 * that setting does not use (never across its own). Then vanes are pinned
 * wherever a second setting disagrees (a loop can always run the other way
 * round), then wherever the reasoning stalls; medium and hard take back
 * every pin the reasoning does not need.
 */
export function generateVanes(id: string, name: string, difficulty: PuzzleDifficulty, shape: RoofShape): VanePuzzle {
  const { size, vanes: count } = shape;
  const random = mulberry32(hashId(id));
  const key = (c: Cell) => `${c.row},${c.col}`;
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const cells: Cell[] = [];
    const taken = new Set<string>();
    for (let guard = 0; guard < 40 && cells.length < count; guard += 1) {
      const left = count - cells.length;
      const corners: 4 | 6 = left === 4 ? 4 : left === 6 ? 6 : left < 4 ? 4 : random() < 0.6 ? 4 : 6;
      if (left < corners) break;
      const loop = randomLoop(size, random, corners);
      if (loop.some(c => taken.has(key(c)))) continue;
      for (const c of loop) {
        taken.add(key(c));
        cells.push(c);
      }
    }
    if (cells.length !== count) continue;
    cells.sort((a, b) => a.row - b.row || a.col - b.col);
    const blank: Array<Dir | null> = cells.map(() => null);
    const any = solveVanes({ size }, cells, blank, 1);
    if (any.length === 0) continue;
    const solution = any[0];

    // Chimneys: on open squares between two vanes in line, off the wind the
    // setting uses - so they only ever take choices away.
    const used = new Set<string>();
    const between = (a: Cell, b: Cell, add: (c: Cell) => void) => {
      const dr = Math.sign(b.row - a.row);
      const dc = Math.sign(b.col - a.col);
      for (let r = a.row + dr, c = a.col + dc; r !== b.row || c !== b.col; r += dr, c += dc) add({ row: r, col: c });
    };
    const n0 = neighboursOf({ size }, cells);
    cells.forEach((v, i) => between(v, cells[n0[i][solution[i]]], c => used.add(key(c))));
    const spots = new Map<string, Cell>();
    cells.forEach((v, i) =>
      n0[i].forEach((to, d) => {
        if (to >= 0 && d !== solution[i]) between(v, cells[to], c => !used.has(key(c)) && spots.set(key(c), c));
      }),
    );
    const pool = [...spots.values()].sort(() => random() - 0.5);
    if (pool.length < shape.chimneys) continue;
    const roof: Roof = { size, chimneys: pool.slice(0, shape.chimneys) };

    const fixed = [...blank];
    let unique = false;
    for (let guard = 0; guard <= count; guard += 1) {
      const answers = solveVanes(roof, cells, fixed, 2);
      const other = answers.find(a => a.some((d, i) => d !== solution[i]));
      if (!other) {
        unique = answers.length === 1;
        break;
      }
      const differing = solution.map((d, i) => (other[i] !== d && fixed[i] === null ? i : -1)).filter(i => i >= 0);
      const pick = differing[Math.floor(random() * differing.length)];
      fixed[pick] = solution[pick];
    }
    if (!unique) continue;
    // Then enough more pins that the roof reads out vane by vane, never a
    // guess: whichever pin settles the most of the rest.
    for (let guard = 0; guard < count && !readable(roof, cells, fixed); guard += 1) {
      let best = -1;
      let bestSettled = -1;
      for (let i = 0; i < count; i += 1) {
        if (fixed[i] !== null) continue;
        fixed[i] = solution[i];
        const settled = reasonVanes(roof, cells, fixed).filter(o => o.length === 1).length;
        fixed[i] = null;
        if (settled > bestSettled) {
          best = i;
          bestSettled = settled;
        }
      }
      fixed[best] = solution[best];
    }
    // Medium and hard: take back every pin the reasoning does not need.
    if (difficulty !== 'easy') {
      for (const i of cells.map((_c, k) => k).sort(() => random() - 0.5)) {
        if (fixed[i] === null) continue;
        const keep = fixed[i];
        fixed[i] = null;
        if (!readable(roof, cells, fixed)) fixed[i] = keep;
      }
    }
    // Too many pins leaves nothing to do.
    if (fixed.filter(f => f !== null).length > count * 0.4) continue;
    const start = solution.map((d, i) => (fixed[i] !== null ? d : (((d + 1 + Math.floor(random() * 3)) % 4) as Dir)));
    return { id, name, difficulty, size, vanes: cells, chimneys: roof.chimneys, fixed, start, solution };
  }
  throw new Error(`Weathervanes ${id}: no roof found.`);
}

// ---------------------------------------------------------------------------
// The roofs
// ---------------------------------------------------------------------------

/**
 * Each tier's roofs, in the order they are dealt: name, size, vanes and
 * chimneys. Easy is small and open; chimneys arrive with the middle tier,
 * one at first.
 */
const ROOFS: Record<PuzzleDifficulty, ReadonlyArray<readonly [name: string, size: number, vanes: number, chimneys: number]>> = {
  easy: [
    ['Still Air', 4, 4, 0],
    ['Light Breeze', 4, 6, 0],
    ['Barn Roof', 4, 8, 0],
    ['Sea Wind', 5, 8, 0],
    ['Weathercock', 5, 8, 0],
    ['Dovecote', 5, 10, 0],
    ['Hay Loft', 5, 10, 0],
    ['Orchard Wind', 5, 10, 0],
    ['West Wind', 5, 12, 0],
    ['Cottage Row', 5, 12, 0],
    ['Kite Day', 6, 12, 0],
    ['Fair Weather', 6, 12, 0],
  ],
  medium: [
    ['First Chimney', 5, 10, 1],
    ['Gusty Lane', 5, 12, 1],
    ['Turning Weather', 6, 12, 1],
    ['Church Spire', 6, 14, 1],
    ['Harbour Roofs', 6, 14, 2],
    ['Market Hall', 6, 14, 2],
    ['Rain Coming', 6, 16, 2],
    ['Mill Sails', 6, 16, 2],
    ['Squall', 7, 16, 2],
    ['Town Hall', 7, 18, 2],
  ],
  hard: [
    ['Gale Warning', 7, 18, 2],
    ['North Tower', 7, 20, 3],
    ['Storm Front', 7, 20, 3],
    ['Equinox', 7, 22, 3],
    ['Cathedral Roof', 8, 22, 3],
    ['Lighthouse Gallery', 8, 24, 3],
    ['Tempest', 8, 24, 4],
    ['Four Winds', 8, 26, 4],
  ],
};

const ENDLESS_SHAPE: Record<PuzzleDifficulty, RoofShape> = {
  easy: { size: 5, vanes: 10, chimneys: 0 },
  medium: { size: 6, vanes: 14, chimneys: 2 },
  hard: { size: 7, vanes: 20, chimneys: 3 },
};

const cache = new Map<string, VanePuzzle>();

function curatedId(difficulty: PuzzleDifficulty, index: number): string {
  return `vanes-${difficulty}-${String(index + 1).padStart(2, '0')}`;
}

/** The ids of a tier's roofs, in deal order - without building them. */
export function vaneIdsFor(difficulty: PuzzleDifficulty): ReadonlyArray<string> {
  return ROOFS[difficulty].map((_r, i) => curatedId(difficulty, i));
}

/** Every curated roof as id, name and tier only - cheap to list. */
export const VANE_ROOFS: ReadonlyArray<{ id: string; name: string; difficulty: PuzzleDifficulty }> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty =>
  ROOFS[difficulty].map((r, i) => ({ id: curatedId(difficulty, i), name: r[0], difficulty })),
);

/** A curated roof's name and tier, from its id alone (null otherwise). */
export function vaneCuratedInfo(id: string): { name: string; difficulty: PuzzleDifficulty } | null {
  const m = /^vanes-(easy|medium|hard)-(\d+)$/.exec(id);
  if (!m) return null;
  const difficulty = m[1] as PuzzleDifficulty;
  const entry = ROOFS[difficulty][Number(m[2]) - 1];
  return entry ? { name: entry[0], difficulty } : null;
}

/** Any roof by id, built the first time it is asked for and kept; endless
 * ones need their name and tier from the caller. */
export function getVanesById(id: string, endless?: { name: string; tier: PuzzleDifficulty }): VanePuzzle | undefined {
  const hit = cache.get(id);
  if (hit) return hit;
  const m = /^vanes-(easy|medium|hard)-(\d+)$/.exec(id);
  let puzzle: VanePuzzle | undefined;
  if (m) {
    const difficulty = m[1] as PuzzleDifficulty;
    const entry = ROOFS[difficulty][Number(m[2]) - 1];
    if (entry) puzzle = generateVanes(id, entry[0], difficulty, { size: entry[1], vanes: entry[2], chimneys: entry[3] });
  } else if (endless) {
    puzzle = generateVanes(id, endless.name, endless.tier, ENDLESS_SHAPE[endless.tier]);
  }
  if (puzzle) cache.set(id, puzzle);
  return puzzle;
}

/** The roofs the Home test button walks through, small to large. */
export const VANE_TRIAL_IDS: ReadonlyArray<string> = ['vanes-easy-02', 'vanes-easy-04', 'vanes-easy-08', 'vanes-medium-01', 'vanes-medium-05', 'vanes-hard-01', 'vanes-hard-04'];

export function getVaneTrial(index: number): VanePuzzle {
  return getVanesById(VANE_TRIAL_IDS[index])!;
}

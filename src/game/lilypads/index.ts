import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * Lily Pads: a frog on a pond. It hops in a straight line - up, down, left
 * or right - to the nearest pad that way, over open water, and the pad it
 * leaves sinks behind it. Visit every pad: the pond is cleared when the
 * frog sits on the last one.
 *
 * Lotus pads, from a little way in, are sturdier: the first time the frog
 * leaves one only its lotus sinks, and the pad stays - so the frog must
 * come back to it, and while it floats it stops every hop along its row
 * and column.
 *
 * Every pond is made by walking the frog first and laying a pad wherever
 * it lands, so there is always a way through; the thinking is in never
 * stranding a pad you can no longer reach.
 */

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface LilyPuzzle {
  readonly id: string;
  readonly name: string;
  readonly difficulty: PuzzleDifficulty;
  readonly size: number;
  /** Every pad, the frog's starting one first. */
  readonly pads: ReadonlyArray<Cell>;
  /** Lotus pads: each takes two departures to sink (absent: none). */
  readonly lotus?: ReadonlyArray<boolean>;
  /** One way through, pad indices in hop order (the generator's walk). */
  readonly solution: ReadonlyArray<number>;
}

export interface LilyState {
  /** The pad the frog sits on. */
  readonly at: number;
  /** Pads still afloat (the frog's own included). */
  readonly afloat: ReadonlyArray<boolean>;
  /** Lotus pads not yet left: leaving one sinks only its lotus. */
  readonly lotus?: ReadonlyArray<boolean>;
}

export const DIRECTIONS: ReadonlyArray<Cell> = [
  { row: -1, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
];

export function initialLilyState(puzzle: LilyPuzzle): LilyState {
  return { at: 0, afloat: puzzle.pads.map(() => true), lotus: puzzle.pads.map((_p, i) => puzzle.lotus?.[i] ?? false) };
}

function padAt(puzzle: LilyPuzzle, afloat: ReadonlyArray<boolean>, row: number, col: number): number {
  return puzzle.pads.findIndex((p, i) => afloat[i] && p.row === row && p.col === col);
}

/** Where the frog can go from here: the nearest pad afloat in each
 * direction, if any. */
export function hopsFrom(puzzle: LilyPuzzle, state: LilyState): number[] {
  const from = puzzle.pads[state.at];
  const out: number[] = [];
  for (const d of DIRECTIONS) {
    for (let k = 1; k < puzzle.size; k += 1) {
      const row = from.row + d.row * k;
      const col = from.col + d.col * k;
      if (row < 0 || col < 0 || row >= puzzle.size || col >= puzzle.size) break;
      const pad = padAt(puzzle, state.afloat, row, col);
      if (pad >= 0) {
        out.push(pad);
        break;
      }
    }
  }
  return out;
}

/** The frog hops to `pad` if it can; the pad it leaves sinks - or, for a
 * lotus pad left the first time, only its lotus does. */
export function hop(puzzle: LilyPuzzle, state: LilyState, pad: number): LilyState {
  if (!hopsFrom(puzzle, state).includes(pad)) return state;
  const holds = state.lotus?.[state.at] ?? false;
  return {
    at: pad,
    afloat: holds ? state.afloat : state.afloat.map((a, i) => (i === state.at ? false : a)),
    lotus: state.lotus?.map((l, i) => (i === state.at ? false : l)),
  };
}

export function padsLeft(state: LilyState): number {
  return state.afloat.filter(Boolean).length;
}

export function isLilySolved(state: LilyState): boolean {
  return padsLeft(state) === 1;
}

/** No hop left, and pads still waiting: the frog is stranded. */
export function isStranded(puzzle: LilyPuzzle, state: LilyState): boolean {
  return !isLilySolved(state) && hopsFrom(puzzle, state).length === 0;
}

/**
 * Pads that can never be reached again: no other pad afloat (the frog's
 * included) shares their row or column. One of these means the pond can
 * no longer be cleared, however the frog goes on.
 */
export function cutOff(puzzle: LilyPuzzle, state: LilyState): number[] {
  return puzzle.pads
    .map((p, i) => {
      if (!state.afloat[i] || i === state.at) return -1;
      const linked = puzzle.pads.some((q, k) => k !== i && state.afloat[k] && (q.row === p.row || q.col === p.col));
      return linked ? -1 : i;
    })
    .filter(i => i >= 0);
}

/**
 * A way to clear the pond from here, as pads in hop order, or null if
 * there is none. Depth first, nearest-first; ponds are small enough.
 */
export function solveLily(puzzle: LilyPuzzle, state: LilyState, budget = 200000): number[] | null {
  let nodes = 0;
  const path: number[] = [];
  const walk = (s: LilyState): boolean => {
    if (isLilySolved(s)) return true;
    if ((nodes += 1) > budget) return false;
    for (const next of hopsFrom(puzzle, s)) {
      path.push(next);
      if (walk(hop(puzzle, s, next))) return true;
      path.pop();
    }
    return false;
  };
  return walk(state) ? path : null;
}

export interface LilyHint {
  /** Undo this many hops first (0 if the frog can still finish from here). */
  readonly back: number;
  /** Then hop here. */
  readonly pad: number;
  readonly reason: string;
}

/**
 * The next hop, with why. If the frog can no longer clear the pond from
 * where it is, the hint says how far back the way out lies instead.
 */
export function lilyHint(puzzle: LilyPuzzle, history: ReadonlyArray<LilyState>, state: LilyState): LilyHint | null {
  const timeline = [...history, state];
  for (let back = 0; back < timeline.length; back += 1) {
    const from = timeline[timeline.length - 1 - back];
    const way = solveLily(puzzle, from);
    if (way && way.length > 0) {
      const options = hopsFrom(puzzle, from).length;
      const reason =
        back > 0
          ? `From here a pad can no longer be reached. Go back ${back} ${back === 1 ? 'hop' : 'hops'}: this pad keeps every other one in reach.`
          : options === 1
            ? 'This is the only pad in reach.'
            : 'Hop here: every pad left can still be reached afterwards.';
      return { back, pad: way[0], reason };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Making ponds
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** How many ways through a pond has, counted up to `limit`. Fewer is a
 * sharper pond: more of its hops are traps. */
function waysThrough(puzzle: LilyPuzzle, limit: number): number {
  let ways = 0;
  let nodes = 0;
  const walk = (s: LilyState) => {
    if (ways >= limit || (nodes += 1) > 50000) return;
    if (isLilySolved(s)) {
      ways += 1;
      return;
    }
    for (const next of hopsFrom(puzzle, s)) walk(hop(puzzle, s, next));
  };
  walk(initialLilyState(puzzle));
  return ways;
}

export interface PondShape {
  readonly size: number;
  readonly pads: number;
  /** How many of the pads are lotus pads. */
  readonly lotus: number;
}

/**
 * A pond of `shape.pads` pads on a `shape.size` square, `shape.lotus` of
 * them lotus pads. The frog walks first: each hop goes a random way and
 * distance onto open water - never onto a square an earlier hop flew over
 * (a pad there would have stopped it), never past a pad still afloat, and
 * back onto a lotus pad it has left once. Longer hops are preferred, so
 * the pond spreads; of several walks, the one with the fewest other ways
 * through is kept.
 */
export function generateLily(id: string, name: string, difficulty: PuzzleDifficulty, shape: PondShape): LilyPuzzle {
  const { size, pads, lotus } = shape;
  const random = mulberry32(hashId(id));
  const key = (c: Cell) => `${c.row},${c.col}`;
  let best: LilyPuzzle | null = null;
  let bestWays = Infinity;
  const tries = difficulty === 'easy' ? 6 : 14;
  for (let attempt = 0; attempt < 1500 && (best === null || attempt < tries); attempt += 1) {
    const cells: Cell[] = [{ row: Math.floor(random() * size), col: Math.floor(random() * size) }];
    const index = new Map<string, number>([[key(cells[0]), 0]]);
    const isLotus: boolean[] = [false];
    const afloat = new Set<number>([0]);
    // Lotus pads left once and still waiting for the frog to come back.
    const waiting = new Set<number>();
    const flown = new Set<string>();
    const path: number[] = [];
    let at = 0;
    let ok = true;
    for (let guard = 0; guard < pads * 3; guard += 1) {
      const done = cells.length === pads && waiting.size === 0;
      if (done) break;
      // Leaving: a new pad may become a lotus pad (not the first, so the
      // opening hop is plain), which stays afloat for a second visit.
      const lotusLeft = lotus - isLotus.filter(Boolean).length;
      const firstLeave = !waiting.has(at) && !isLotus[at];
      if (firstLeave && at !== 0 && lotusLeft > 0 && cells.length < pads && random() < 0.4) {
        isLotus[at] = true;
        waiting.add(at);
      } else {
        afloat.delete(at);
        waiting.delete(at);
      }
      const options: Array<{ to: Cell; over: Cell[]; back: boolean }> = [];
      for (const d of DIRECTIONS) {
        const over: Cell[] = [];
        for (let k = 1; k < size; k += 1) {
          const to = { row: cells[at].row + d.row * k, col: cells[at].col + d.col * k };
          if (to.row < 0 || to.col < 0 || to.row >= size || to.col >= size) break;
          const there = index.get(key(to));
          if (there !== undefined && afloat.has(there)) {
            // A pad afloat stops the frog: it can only be a lotus pad
            // waiting for its second visit.
            if (waiting.has(there)) options.push({ to, over: [...over], back: true });
            break;
          }
          if (there !== undefined) {
            over.push(to);
            continue;
          }
          if (cells.length < pads && !flown.has(key(to))) options.push({ to, over: [...over], back: false });
          over.push(to);
        }
      }
      if (options.length === 0) {
        ok = false;
        break;
      }
      // Favour longer hops, and coming back once most pads are laid.
      const weights = options.map(o => (1 + o.over.length * 0.8) * (o.back ? (cells.length >= pads * 0.6 ? 2.5 : 0.6) : 1));
      let pick = random() * weights.reduce((x, y) => x + y, 0);
      let choice = options[0];
      for (let i = 0; i < options.length; i += 1) {
        pick -= weights[i];
        if (pick <= 0) {
          choice = options[i];
          break;
        }
      }
      for (const c of choice.over) if (!index.has(key(c))) flown.add(key(c));
      let next = index.get(key(choice.to));
      if (next === undefined) {
        next = cells.length;
        cells.push(choice.to);
        index.set(key(choice.to), next);
        isLotus.push(false);
        afloat.add(next);
      }
      path.push(next);
      at = next;
    }
    if (!ok || cells.length !== pads || waiting.size > 0 || isLotus.filter(Boolean).length !== lotus) continue;
    const puzzle: LilyPuzzle = { id, name, difficulty, size, pads: cells, lotus: isLotus, solution: path };
    // The walk must replay exactly as laid.
    let s = initialLilyState(puzzle);
    for (const next of puzzle.solution) s = hop(puzzle, s, next);
    if (!isLilySolved(s) || s.at !== path[path.length - 1]) continue;
    const ways = waysThrough(puzzle, 40);
    if (ways < bestWays) {
      best = puzzle;
      bestWays = ways;
    }
  }
  if (!best) throw new Error(`Lily Pads ${id}: no pond found.`);
  return best;
}

// ---------------------------------------------------------------------------
// The ponds
// ---------------------------------------------------------------------------

/**
 * Each tier's ponds, in the order they are dealt: name, size, pads and
 * lotus pads. Easy begins on tiny ponds with no lotus at all; lotus pads
 * arrive at the seventh, one at a time, and grow more common with the
 * pond.
 */
const PONDS: Record<PuzzleDifficulty, ReadonlyArray<readonly [name: string, size: number, pads: number, lotus: number]>> = {
  easy: [
    ['Morning Pond', 4, 5, 0],
    ['Reed Bed', 4, 6, 0],
    ['Willow Shade', 5, 7, 0],
    ['Duck Pond', 5, 8, 0],
    ['Still Water', 5, 8, 0],
    ['Mossy Stones', 5, 9, 0],
    ['First Lotus', 5, 8, 1],
    ['Kingfisher Bank', 5, 9, 1],
    ['Little Brook', 5, 10, 1],
    ['Moorhen Pool', 6, 10, 1],
    ['Bulrush Bend', 6, 11, 1],
    ['Garden Pond', 6, 11, 1],
  ],
  medium: [
    ['Mill Pond', 6, 12, 1],
    ['Dragonfly Pool', 6, 12, 2],
    ['Water Garden', 6, 13, 1],
    ['Lotus Bay', 6, 13, 2],
    ["Heron's Watch", 6, 14, 2],
    ['Old Moat', 6, 14, 2],
    ['Lantern Fen', 7, 14, 2],
    ['Swan Reach', 7, 15, 2],
    ['Cress Beds', 7, 15, 2],
    ['Lily Cove', 7, 16, 2],
  ],
  hard: [
    ['Heron Lake', 7, 17, 2],
    ['Abbey Fishpond', 7, 18, 3],
    ['Summer Lake', 7, 18, 2],
    ['Great Marsh', 7, 19, 3],
    ['Twilight Fen', 7, 20, 3],
    ['Lake of Lilies', 7, 20, 3],
    ['Deep Mere', 8, 21, 3],
    ['Emperor Pond', 8, 22, 3],
  ],
};

/** Endless ponds, by tier. */
const ENDLESS_SHAPE: Record<PuzzleDifficulty, PondShape> = {
  easy: { size: 5, pads: 9, lotus: 1 },
  medium: { size: 6, pads: 14, lotus: 2 },
  hard: { size: 7, pads: 19, lotus: 3 },
};

const cache = new Map<string, LilyPuzzle>();

function curatedId(difficulty: PuzzleDifficulty, index: number): string {
  return `lily-${difficulty}-${String(index + 1).padStart(2, '0')}`;
}

/** The ids of a tier's ponds, in deal order - without building them. */
export function lilyIdsFor(difficulty: PuzzleDifficulty): ReadonlyArray<string> {
  return PONDS[difficulty].map((_p, i) => curatedId(difficulty, i));
}

/** Every curated pond as id, name and tier only - cheap to list. */
export const LILY_PONDS: ReadonlyArray<{ id: string; name: string; difficulty: PuzzleDifficulty }> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty =>
  PONDS[difficulty].map((p, i) => ({ id: curatedId(difficulty, i), name: p[0], difficulty })),
);

/** A curated pond's name and tier, from its id alone (null otherwise). */
export function lilyCuratedInfo(id: string): { name: string; difficulty: PuzzleDifficulty } | null {
  const m = /^lily-(easy|medium|hard)-(\d+)$/.exec(id);
  if (!m) return null;
  const difficulty = m[1] as PuzzleDifficulty;
  const entry = PONDS[difficulty][Number(m[2]) - 1];
  return entry ? { name: entry[0], difficulty } : null;
}

/** Any pond by id, built the first time it is asked for and kept; endless
 * ones need their name and tier from the caller. */
export function getLilyById(id: string, endless?: { name: string; tier: PuzzleDifficulty }): LilyPuzzle | undefined {
  const hit = cache.get(id);
  if (hit) return hit;
  const m = /^lily-(easy|medium|hard)-(\d+)$/.exec(id);
  let puzzle: LilyPuzzle | undefined;
  if (m) {
    const difficulty = m[1] as PuzzleDifficulty;
    const entry = PONDS[difficulty][Number(m[2]) - 1];
    if (entry) puzzle = generateLily(id, entry[0], difficulty, { size: entry[1], pads: entry[2], lotus: entry[3] });
  } else if (endless) {
    puzzle = generateLily(id, endless.name, endless.tier, ENDLESS_SHAPE[endless.tier]);
  }
  if (puzzle) cache.set(id, puzzle);
  return puzzle;
}

/** The ponds the Home test button walks through, small to large. */
export const LILY_TRIAL_IDS: ReadonlyArray<string> = ['lily-easy-01', 'lily-easy-04', 'lily-easy-07', 'lily-medium-01', 'lily-medium-04', 'lily-hard-01', 'lily-hard-04'];

export function getLilyTrial(index: number): LilyPuzzle {
  return getLilyById(LILY_TRIAL_IDS[index])!;
}

/**
 * Stained Glass - a leaded window of irregular panes. Colour every pane
 * ruby, cobalt or amber so that no two panes sharing a stretch of lead are
 * the same colour. A few panes come already coloured, and each window has
 * exactly one way to finish it.
 *
 * Three colours, not four, is the whole puzzle: with four almost any map
 * colours itself, but with three a pane that touches ruby and cobalt can
 * only be amber - and that one deduction, made again and again, is the
 * game. Pure data and functions here; no React, no Skia.
 */
import { PuzzleDifficulty } from '../puzzleDifficulty';

/** 0 ruby, 1 cobalt, 2 amber. */
export type GlassColor = 0 | 1 | 2;
export const GLASS_COLORS: ReadonlyArray<GlassColor> = [0, 1, 2];
export const GLASS_COLOR_NAMES = ['ruby', 'cobalt', 'amber'] as const;

export interface GlassPuzzle {
  readonly id: string;
  readonly name: string;
  readonly difficulty: PuzzleDifficulty;
  readonly rows: number;
  readonly cols: number;
  /** Which pane each cell belongs to. */
  readonly paneOf: ReadonlyArray<ReadonlyArray<number>>;
  readonly panes: number;
  /** Panes that share lead, by pane. */
  readonly touching: ReadonlyArray<ReadonlyArray<number>>;
  /** The panes coloured from the start (null: the player's to colour). */
  readonly given: ReadonlyArray<GlassColor | null>;
  /** The one finished window. */
  readonly solution: ReadonlyArray<GlassColor>;
}

export interface GlassState {
  readonly colors: ReadonlyArray<GlassColor | null>;
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

export function initialGlassState(puzzle: GlassPuzzle): GlassState {
  return { colors: [...puzzle.given] };
}

/** Colours (or, with `null`, clears) a pane. A given pane never changes. */
export function paint(puzzle: GlassPuzzle, state: GlassState, pane: number, color: GlassColor | null): GlassState {
  if (puzzle.given[pane] !== null || state.colors[pane] === color) return state;
  const colors = [...state.colors];
  colors[pane] = color;
  return { colors };
}

/** Pairs of touching panes wearing the same colour, each once (a < b). */
export function clashes(puzzle: GlassPuzzle, state: GlassState): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let a = 0; a < puzzle.panes; a += 1) {
    const color = state.colors[a];
    if (color === null) continue;
    for (const b of puzzle.touching[a]) if (b > a && state.colors[b] === color) out.push([a, b]);
  }
  return out;
}

/** Panes still clear. */
export function panesLeft(state: GlassState): number {
  return state.colors.filter(c => c === null).length;
}

/** Every pane coloured and no two touching panes alike - any such window
 * counts, though there is only ever the one. */
export function isGlassSolved(puzzle: GlassPuzzle, state: GlassState): boolean {
  return panesLeft(state) === 0 && clashes(puzzle, state).length === 0;
}

/** The pane at a cell. */
export function paneAt(puzzle: GlassPuzzle, row: number, col: number): number | null {
  if (row < 0 || col < 0 || row >= puzzle.rows || col >= puzzle.cols) return null;
  return puzzle.paneOf[row][col];
}

export interface GlassHint {
  readonly pane: number;
  readonly color: GlassColor;
  readonly state: GlassState;
  readonly reason: string;
  readonly kind: 'fix' | 'rule';
  readonly tip?: string;
}

/**
 * The next pane to colour, with why. A wrongly coloured pane is put right
 * first; otherwise the clear pane the board already says the most about -
 * the one touching the most colours - is coloured, and the reason names
 * the colours around it.
 */
export function glassHint(puzzle: GlassPuzzle, state: GlassState): GlassHint | null {
  const wrong = state.colors.findIndex((c, i) => c !== null && c !== puzzle.solution[i]);
  if (wrong >= 0) {
    const color = puzzle.solution[wrong];
    return { pane: wrong, color, state: paint(puzzle, state, wrong, color), reason: `This pane has to be ${GLASS_COLOR_NAMES[color]}. The colours around it leave it no other.`, kind: 'fix' };
  }
  let best = -1;
  let bestSeen = -1;
  for (let p = 0; p < puzzle.panes; p += 1) {
    if (state.colors[p] !== null) continue;
    const seen = new Set(puzzle.touching[p].map(q => state.colors[q]).filter((c): c is GlassColor => c !== null)).size;
    if (seen > bestSeen) {
      best = p;
      bestSeen = seen;
    }
  }
  if (best < 0) return null;
  const color = puzzle.solution[best];
  const around = [...new Set(puzzle.touching[best].map(q => state.colors[q]).filter((c): c is GlassColor => c !== null))];
  const reason =
    around.length === 2
      ? `It touches ${GLASS_COLOR_NAMES[around[0]]} and ${GLASS_COLOR_NAMES[around[1]]}, so it can only be ${GLASS_COLOR_NAMES[color]}.`
      : `Only ${GLASS_COLOR_NAMES[color]} lets the panes around it be finished.`;
  return {
    pane: best,
    color,
    state: paint(puzzle, state, best, color),
    reason,
    kind: 'rule',
    tip: around.length === 2 ? 'A pane touching two colours always has one glass left.' : undefined,
  };
}

// ---------------------------------------------------------------------------
// Making windows
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SHAPES: Record<PuzzleDifficulty, { size: number; panes: number }> = {
  easy: { size: 7, panes: 11 },
  medium: { size: 8, panes: 16 },
  hard: { size: 9, panes: 22 },
};

/** Grows `count` panes from random seeds until every cell belongs to one. */
function partition(size: number, count: number, random: () => number): number[][] {
  const paneOf = Array.from({ length: size }, () => Array.from({ length: size }, () => -1));
  const frontier: Array<Array<[number, number]>> = [];
  const sizes: number[] = [];
  for (let p = 0; p < count; p += 1) {
    let r: number;
    let c: number;
    do {
      r = Math.floor(random() * size);
      c = Math.floor(random() * size);
    } while (paneOf[r][c] !== -1);
    paneOf[r][c] = p;
    frontier.push([[r, c]]);
    sizes.push(1);
  }
  let left = size * size - count;
  while (left > 0) {
    // The smallest panes grow first, so they come out of similar size.
    const order = sizes.map((s, p) => [s + random() * 1.5, p] as const).sort((a, b) => a[0] - b[0]);
    let grew = false;
    for (const [, p] of order) {
      const options: Array<[number, number]> = [];
      for (const [r, c] of frontier[p]) {
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < size && nc < size && paneOf[nr][nc] === -1) options.push([nr, nc]);
        }
      }
      if (options.length === 0) continue;
      // Prefer cells that tuck in against the pane on more sides, so panes
      // grow as rounded pieces rather than thin strips.
      const score = ([r0, c0]: [number, number]) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => paneOf[r0 + dr]?.[c0 + dc] === p).length + random() * 1.2;
      options.sort((x, y) => score(y) - score(x));
      const [nr, nc] = options[0];
      paneOf[nr][nc] = p;
      frontier[p].push([nr, nc]);
      sizes[p] += 1;
      left -= 1;
      grew = true;
      break;
    }
    if (!grew) break;
  }
  return paneOf;
}

function touchingOf(paneOf: number[][], panes: number): number[][] {
  const sets = Array.from({ length: panes }, () => new Set<number>());
  const size = paneOf.length;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const a = paneOf[r][c];
      if (r + 1 < size && paneOf[r + 1][c] !== a) {
        sets[a].add(paneOf[r + 1][c]);
        sets[paneOf[r + 1][c]].add(a);
      }
      if (c + 1 < size && paneOf[r][c + 1] !== a) {
        sets[a].add(paneOf[r][c + 1]);
        sets[paneOf[r][c + 1]].add(a);
      }
    }
  }
  return sets.map(s => [...s].sort((x, y) => x - y));
}

/** Solutions of a window with `given` fixed, up to `limit` of them. */
export function solveGlass(touching: ReadonlyArray<ReadonlyArray<number>>, given: ReadonlyArray<GlassColor | null>, limit = 2): GlassColor[][] {
  const n = touching.length;
  const colors: Array<GlassColor | null> = [...given];
  const found: GlassColor[][] = [];
  // Most-constrained panes first.
  const order = Array.from({ length: n }, (_v, i) => i).sort((a, b) => touching[b].length - touching[a].length);
  const step = (k: number): void => {
    if (found.length >= limit) return;
    if (k === n) {
      found.push([...(colors as GlassColor[])]);
      return;
    }
    const p = order[k];
    if (given[p] !== null) {
      if (touching[p].some(q => colors[q] === given[p])) return;
      step(k + 1);
      return;
    }
    for (const c of GLASS_COLORS) {
      if (touching[p].some(q => colors[q] === c)) continue;
      colors[p] = c;
      step(k + 1);
      colors[p] = null;
      if (found.length >= limit) return;
    }
  };
  step(0);
  return found;
}

/**
 * A window for `id`, the same on every device. Panes are grown at random;
 * a window that cannot be done in three colours is thrown away; then
 * panes are coloured in, one at a time where a second answer still
 * exists, until only one answer is left. Harder windows have their spare
 * clues taken back out again.
 */
export function generateGlass(id: string, name: string, difficulty: PuzzleDifficulty, shape: { size: number; panes: number } = SHAPES[difficulty]): GlassPuzzle {
  const { size, panes } = shape;
  const random = mulberry32(hashId(id));
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const paneOf = partition(size, panes, random);
    if (paneOf.some(row => row.includes(-1))) continue;
    const touching = touchingOf(paneOf, panes);
    const blank: Array<GlassColor | null> = Array.from({ length: panes }, () => null);
    const any = solveGlass(touching, blank, 1);
    if (any.length === 0) continue;
    const solution = any[0];
    const given: Array<GlassColor | null> = [...blank];
    // Pin a pane wherever a second answer disagrees, until none is left.
    for (let guard = 0; guard < panes; guard += 1) {
      const answers = solveGlass(touching, given, 2);
      const other = answers.find(a => a.some((c, i) => c !== solution[i]));
      if (!other) break;
      const differing = solution.map((c, i) => (other[i] !== c && given[i] === null ? i : -1)).filter(i => i >= 0);
      const pick = differing[Math.floor(random() * differing.length)];
      given[pick] = solution[pick];
    }
    if (solveGlass(touching, given, 2).length !== 1) continue;
    // Then enough more that the window reads out pane by pane, never a
    // guess: pin whichever pane lets the most of the rest follow.
    for (let guard = 0; guard < panes && reasoned(touching, given) < panes; guard += 1) {
      let best = -1;
      let bestReach = -1;
      for (let p = 0; p < panes; p += 1) {
        if (given[p] !== null) continue;
        given[p] = solution[p];
        const reach = reasoned(touching, given);
        given[p] = null;
        if (reach > bestReach) {
          best = p;
          bestReach = reach;
        }
      }
      given[best] = solution[best];
    }
    // Medium and hard: take back every clue the reasoning does not need.
    if (difficulty !== 'easy') {
      for (const p of given.map((_c, i) => i).sort(() => random() - 0.5)) {
        if (given[p] === null) continue;
        const keep = given[p];
        given[p] = null;
        if (reasoned(touching, given) < panes) given[p] = keep;
      }
    }
    return { id, name, difficulty, rows: size, cols: size, paneOf, panes, touching, given, solution };
  }
  throw new Error(`Stained Glass ${id}: no window found.`);
}

/**
 * How many panes a player can fill from `given` by the game's one plain
 * step alone - a pane touching two colours takes the third - repeated
 * until it gives no more. A window whose every pane follows this way is
 * solved by reading it, never by guessing.
 */
export function reasoned(touching: ReadonlyArray<ReadonlyArray<number>>, given: ReadonlyArray<GlassColor | null>): number {
  const colors = [...given];
  for (let changed = true; changed; ) {
    changed = false;
    for (let p = 0; p < colors.length; p += 1) {
      if (colors[p] !== null) continue;
      const seen = new Set(touching[p].map(q => colors[q]).filter((c): c is GlassColor => c !== null));
      if (seen.size === 2) {
        colors[p] = ([0, 1, 2] as const).find(c => !seen.has(c))!;
        changed = true;
      }
    }
  }
  return colors.filter(c => c !== null).length;
}

// ---------------------------------------------------------------------------
// The windows
// ---------------------------------------------------------------------------

/**
 * A small window: four panes round a centre one, which touches them all.
 * Ruby and cobalt are set already; each step then has exactly one glass
 * that fits, so the lesson (and the help pictures) is the rule itself, three times.
 */
export const GLASS_LESSON_WINDOW: GlassPuzzle = {
  id: 'lesson-glass',
  name: 'Lesson',
  difficulty: 'easy',
  rows: 4,
  cols: 4,
  paneOf: [
    [0, 0, 1, 1],
    [0, 4, 4, 1],
    [2, 4, 4, 3],
    [2, 2, 3, 3],
  ],
  panes: 5,
  touching: [
    [1, 2, 4],
    [0, 3, 4],
    [0, 3, 4],
    [1, 2, 4],
    [0, 1, 2, 3],
  ],
  given: [0, 1, null, null, null],
  solution: [0, 1, 1, 0, 2],
};

// ---------------------------------------------------------------------------

/**
 * Each tier's windows, in the order they are dealt: name and size. The
 * easy ones begin small - five squares a side, seven panes - so the first
 * windows teach the one rule before the window grows; medium and hard grow
 * from there and give away fewer panes (see `generateGlass`).
 */
const WINDOWS: Record<PuzzleDifficulty, ReadonlyArray<readonly [name: string, size: number, panes: number]>> = {
  easy: [
    ['Morning Pane', 5, 7],
    ['Chapel Door', 5, 7],
    ['First Light', 5, 8],
    ['The Small Rose', 6, 9],
    ['Garden Window', 6, 9],
    ['Lantern Glass', 6, 10],
    ['Bell Tower', 6, 10],
    ['Dovecote', 7, 11],
    ['Orchard Light', 7, 11],
    ['The Porch', 7, 12],
    ['Saint Clare', 7, 12],
    ['Harbour Glass', 7, 12],
  ],
  medium: [
    ['The Rose Window', 7, 13],
    ['Vespers', 7, 13],
    ['The Cloister', 8, 15],
    ['Candlemas', 8, 15],
    ['Lady Chapel', 8, 16],
    ['Quiet Hour', 8, 16],
    ['The Nave', 8, 17],
    ['Ember Days', 8, 17],
    ['Old Abbey', 8, 17],
    ['Lammas', 8, 18],
  ],
  hard: [
    ['The Great Rose', 9, 20],
    ['Cathedral Nave', 9, 20],
    ['Evensong', 9, 21],
    ['The Chancel', 9, 21],
    ['Michaelmas', 9, 22],
    ['The Last Window', 9, 22],
    ['Compline', 9, 23],
    ['Matins', 9, 23],
  ],
};

const glassCache = new Map<string, GlassPuzzle>();

function curatedId(difficulty: PuzzleDifficulty, index: number): string {
  return `glass-${difficulty}-${String(index + 1).padStart(2, '0')}`;
}

/** The ids of a tier's windows, in deal order - without building them. */
export function glassIdsFor(difficulty: PuzzleDifficulty): ReadonlyArray<string> {
  return WINDOWS[difficulty].map((_w, i) => curatedId(difficulty, i));
}

/** Every curated window, as id, name and tier only - cheap to list (for
 * the Daily's pool, achievements, the aptitude chart) without building a
 * single one. */
export const GLASS_WINDOWS: ReadonlyArray<{ id: string; name: string; difficulty: PuzzleDifficulty }> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty =>
  WINDOWS[difficulty].map((w, i) => ({ id: curatedId(difficulty, i), name: w[0], difficulty })),
);

/** A curated window's name, from its id alone (null for any other id). */
export function glassCuratedInfo(id: string): { name: string; difficulty: PuzzleDifficulty } | null {
  const m = /^glass-(easy|medium|hard)-(\d+)$/.exec(id);
  if (!m) return null;
  const difficulty = m[1] as PuzzleDifficulty;
  const entry = WINDOWS[difficulty][Number(m[2]) - 1];
  return entry ? { name: entry[0], difficulty } : null;
}

/** A curated window, built the first time it is asked for and kept. */
export function getCuratedGlass(id: string): GlassPuzzle | undefined {
  const cached = glassCache.get(id);
  if (cached) return cached;
  const m = /^glass-(easy|medium|hard)-(\d+)$/.exec(id);
  if (!m) return undefined;
  const difficulty = m[1] as PuzzleDifficulty;
  const entry = WINDOWS[difficulty][Number(m[2]) - 1];
  if (!entry) return undefined;
  const puzzle = generateGlass(id, entry[0], difficulty, { size: entry[1], panes: entry[2] });
  glassCache.set(id, puzzle);
  return puzzle;
}

/** Any window by id, endless ones included (`name` comes from the caller,
 * which knows how endless boards are named). */
export function getGlassWindow(id: string, endless?: { name: string; tier: PuzzleDifficulty }): GlassPuzzle | undefined {
  const curated = getCuratedGlass(id);
  if (curated || !endless) return curated;
  const cached = glassCache.get(id);
  if (cached) return cached;
  const puzzle = generateGlass(id, endless.name, endless.tier);
  glassCache.set(id, puzzle);
  return puzzle;
}

/** The windows to try it out with: two of each tier. */
export const GLASS_TEST_WINDOWS: ReadonlyArray<GlassPuzzle> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty => [0, 1].map(i => getCuratedGlass(curatedId(difficulty, i))!));

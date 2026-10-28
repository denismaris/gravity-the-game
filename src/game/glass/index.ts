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

/** 0 ruby, 1 cobalt, 2 amber; 3 emerald, only in a leaf pane. */
export type GlassColor = 0 | 1 | 2 | 3;
export const GLASS_COLORS: ReadonlyArray<GlassColor> = [0, 1, 2];
export const GLASS_COLOR_NAMES = ['ruby', 'cobalt', 'amber', 'emerald'] as const;

/**
 * What a later window can bring besides the one rule: vines. Two leaf
 * panes joined by a vine, and of each such pair exactly one is the fourth
 * glass, emerald - no other pane ever is. Which one is the question: a
 * leaf pane that touches emerald, or ruby, cobalt and amber all three,
 * gives its partner away.
 */
export interface GlassRules {
  readonly vines?: ReadonlyArray<readonly [number, number]>;
  /** Counted glass: how many panes of each glass the window takes (by
   * colour, ruby first). The tray shows what is left of each, and a glass
   * whose count is spent can go nowhere else. */
  readonly counts?: ReadonlyArray<number>;
}

/** The window's outline: square, or a shaped window - an arched top, a
 * round rose, or a tall pointed lancet. Squares outside the shape are not
 * glass (`paneOf` is -1 there). */
export type GlassOutline = 'square' | 'arch' | 'rose' | 'lancet';

const WITH_EMERALD: ReadonlyArray<GlassColor> = [0, 1, 2, 3];

/** The leaf pane a pane is joined to by a vine, or -1. */
export function vineOf(rules: GlassRules, pane: number): number {
  for (const [a, b] of rules.vines ?? []) {
    if (a === pane) return b;
    if (b === pane) return a;
  }
  return -1;
}

/** The glasses a pane may take. */
export function glassesFor(rules: GlassRules, pane: number): ReadonlyArray<GlassColor> {
  return vineOf(rules, pane) >= 0 ? WITH_EMERALD : GLASS_COLORS;
}

/** The glasses in the tray: emerald only for a window with vines. */
export function trayOf(rules: GlassRules): ReadonlyArray<GlassColor> {
  return rules.vines?.length ? WITH_EMERALD : GLASS_COLORS;
}

export interface GlassPuzzle extends GlassRules {
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
  /** Absent for a square window. */
  readonly outline?: GlassOutline;
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

/** Colours (or, with `null`, clears) a pane. A given pane never changes,
 * and only a leaf pane takes emerald. */
export function paint(puzzle: GlassPuzzle, state: GlassState, pane: number, color: GlassColor | null): GlassState {
  if (puzzle.given[pane] !== null || state.colors[pane] === color) return state;
  if (color !== null && !glassesFor(puzzle, pane).includes(color)) return state;
  const colors = [...state.colors];
  colors[pane] = color;
  return { colors };
}

/** Pairs of touching panes wearing the same colour, and vined pairs both
 * emerald or both glazed otherwise, each once (a < b). */
export function clashes(puzzle: GlassPuzzle, state: GlassState): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let a = 0; a < puzzle.panes; a += 1) {
    const color = state.colors[a];
    if (color === null) continue;
    for (const b of puzzle.touching[a]) if (b > a && state.colors[b] === color) out.push([a, b]);
  }
  for (const [a, b] of puzzle.vines ?? []) {
    const ca = state.colors[a];
    const cb = state.colors[b];
    if (ca !== null && cb !== null && (ca === 3) === (cb === 3)) out.push(a < b ? [a, b] : [b, a]);
  }
  return out;
}

/** How many panes wear each glass now. */
export function placedCounts(colors: ReadonlyArray<GlassColor | null>): number[] {
  const out = [0, 0, 0, 0];
  for (const c of colors) if (c !== null) out[c] += 1;
  return out;
}

/** Counted glass: how many of `color` are still to place (null when the
 * window is not counted). Below zero when too many are in. */
export function glassLeft(rules: GlassRules, colors: ReadonlyArray<GlassColor | null>, color: GlassColor): number | null {
  if (!rules.counts) return null;
  return rules.counts[color] - placedCounts(colors)[color];
}

/** Panes still clear. */
export function panesLeft(state: GlassState): number {
  return state.colors.filter(c => c === null).length;
}

/** Every pane coloured and no two touching panes alike - any such window
 * counts, though there is only ever the one. */
export function isGlassSolved(puzzle: GlassPuzzle, state: GlassState): boolean {
  if (panesLeft(state) !== 0 || clashes(puzzle, state).length !== 0) return false;
  if (!puzzle.counts) return true;
  const placed = placedCounts(state.colors);
  return puzzle.counts.every((n, c) => placed[c] === n);
}

/** The pane at a cell. */
export function paneAt(puzzle: GlassPuzzle, row: number, col: number): number | null {
  if (row < 0 || col < 0 || row >= puzzle.rows || col >= puzzle.cols) return null;
  const pane = puzzle.paneOf[row][col];
  return pane < 0 ? null : pane;
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
  const step = nextReasonedStep(puzzle.touching, state.colors, puzzle);
  if (step) {
    const color = step.color;
    return { pane: step.pane, color, state: paint(puzzle, state, step.pane, color), reason: step.reason, kind: 'rule', tip: step.tip };
  }
  // Nothing follows by the plain steps: the pane the board says most about.
  let best = -1;
  let bestSeen = -1;
  for (let p = 0; p < puzzle.panes; p += 1) {
    if (state.colors[p] !== null) continue;
    const seen = new Set(puzzle.touching[p].map(q => state.colors[q]).filter(c => c !== null)).size;
    if (seen > bestSeen) {
      best = p;
      bestSeen = seen;
    }
  }
  if (best < 0) return null;
  const color = puzzle.solution[best];
  return { pane: best, color, state: paint(puzzle, state, best, color), reason: `Only ${GLASS_COLOR_NAMES[color]} lets the panes around it be finished.`, kind: 'rule' };
}

/** A list of colour names: "ruby", "ruby and cobalt", "ruby, cobalt and amber". */
function listed(colors: ReadonlyArray<GlassColor>): string {
  const names = colors.map(c => GLASS_COLOR_NAMES[c]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
}

/**
 * The glasses pane `p` can still take from `colors`, and why the others
 * are out: what it touches, and its vine. A leaf pane cannot be emerald if
 * its partner is, or if it touches emerald; it must be, if its partner is
 * already glazed otherwise.
 */
function optionsFor(touching: ReadonlyArray<ReadonlyArray<number>>, colors: ReadonlyArray<GlassColor | null>, rules: GlassRules, p: number): GlassColor[] {
  const seen = new Set(touching[p].map(q => colors[q]).filter((c): c is GlassColor => c !== null));
  let options = glassesFor(rules, p).filter(c => !seen.has(c));
  const partner = vineOf(rules, p);
  if (partner >= 0 && colors[partner] !== null) options = colors[partner] === 3 ? options.filter(c => c !== 3) : options.filter(c => c === 3);
  // Counted glass: a glass whose count is spent goes nowhere else.
  if (rules.counts) {
    const placed = placedCounts(colors);
    options = options.filter(c => placed[c] < rules.counts![c]);
  }
  return options;
}

/**
 * The next pane the plain steps settle, with the step in words: a pane
 * left one glass by what it touches; a leaf pane whose partner settles it;
 * or a leaf pane whose partner cannot be emerald, so it must be.
 */
function nextReasonedStep(touching: ReadonlyArray<ReadonlyArray<number>>, colors: ReadonlyArray<GlassColor | null>, rules: GlassRules): { pane: number; color: GlassColor; reason: string; tip?: string } | null {
  for (let p = 0; p < colors.length; p += 1) {
    if (colors[p] !== null) continue;
    const options = optionsFor(touching, colors, rules, p);
    if (options.length !== 1) continue;
    const color = options[0];
    const partner = vineOf(rules, p);
    const around = [...new Set(touching[p].map(q => colors[q]).filter((c): c is GlassColor => c !== null))];
    if (partner >= 0 && colors[partner] !== null) {
      return colors[partner] === 3
        ? { pane: p, color, reason: `Its vine partner is the emerald one, so this leaf pane is not. It touches ${listed(around)}, leaving ${GLASS_COLOR_NAMES[color]}.`, tip: 'Of two leaf panes on a vine, exactly one is emerald.' }
        : { pane: p, color, reason: 'Its vine partner is not emerald, so this one has to be.', tip: 'Of two leaf panes on a vine, exactly one is emerald.' };
    }
    // Counted glass: a glass ruled out by its count rather than by what
    // the pane touches is named as such.
    const spent = rules.counts ? glassesFor(rules, p).filter(c => c !== color && !around.includes(c) && placedCounts(colors)[c] >= rules.counts![c]) : [];
    if (spent.length > 0) {
      const touches = around.length ? `It touches ${listed(around)}, and ` : '';
      return { pane: p, color, reason: `${touches}every ${listed(spent)} piece is already in, so it can only be ${GLASS_COLOR_NAMES[color]}.`, tip: 'The tray shows how many of each glass are left.' };
    }
    return partner >= 0
      ? { pane: p, color, reason: `It touches ${listed(around)}, so even as a leaf pane it can only be ${GLASS_COLOR_NAMES[color]}.`, tip: 'A leaf pane needs three colours round it to be sure.' }
      : { pane: p, color, reason: `It touches ${listed(around)}, so it can only be ${GLASS_COLOR_NAMES[color]}.`, tip: 'A pane touching two colours always has one glass left.' };
  }
  // Counted glass: a glass with exactly as many pieces left as panes that
  // can still take it goes in every one of them.
  if (rules.counts) {
    const placed = placedCounts(colors);
    for (const c of [0, 1, 2, 3] as GlassColor[]) {
      const need = rules.counts[c] - placed[c];
      if (need <= 0) continue;
      const room: number[] = [];
      for (let p = 0; p < colors.length; p += 1) if (colors[p] === null && optionsFor(touching, colors, rules, p).includes(c)) room.push(p);
      if (room.length === need) {
        const name = GLASS_COLOR_NAMES[c];
        return {
          pane: room[0],
          color: c,
          reason: need === 1 ? `One ${name} piece is left, and this is the only pane that can still take it.` : `${need} ${name} pieces are left, and only ${need} panes can still take ${name}. This is one of them.`,
          tip: 'The tray shows how many of each glass are left.',
        };
      }
    }
  }
  // A leaf pane that cannot be emerald hands emerald to its partner.
  for (const [a, b] of rules.vines ?? []) {
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const) {
      if (colors[q] !== null || colors[p] !== null) continue;
      if (optionsFor(touching, colors, rules, p).includes(3)) continue;
      if (!optionsFor(touching, colors, rules, q).includes(3)) continue;
      const why = touching[p].some(x => colors[x] === 3) ? 'touches emerald' : 'cannot be emerald';
      return { pane: q, color: 3, reason: `Its vine partner ${why}, so this leaf pane is the emerald one.`, tip: 'Of two leaf panes on a vine, exactly one is emerald.' };
    }
  }
  return null;
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

/**
 * Which squares of a `size` grid are glass for an outline: all of them for
 * a square; an arched top, a round rose, or a narrow pointed lancet cut
 * from the square otherwise.
 */
export function outlineMask(size: number, outline: GlassOutline): boolean[][] {
  const mid = size / 2;
  return Array.from({ length: size }, (_r, r) =>
    Array.from({ length: size }, (_c, c) => {
      const x = c + 0.5;
      const y = r + 0.5;
      switch (outline) {
        case 'arch':
          return y >= mid || Math.hypot(x - mid, y - mid) <= mid + 0.05;
        case 'rose':
          return Math.hypot(x - mid, y - mid) <= mid + 0.05;
        case 'lancet': {
          // Two arcs meeting in a point at the top, over straight sides.
          const half = size * 0.36;
          if (Math.abs(x - mid) > half) return false;
          const spring = half * 1.6;
          if (y >= spring) return true;
          const reach = 2 * half;
          const fromLeft = Math.hypot(x - (mid - half), y - spring);
          const fromRight = Math.hypot(x - (mid + half), y - spring);
          return fromLeft <= reach && fromRight <= reach;
        }
        default:
          return true;
      }
    }),
  );
}

/** Grows `count` panes from random seeds until every glass cell belongs
 * to one (cells outside `inside` stay -1). */
function partition(size: number, count: number, random: () => number, inside?: boolean[][]): number[][] {
  const paneOf = Array.from({ length: size }, () => Array.from({ length: size }, () => -1));
  const blocked = (r: number, c: number) => !!inside && !inside[r][c];
  const frontier: Array<Array<[number, number]>> = [];
  const sizes: number[] = [];
  for (let p = 0; p < count; p += 1) {
    let r: number;
    let c: number;
    do {
      r = Math.floor(random() * size);
      c = Math.floor(random() * size);
    } while (paneOf[r][c] !== -1 || blocked(r, c));
    paneOf[r][c] = p;
    frontier.push([[r, c]]);
    sizes.push(1);
  }
  let left = (inside ? inside.flat().filter(Boolean).length : size * size) - count;
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
          if (nr >= 0 && nc >= 0 && nr < size && nc < size && paneOf[nr][nc] === -1 && !blocked(nr, nc)) options.push([nr, nc]);
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

export function touchingOf(paneOf: number[][], panes: number): number[][] {
  const sets = Array.from({ length: panes }, () => new Set<number>());
  const size = paneOf.length;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const a = paneOf[r][c];
      if (a < 0) continue;
      if (r + 1 < size && paneOf[r + 1][c] >= 0 && paneOf[r + 1][c] !== a) {
        sets[a].add(paneOf[r + 1][c]);
        sets[paneOf[r + 1][c]].add(a);
      }
      if (c + 1 < size && paneOf[r][c + 1] >= 0 && paneOf[r][c + 1] !== a) {
        sets[a].add(paneOf[r][c + 1]);
        sets[paneOf[r][c + 1]].add(a);
      }
    }
  }
  return sets.map(s => [...s].sort((x, y) => x - y));
}

/** Solutions of a window with `given` fixed, up to `limit` of them. */
export function solveGlass(
  touching: ReadonlyArray<ReadonlyArray<number>>,
  given: ReadonlyArray<GlassColor | null>,
  limit = 2,
  rules: GlassRules = {},
  /** Each pane's glasses in the order to try them (the generator shuffles a leaf pane's). */
  options?: ReadonlyArray<ReadonlyArray<GlassColor>>,
): GlassColor[][] {
  const n = touching.length;
  // A vined pair holds exactly one emerald: once one half is set, the
  // other must be the opposite way round.
  const colors: Array<GlassColor | null> = [...given];
  // Counted glass: never more of a glass than the window takes (and with
  // every pane filled, never fewer either).
  const used = placedCounts(given);
  const fits = (p: number, c: GlassColor) => {
    if (touching[p].some(q => colors[q] === c)) return false;
    const partner = vineOf(rules, p);
    return partner < 0 || colors[partner] === null || (colors[partner] === 3) !== (c === 3);
  };
  const room = (c: GlassColor) => !rules.counts || used[c] < rules.counts[c];
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
      if (!fits(p, given[p]!)) return;
      step(k + 1);
      return;
    }
    for (const c of options?.[p] ?? glassesFor(rules, p)) {
      if (!fits(p, c) || !room(c)) continue;
      colors[p] = c;
      used[c] += 1;
      step(k + 1);
      used[c] -= 1;
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
export function generateGlass(
  id: string,
  name: string,
  difficulty: PuzzleDifficulty,
  shape: { size: number; panes: number } = SHAPES[difficulty],
  extra: { vines?: number; counted?: boolean; outline?: GlassOutline } = {},
): GlassPuzzle {
  const { size } = shape;
  const outline = extra.outline && extra.outline !== 'square' ? extra.outline : undefined;
  const inside = outline ? outlineMask(size, outline) : undefined;
  // A shaped window has fewer squares of glass, and as many fewer panes.
  const panes = inside ? Math.max(5, Math.round((shape.panes * inside.flat().filter(Boolean).length) / (size * size))) : shape.panes;
  const random = mulberry32(hashId(id));
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const paneOf = partition(size, panes, random, inside);
    if (paneOf.some((row, r) => row.some((p, c) => p === -1 && (!inside || inside[r][c])))) continue;
    const touching = touchingOf(paneOf, panes);
    const vines = pickVines(paneOf, touching, extra.vines ?? 0, random);
    if (vines === null) continue;
    const vineRules: GlassRules = vines.length ? { vines } : {};
    const leaves = vines.flat();
    const blank: Array<GlassColor | null> = Array.from({ length: panes }, () => null);
    // A leaf pane tries its glasses in a shuffled order, so which half of a
    // vine is emerald is a toss-up, not always the first.
    const shuffled = leaves.length ? Array.from({ length: panes }, (_v, p) => (leaves.includes(p) ? [...WITH_EMERALD].sort(() => random() - 0.5) : GLASS_COLORS)) : undefined;
    const any = solveGlass(touching, blank, 1, vineRules, shuffled);
    if (any.length === 0) continue;
    const solution = any[0];
    // Counted glass: the tray's numbers are the finished window's.
    const rules: GlassRules = extra.counted ? { ...vineRules, counts: placedCounts(solution) } : vineRules;
    const solveGlass_ = (t: typeof touching, g: ReadonlyArray<GlassColor | null>, limit: number) => solveGlass(t, g, limit, rules);
    const reasoned_ = (t: typeof touching, g: ReadonlyArray<GlassColor | null>) => reasoned(t, g, rules);
    const given: Array<GlassColor | null> = [...blank];
    // Pin a pane wherever a second answer disagrees, until none is left.
    for (let guard = 0; guard < panes; guard += 1) {
      const answers = solveGlass_(touching, given, 2);
      const other = answers.find(a => a.some((c, i) => c !== solution[i]));
      if (!other) break;
      // Never a leaf pane: a given leaf would give its vine away.
      const differing = solution.map((c, i) => (other[i] !== c && given[i] === null && !leaves.includes(i) ? i : -1)).filter(i => i >= 0);
      if (differing.length === 0) break;
      const pick = differing[Math.floor(random() * differing.length)];
      given[pick] = solution[pick];
    }
    if (solveGlass_(touching, given, 2).length !== 1) continue;
    // Then enough more that the window reads out pane by pane, never a
    // guess: pin whichever pane lets the most of the rest follow.
    for (let guard = 0; guard < panes && reasoned_(touching, given) < panes; guard += 1) {
      let best = -1;
      let bestReach = -1;
      for (let p = 0; p < panes; p += 1) {
        if (given[p] !== null || leaves.includes(p)) continue;
        given[p] = solution[p];
        const reach = reasoned_(touching, given);
        given[p] = null;
        if (reach > bestReach) {
          best = p;
          bestReach = reach;
        }
      }
      if (best < 0) break;
      given[best] = solution[best];
    }
    if (reasoned_(touching, given) < panes) continue;
    // Medium and hard, and every counted window: take back every clue the
    // reasoning does not need (the counts carry some of what they said).
    if (difficulty !== 'easy' || rules.counts) {
      for (const p of given.map((_c, i) => i).sort(() => random() - 0.5)) {
        if (given[p] === null) continue;
        const keep = given[p];
        given[p] = null;
        if (reasoned_(touching, given) < panes) given[p] = keep;
      }
    }
    // Counted glass must be needed: the tray's numbers have to settle at
    // least two panes the plain rule cannot, or they are only decoration.
    if (rules.counts && reasoned(touching, given, vineRules) > panes - 2) continue;
    return { id, name, difficulty, rows: size, cols: size, paneOf, panes, touching, given, solution, ...rules, ...(outline ? { outline } : {}) };
  }
  throw new Error(`Stained Glass ${id}: no window found.`);
}

/**
 * `count` vines: pairs of leaf panes, each pane with four neighbours or
 * more (so it can be read from what it touches), never touching each
 * other, a little way apart, and each pane on one vine at most. Null when
 * the window has no such pairs.
 */
function pickVines(paneOf: number[][], touching: ReadonlyArray<ReadonlyArray<number>>, count: number, random: () => number): Array<readonly [number, number]> | null {
  if (count === 0) return [];
  const panes = touching.length;
  const centre = Array.from({ length: panes }, () => ({ r: 0, c: 0, n: 0 }));
  paneOf.forEach((row, r) =>
    row.forEach((p, c) => {
      if (p < 0) return;
      centre[p].r += r;
      centre[p].c += c;
      centre[p].n += 1;
    }),
  );
  const at = centre.map(m => ({ r: m.r / m.n, c: m.c / m.n }));
  const options: Array<readonly [number, number]> = [];
  for (let a = 0; a < panes; a += 1) {
    for (let b = a + 1; b < panes; b += 1) {
      if (touching[a].includes(b) || touching[a].length < 4 || touching[b].length < 4) continue;
      const d = Math.hypot(at[a].r - at[b].r, at[a].c - at[b].c);
      if (d >= 2 && d <= 4.5) options.push([a, b]);
    }
  }
  const out: Array<readonly [number, number]> = [];
  const used = new Set<number>();
  for (const pair of options.sort(() => random() - 0.5)) {
    if (out.length === count) break;
    if (used.has(pair[0]) || used.has(pair[1])) continue;
    out.push(pair);
    used.add(pair[0]);
    used.add(pair[1]);
  }
  return out.length === count ? out : null;
}

/**
 * How many panes a player can fill from `given` by the game's one plain
 * step alone - a pane touching two colours takes the third - repeated
 * until it gives no more. A window whose every pane follows this way is
 * solved by reading it, never by guessing.
 */
export function reasoned(touching: ReadonlyArray<ReadonlyArray<number>>, given: ReadonlyArray<GlassColor | null>, rules: GlassRules = {}): number {
  return reasonedColors(touching, given, rules).filter(c => c !== null).length;
}

/** The panes `reasoned` fills, and what with: the plain steps of
 * `nextReasonedStep`, repeated until they give no more. */
export function reasonedColors(touching: ReadonlyArray<ReadonlyArray<number>>, given: ReadonlyArray<GlassColor | null>, rules: GlassRules = {}): Array<GlassColor | null> {
  const colors = [...given];
  for (let step = nextReasonedStep(touching, colors, rules); step; step = nextReasonedStep(touching, colors, rules)) colors[step.pane] = step.color;
  return colors;
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

/**
 * Later windows that bring vines, each dealt after the plain window it
 * follows (by index): one vine at first, then more. Their ids are their
 * own, so no plain window's id ever moves.
 */
const RULED: Record<PuzzleDifficulty, ReadonlyArray<{ id: string; name: string; size: number; panes: number; after: number; vines?: number; counted?: boolean; outline?: GlassOutline }>> = {
  // Shaped windows only, early: the same one rule in a new outline.
  easy: [
    { id: 'glass-easy-s01', name: 'The Arched Door', size: 7, panes: 12, after: 4, outline: 'arch' },
    { id: 'glass-easy-s02', name: 'The Little Rose', size: 7, panes: 12, after: 8, outline: 'rose' },
  ],
  medium: [
    { id: 'glass-medium-c01', name: 'The Glazier\u2019s Count', size: 8, panes: 15, after: 1, counted: true },
    { id: 'glass-medium-s01', name: 'Chapel Arch', size: 8, panes: 16, after: 2, outline: 'arch' },
    { id: 'glass-medium-g01', name: 'The Green Man', size: 8, panes: 15, after: 3, vines: 1 },
    { id: 'glass-medium-c02', name: 'Rose of Tallies', size: 8, panes: 16, after: 5, counted: true, outline: 'rose' },
    { id: 'glass-medium-g02', name: 'Holly and Ivy', size: 8, panes: 16, after: 6, vines: 1 },
    { id: 'glass-medium-s02', name: 'The Lancet', size: 8, panes: 16, after: 7, outline: 'lancet' },
    { id: 'glass-medium-c03', name: 'Counted Arch', size: 8, panes: 17, after: 8, counted: true, outline: 'arch' },
    { id: 'glass-medium-g03', name: 'Laurel Window', size: 8, panes: 17, after: 9, vines: 2 },
  ],
  hard: [
    { id: 'glass-hard-c01', name: 'The Tally Rose', size: 9, panes: 21, after: 0, counted: true, outline: 'rose' },
    { id: 'glass-hard-g01', name: 'Ivy Tracery', size: 9, panes: 20, after: 1, vines: 2 },
    { id: 'glass-hard-s01', name: 'Great Lancet', size: 9, panes: 21, after: 2, outline: 'lancet' },
    { id: 'glass-hard-c02', name: 'The Reckoning', size: 9, panes: 21, after: 3, counted: true },
    { id: 'glass-hard-g02', name: 'The Climbing Rose', size: 9, panes: 21, after: 4, vines: 3 },
    { id: 'glass-hard-c03', name: 'Counted Lancet', size: 9, panes: 22, after: 6, counted: true, outline: 'lancet' },
  ],
};

interface WindowEntry {
  readonly id: string;
  readonly name: string;
  readonly difficulty: PuzzleDifficulty;
  readonly size: number;
  readonly panes: number;
  readonly vines?: number;
  readonly counted?: boolean;
  readonly outline?: GlassOutline;
}

/** A tier's windows in deal order, plain and ruled. */
const ENTRIES: Record<PuzzleDifficulty, ReadonlyArray<WindowEntry>> = (() => {
  const out = {} as Record<PuzzleDifficulty, WindowEntry[]>;
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    const list: WindowEntry[] = [];
    WINDOWS[difficulty].forEach(([name, size, panes], i) => {
      list.push({ id: curatedId(difficulty, i), name, difficulty, size, panes });
      for (const r of RULED[difficulty]) if (r.after === i) list.push({ id: r.id, name: r.name, difficulty, size: r.size, panes: r.panes, vines: r.vines, counted: r.counted, outline: r.outline });
    });
    out[difficulty] = list;
  }
  return out;
})();
const ENTRY_BY_ID = new Map<string, WindowEntry>((['easy', 'medium', 'hard'] as const).flatMap(d => ENTRIES[d].map(e => [e.id, e] as const)));

const glassCache = new Map<string, GlassPuzzle>();

function curatedId(difficulty: PuzzleDifficulty, index: number): string {
  return `glass-${difficulty}-${String(index + 1).padStart(2, '0')}`;
}

/** The ids of a tier's windows, in deal order - without building them. */
export function glassIdsFor(difficulty: PuzzleDifficulty): ReadonlyArray<string> {
  return ENTRIES[difficulty].map(e => e.id);
}

/** Every curated window, as id, name and tier only - cheap to list (for
 * the Daily's pool, achievements, the aptitude chart) without building a
 * single one. */
export const GLASS_WINDOWS: ReadonlyArray<{ id: string; name: string; difficulty: PuzzleDifficulty }> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty =>
  ENTRIES[difficulty].map(e => ({ id: e.id, name: e.name, difficulty })),
);

/** A curated window's name, from its id alone (null for any other id). */
export function glassCuratedInfo(id: string): { name: string; difficulty: PuzzleDifficulty } | null {
  const entry = ENTRY_BY_ID.get(id);
  return entry ? { name: entry.name, difficulty: entry.difficulty } : null;
}

/** A curated window, built the first time it is asked for and kept. */
export function getCuratedGlass(id: string): GlassPuzzle | undefined {
  const cached = glassCache.get(id);
  if (cached) return cached;
  const entry = ENTRY_BY_ID.get(id);
  if (!entry) return undefined;
  const puzzle = generateGlass(id, entry.name, entry.difficulty, { size: entry.size, panes: entry.panes }, { vines: entry.vines, counted: entry.counted, outline: entry.outline });
  glassCache.set(id, puzzle);
  return puzzle;
}

/**
 * What an endless window brings, chosen from its id: a vine, often; from
 * medium on, sometimes counted glass; and now and then a shaped window.
 * Each on a roll of its own, so adding one never moved another.
 */
function endlessRules(id: string, tier: PuzzleDifficulty): { vines?: number; counted?: boolean; outline?: GlassOutline } {
  const roll = mulberry32(hashId(`${id}:rules`))();
  const countRoll = mulberry32(hashId(`${id}:counted`))();
  const shapeRoll = mulberry32(hashId(`${id}:outline`))();
  const out: { vines?: number; counted?: boolean; outline?: GlassOutline } = {};
  if (tier === 'medium' && roll < 0.45) out.vines = 1;
  if (tier === 'hard' && roll < 0.6) out.vines = roll < 0.3 ? 2 : 1;
  // Counted glass and vines are not dealt together: one later rule a window.
  if (!out.vines && ((tier === 'medium' && countRoll < 0.4) || (tier === 'hard' && countRoll < 0.55))) out.counted = true;
  const shapes: ReadonlyArray<GlassOutline> = tier === 'easy' ? ['arch', 'rose'] : ['arch', 'rose', 'lancet'];
  if (shapeRoll < (tier === 'easy' ? 0.3 : 0.4)) out.outline = shapes[Math.floor((shapeRoll / (tier === 'easy' ? 0.3 : 0.4)) * shapes.length)];
  return out;
}

/** Any window by id, endless ones included (`name` comes from the caller,
 * which knows how endless boards are named). */
export function getGlassWindow(id: string, endless?: { name: string; tier: PuzzleDifficulty }): GlassPuzzle | undefined {
  const curated = getCuratedGlass(id);
  if (curated || !endless) return curated;
  const cached = glassCache.get(id);
  if (cached) return cached;
  const rules = endlessRules(id, endless.tier);
  const puzzle = generateGlass(id, endless.name, endless.tier, SHAPES[endless.tier], rules);
  glassCache.set(id, puzzle);
  return puzzle;
}

/** The windows to try it out with: two of each tier. */
export const GLASS_TEST_WINDOWS: ReadonlyArray<GlassPuzzle> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty => [0, 1].map(i => getCuratedGlass(curatedId(difficulty, i))!));

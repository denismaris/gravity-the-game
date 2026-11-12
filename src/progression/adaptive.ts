import type { GameKind } from '../game/journey';
import type { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { createDefaultBackend, StorageBackend } from '../storage';

/**
 * Adaptive play: the dealer learns, on this phone, how each player plays
 * and what they enjoy, and leans each set toward it.
 *
 * Three things, all worked out here and kept only on the phone (never sent
 * anywhere, never used for ads):
 *
 * 1. Skips. A game the player keeps swapping away is dealt less often, the
 *    pressure fading as they play other puzzles, so it comes back in time.
 * 2. Skill, per game: a rating moved by each solve - its stars (which
 *    already count the hints) and its time against the player's own usual
 *    time at that tier - and by quitting a board halfway.
 * 3. Enjoyment: a three-armed bandit (a bit easier, the same, a bit harder)
 *    rewarded by what the player does next - straight on to the next
 *    puzzle, finishing, coming back another day count for; quitting half
 *    way, swapping, restarting again and again count against. Over time it
 *    learns whether this player likes to be pushed or likes it gentle.
 *
 * The skill and the bandit's choice together shift a dealt slot by at most
 * one step, and only where the set's own guard rails allow it (see
 * `generateBatch`). Off, it deals exactly as before.
 */

export type Arm = 0 | 1 | 2; // a bit easier, the same, a bit harder
const ARM_SHIFT: Record<Arm, number> = { 0: -1, 1: 0, 2: 1 };

interface Beta {
  a: number;
  b: number;
}
type Arms = readonly [Beta, Beta, Beta];

export interface AdaptiveState {
  readonly v: 1;
  /** Per game: rating (0 is a typical player at medium) and solves counted. */
  readonly skill: Partial<Record<GameKind, { r: number; n: number }>>;
  /** Per game: skip pressure, fading. */
  readonly skips: Partial<Record<GameKind, number>>;
  /** The bandit's belief in each arm, over every game. */
  readonly arms: Arms;
  /** The same, per game: a player can love hard Lanterns and want Bridges
   * gentle. A game with little evidence leans on `arms`. */
  readonly gameArms: Partial<Record<GameKind, Arms>>;
  /** Per game, -1 (not keen) to 1 (a favourite): finished and played on
   * from, it rises; left and swapped away, it falls. */
  readonly likes: Partial<Record<GameKind, number>>;
  /** Recent solve times per `kind:tier`, newest last, for the player's own pace. */
  readonly times: Partial<Record<string, number[]>>;
  /** Which arm dealt each recent puzzle, awaiting how it went. */
  readonly dealt: Partial<Record<string, Arm>>;
  /** The arm and game of the last puzzle finished, for what follows it. */
  readonly lastArm: Arm | null;
  readonly lastKind: GameKind | null;
  readonly lastDay: string | null;
  /** This session's rough patch: quits and runs of restarts, eased by a
   * good solve. Two in a row and the next puzzle is dealt gentler. */
  readonly strain: number;
  /** Puzzles still to warm up on, after a long break: none pushed harder. */
  readonly warmUp: number;
}

const ARMS_PRIOR: Arms = [
  { a: 1.5, b: 1.5 },
  // "The same" starts trusted; the other two have to earn it.
  { a: 3, b: 1.5 },
  { a: 1.5, b: 1.5 },
];
const GAME_ARMS_PRIOR: Arms = [
  { a: 0.6, b: 0.6 },
  { a: 0.6, b: 0.6 },
  { a: 0.6, b: 0.6 },
];

export function freshAdaptive(): AdaptiveState {
  return {
    v: 1,
    skill: {},
    skips: {},
    arms: ARMS_PRIOR,
    gameArms: {},
    likes: {},
    times: {},
    dealt: {},
    lastArm: null,
    lastKind: null,
    lastDay: null,
    strain: 0,
    warmUp: 0,
  };
}

// ---------------------------------------------------------------------------
// Pure learning
// ---------------------------------------------------------------------------

const TIER_LEVEL: Record<PuzzleDifficulty, number> = { easy: -1, medium: 0, hard: 1 };
/** A rating this far above (or below) typical shifts a game a step harder
 * (or easier) on its own - once it has a few solves behind it. */
const SKILL_UP = 1;
const SKILL_DOWN = -0.6;
const SKILL_MIN_SOLVES = 4;
/** Older evidence fades, so the bandit follows a player who changes. */
const FORGET = 0.97;
/** How much a game's own taste counts against everything learned overall. */
const OVERALL_WEIGHT = 0.4;
/** Days away that call for a warm-up, and how many puzzles it lasts. */
const BREAK_DAYS = 5;
const WARM_UP_PUZZLES = 4;
/** A rough patch: this much strain eases the next puzzle. */
export const STRAIN_EASE = 2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function without<T>(record: Partial<Record<string, T>>, key: string): Partial<Record<string, T>> {
  const out = { ...record };
  delete out[key];
  return out;
}

function median(xs: ReadonlyArray<number>): number {
  const s = [...xs].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : 0;
}

/** How well a solve went, 0 (badly) to 1 (superbly). */
export function solveOutcome(stars: number, ms: number | null, usualMs: number | null, restarts: number): number {
  let o = 0.5 + 0.2 * (stars - 2);
  if (ms !== null && usualMs !== null && usualMs > 0) {
    const ratio = ms / usualMs;
    if (ratio < 0.7) o += 0.15;
    else if (ratio > 1.6) o -= 0.15;
  }
  o -= 0.08 * Math.min(restarts, 3);
  return clamp(o, 0.05, 0.95);
}

/** How likely a player at rating `r` is to do well at `tier`. */
function expectedAt(r: number, tier: PuzzleDifficulty): number {
  return 1 / (1 + Math.exp(-(r - TIER_LEVEL[tier]) * 1.2));
}

/** The rating after one outcome at `tier` - a chess-style update against
 * the tier's own difficulty, fast at first and steadier with experience. */
export function rate(skill: { r: number; n: number } | undefined, tier: PuzzleDifficulty, outcome: number): { r: number; n: number } {
  const r = skill?.r ?? 0;
  const n = skill?.n ?? 0;
  const k = Math.max(0.15, 0.6 / Math.sqrt(n + 1));
  return { r: clamp(r + k * (outcome - expectedAt(r, tier)) * 2, -3, 3), n: n + 1 };
}

/**
 * How much a finished puzzle was enjoyed, 0 to 1, by "flow": a solve that
 * was a real match for the player is the best kind; one far below them
 * (breezed through, nothing to it) is a little dull; one they fought
 * through, restarting again and again, is not much fun either.
 */
export function enjoyment(expected: number, outcome: number, restarts: number): number {
  let joy = 0.7;
  if (expected > 0.9 && outcome > 0.85) joy = 0.5; // too easy for them
  else if (expected < 0.85 && outcome >= 0.6) joy = 0.88; // a real match, met
  else if (outcome >= 0.75) joy = 0.78;
  joy -= 0.12 * Math.min(restarts, 3);
  return clamp(joy, 0.1, 0.92);
}

function rewardArms(arms: Arms, arm: Arm, value: number): Arms {
  const next = arms.map(b => ({ a: Math.max(0.5, b.a * FORGET), b: Math.max(0.5, b.b * FORGET) })) as unknown as [Beta, Beta, Beta];
  next[arm] = { a: next[arm].a + value, b: next[arm].b + (1 - value) };
  return next;
}

/** Credit (or blame) to an arm, overall and for the game it dealt. */
function reward(state: AdaptiveState, kind: GameKind | null, arm: Arm, value: number): Pick<AdaptiveState, 'arms' | 'gameArms'> {
  const arms = rewardArms(state.arms, arm, value);
  if (!kind) return { arms, gameArms: state.gameArms };
  const own = state.gameArms[kind] ?? GAME_ARMS_PRIOR;
  return { arms, gameArms: { ...state.gameArms, [kind]: rewardArms(own, arm, value) } };
}

function like(state: AdaptiveState, kind: GameKind, by: number): AdaptiveState['likes'] {
  return { ...state.likes, [kind]: clamp((state.likes[kind] ?? 0) + by, -1, 1) };
}

/** What a game's taste is believed to be: its own evidence over everything
 * learned overall, so a new game starts from the player's general taste. */
export function armsFor(state: AdaptiveState, kind: GameKind): Arms {
  const own = state.gameArms[kind] ?? GAME_ARMS_PRIOR;
  return own.map((b, i) => ({ a: b.a + state.arms[i].a * OVERALL_WEIGHT, b: b.b + state.arms[i].b * OVERALL_WEIGHT })) as unknown as Arms;
}

/** A sample of each arm's belief (Thompson sampling), from `rng`. */
export function chooseArm(arms: Arms, rng: () => number): Arm {
  let best: Arm = 1;
  let bestDraw = -Infinity;
  ([0, 1, 2] as Arm[]).forEach(arm => {
    const { a, b } = arms[arm];
    const mean = a / (a + b);
    const spread = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
    const draw = mean + (rng() * 2 - 1) * spread * 1.7;
    if (draw > bestDraw) {
      bestDraw = draw;
      best = arm;
    }
  });
  return best;
}

/** How much a game is held back by being skipped: 1 (not at all) down to a quarter. */
export function skipWeight(state: AdaptiveState, kind: GameKind): number {
  return Math.max(0.25, 1 / (1 + 0.6 * (state.skips[kind] ?? 0)));
}

/** How often a game comes round, all told: held back by skips, brought on
 * a little for a favourite (never more than a fifth either way by liking,
 * so the rotation keeps its variety). */
export function dealWeight(state: AdaptiveState, kind: GameKind): number {
  return skipWeight(state, kind) * (1 + 0.2 * (state.likes[kind] ?? 0));
}

/** The step (-1, 0 or +1) this player's skill alone asks for in `kind`. */
export function skillShift(state: AdaptiveState, kind: GameKind): number {
  const s = state.skill[kind];
  if (!s || s.n < SKILL_MIN_SOLVES) return 0;
  if (s.r > SKILL_UP) return 1;
  if (s.r < SKILL_DOWN) return -1;
  return 0;
}

export function withSolve(
  state: AdaptiveState,
  solve: { puzzleId: string; kind: GameKind; tier: PuzzleDifficulty; stars: number; ms: number | null; restarts: number },
): AdaptiveState {
  const key = `${solve.kind}:${solve.tier}`;
  const past = state.times[key] ?? [];
  const usual = past.length >= 2 ? median(past) : null;
  const outcome = solveOutcome(solve.stars, solve.ms, usual, solve.restarts);
  const expected = expectedAt(state.skill[solve.kind]?.r ?? 0, solve.tier);
  const skill = { ...state.skill, [solve.kind]: rate(state.skill[solve.kind], solve.tier, outcome) };
  // Skips fade as the player gets on with other games.
  const skips: Partial<Record<GameKind, number>> = {};
  for (const [kind, value] of Object.entries(state.skips) as Array<[GameKind, number]>) if (value * 0.9 > 0.05) skips[kind] = value * 0.9;
  const times = solve.ms !== null && solve.ms > 0 ? { ...state.times, [key]: [...past, solve.ms].slice(-9) } : state.times;
  const arm = state.dealt[solve.puzzleId];
  const dealt = without(state.dealt, solve.puzzleId);
  // A run of restarts is strain; a clean solve takes some away.
  const strain = solve.restarts >= 2 ? state.strain + 1 : solve.stars >= 2 ? Math.max(0, state.strain - 1) : state.strain;
  const learned = arm === undefined ? { arms: state.arms, gameArms: state.gameArms } : reward(state, solve.kind, arm, enjoyment(expected, outcome, solve.restarts));
  return { ...state, ...learned, skill, skips, times, dealt, strain, warmUp: Math.max(0, state.warmUp - 1), lastArm: arm ?? state.lastArm, lastKind: solve.kind };
}

/** Straight on to the next puzzle: the last one was enjoyed, and its game
 * is liked a little more. */
export function withContinued(state: AdaptiveState): AdaptiveState {
  // Liking counts however the puzzle was dealt; the arm only if it chose it.
  const likes = state.lastKind ? like(state, state.lastKind, 0.08) : state.likes;
  if (state.lastArm === null) return { ...state, likes };
  return { ...state, ...reward(state, state.lastKind, state.lastArm, 0.85), likes };
}

/** Left a board unfinished. A peek (under twenty seconds) says little; a
 * real try abandoned says it was too much, or not fun. */
export function withAbandon(state: AdaptiveState, abandon: { puzzleId: string; kind: GameKind; tier: PuzzleDifficulty; ms: number | null }): AdaptiveState {
  if (abandon.ms === null || abandon.ms < 20000) return state;
  const skill = { ...state.skill, [abandon.kind]: rate(state.skill[abandon.kind], abandon.tier, 0.15) };
  const arm = state.dealt[abandon.puzzleId];
  const learned = arm === undefined ? { arms: state.arms, gameArms: state.gameArms } : reward(state, abandon.kind, arm, 0.1);
  return { ...state, ...learned, skill, likes: like(state, abandon.kind, -0.06), strain: state.strain + 1 };
}

/** Swapped a puzzle away: its game is held back for a while, and the
 * choice that dealt it counted against. */
export function withSkip(state: AdaptiveState, skip: { puzzleId: string; kind: GameKind }): AdaptiveState {
  const skips = { ...state.skips, [skip.kind]: (state.skips[skip.kind] ?? 0) + 1 };
  const arm = state.dealt[skip.puzzleId];
  const dealt = without(state.dealt, skip.puzzleId);
  const learned = arm === undefined ? { arms: state.arms, gameArms: state.gameArms } : reward(state, skip.kind, arm, 0.2);
  return { ...state, ...learned, skips, dealt, likes: like(state, skip.kind, -0.1) };
}

/**
 * Opened the app on a new day: whatever was last dealt kept them coming,
 * a new session starts with no strain, and after a long break the first
 * few puzzles are a warm-up.
 */
export function withNewDay(state: AdaptiveState, day: string): AdaptiveState {
  if (state.lastDay === day) return { ...state, strain: 0 };
  const learned = state.lastDay !== null && state.lastArm !== null ? reward(state, state.lastKind, state.lastArm, 0.8) : { arms: state.arms, gameArms: state.gameArms };
  const away = state.lastDay === null ? 0 : daysBetween(state.lastDay, day);
  return { ...state, ...learned, lastDay: day, strain: 0, warmUp: away >= BREAK_DAYS ? WARM_UP_PUZZLES : state.warmUp };
}

export function withDealt(state: AdaptiveState, puzzleId: string, arm: Arm): AdaptiveState {
  const entries = Object.entries({ ...state.dealt, [puzzleId]: arm });
  return { ...state, dealt: Object.fromEntries(entries.slice(-24)) as Partial<Record<string, Arm>> };
}

/** A rough patch is being eased: the strain that asked for it is spent. */
export function withEased(state: AdaptiveState): AdaptiveState {
  return { ...state, strain: 0 };
}

/**
 * The adjustment for one slot: the step skill asks for plus the bandit's
 * arm, at most one step either way. Never harder while a game is still
 * being learned, or while warming up after a break; easier is always
 * allowed.
 */
export function slotShift(state: AdaptiveState, kind: GameKind, arm: Arm, learning: boolean): number {
  const shift = clamp(skillShift(state, kind) + ARM_SHIFT[arm], -1, 1);
  return learning || state.warmUp > 0 ? Math.min(0, shift) : shift;
}

// ---------------------------------------------------------------------------
// On this phone
// ---------------------------------------------------------------------------

const KEY = 'tessera.adaptive.v1';
let state: AdaptiveState = freshAdaptive();
let enabled = true;
let backend: StorageBackend | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
/** Restarts on the board now open (reset as each opens). */
let restartsNow = 0;

function parse(raw: string | null): AdaptiveState {
  if (!raw) return freshAdaptive();
  try {
    const v = JSON.parse(raw) as AdaptiveState;
    // Fields added since are filled in from a fresh state.
    if (v && v.v === 1 && Array.isArray(v.arms) && v.arms.length === 3) return { ...freshAdaptive(), ...v, strain: 0 };
  } catch {
    // unreadable: start over
  }
  return freshAdaptive();
}

export async function loadAdaptive(storage: StorageBackend = createDefaultBackend(), today: string = new Date().toISOString().slice(0, 10)): Promise<void> {
  backend = storage;
  try {
    state = parse(await storage.getItem(KEY));
  } catch {
    state = freshAdaptive();
  }
  update(withNewDay(state, today));
}

function update(next: AdaptiveState): void {
  if (next === state) return;
  state = next;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    (backend ?? createDefaultBackend()).setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, 400);
}

export function adaptiveState(): AdaptiveState {
  return state;
}

/** Mirrors the Settings switch ("Adapt difficulty to me"). */
export function setAdaptiveEnabled(on: boolean): void {
  enabled = on;
}

export function adaptiveEnabled(): boolean {
  return enabled;
}

/** Forgets everything learned (a progress reset). */
export function resetAdaptive(): void {
  update(freshAdaptive());
}

export function noteOpened(): void {
  restartsNow = 0;
}

export function noteRestart(): void {
  restartsNow += 1;
}

export function noteSolved(solve: { puzzleId: string; kind: GameKind; tier: PuzzleDifficulty; stars: number; ms: number | null }): void {
  update(withSolve(state, { ...solve, restarts: restartsNow }));
  restartsNow = 0;
}

/** Whether this session's rough patch calls for the next puzzle to be
 * dealt gentler (only with the switch on). */
export function needsEasing(): boolean {
  return enabled && state.strain >= STRAIN_EASE;
}

export function noteEased(): void {
  update(withEased(state));
}

export function noteContinued(): void {
  update(withContinued(state));
}

export function noteAbandoned(abandon: { puzzleId: string; kind: GameKind; tier: PuzzleDifficulty; ms: number | null }): void {
  update(withAbandon(state, abandon));
}

export function noteSkipped(skip: { puzzleId: string; kind: GameKind }): void {
  update(withSkip(state, skip));
}

/**
 * The dealer's view of what has been learned, for `generateBatch`: how much
 * to hold each game back and - when the switch is on - which step to take
 * for each slot (`choose`), then which puzzle that dealt (`record`), so how
 * it goes can be learned.
 */
export interface Dealer {
  readonly skipWeight: (kind: GameKind) => number;
  readonly choose: ((kind: GameKind, learning: boolean, rng: () => number) => { shift: number; arm: Arm }) | null;
  readonly record: (puzzleId: string, arm: Arm) => void;
}

/** Deals as before: no skips held, no steps. */
export const NEUTRAL_DEALER: Dealer = { skipWeight: () => 1, choose: null, record: () => {} };

/** A dealer over a given state, recording into `onRecord` - for tests and
 * simulations, which run many players without touching the phone's own. */
export function dealerFor(get: () => AdaptiveState, set: (next: AdaptiveState) => void, on = true): Dealer {
  return {
    skipWeight: kind => dealWeight(get(), kind),
    choose: on
      ? (kind, learning, rng) => {
          const arm = chooseArm(armsFor(get(), kind), rng);
          return { shift: slotShift(get(), kind, arm, learning), arm };
        }
      : null,
    record: (puzzleId, arm) => set(withDealt(get(), puzzleId, arm)),
  };
}

export function liveDealer(): Dealer {
  return dealerFor(() => state, update, enabled);
}

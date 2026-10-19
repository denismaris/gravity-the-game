import { getGravityLevelsForTier, getLevelById } from '../game/levels';
import { mechanicsOf } from '../game/tutorials';
import { getMirrorMazesByDifficulty } from '../game/mirror';
import { lilyIdsFor } from '../game/lilypads';
import { vaneIdsFor } from '../game/vanes';
import { getBinairoByDifficulty } from '../game/binairo';
import { getArukoneByDifficulty } from '../game/arukone';
import { glassIdsFor } from '../game/glass';
import { getLightsOutByDifficulty } from '../game/lightsout';
import { getBloomByDifficulty } from '../game/bloom';
import { getMosaicByDifficulty } from '../game/mosaic';
import { getBridgesByDifficulty } from '../game/bridges';
import { getAdjacentByDifficulty } from '../game/adjacent';
import { GameKind, getDailyEntry, ROTATION, puzzleKindOf } from '../game/journey';
import { endlessId, parseEndlessId } from '../game/endlessId';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { PlayerProgress } from './playerProgress';
import { GOLDEN_EVERY } from './coins';

/**
 * The randomized level-batch progression: instead of one fixed interleaved
 * Journey, "Level N" is a batch of puzzles pulled from randomly selected
 * games, at a difficulty mix that ramps gently from level 1 up to a fixed,
 * permanent plateau - it never keeps escalating, by design (see
 * `TIER_CURVE` below). A batch's own composition is fixed the moment it's
 * generated (stored in `PlayerProgress.currentBatch`) - regenerating it on
 * every app open would be confusing (the puzzles you were mid-batch on
 * would keep changing), so `generateBatch` is called exactly once per
 * level, right when the previous batch completes (or on first launch).
 */

export interface BatchPuzzleRef {
  readonly kind: GameKind;
  readonly puzzleId: string;
  /** The deliberately hard one, planted on a fixed rhythm (see
   * the per-game difficulty arc below) and announced everywhere it shows up rather than
   * sprung on the player. Absent rather than `false` on ordinary slots,
   * so a batch saved before this existed reads back correctly as "no
   * challenge" with no migration. */
  readonly challenge?: boolean;
  /** A golden puzzle: triple coins on its first solve (see `coins.ts`).
   * Absent rather than `false`, like `challenge`. */
  readonly golden?: boolean;
  /** The hardest kind of challenge, from level 15 on: one of the toughest
   * boards in its game's hard collection. Always also a `challenge`. */
  readonly extreme?: boolean;
}

export interface BatchState {
  readonly levelNumber: number;
  /** Fixed once generated - never reordered or regenerated mid-batch. */
  readonly puzzles: ReadonlyArray<BatchPuzzleRef>;
  /** Subset of `puzzles`' own ids, in the order they were completed. */
  readonly completedPuzzleIds: ReadonlyArray<string>;
}

interface TierWeights {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
}

/**
 * The tier curve, levels 1..40 explicit, everything from 41 on permanently
 * pinned to the last row - "level 41 and level 5000 feel identical" is the
 * literal design goal, not an approximation. Batch size climbs alongside
 * the tier mix over the same bands. `hard` never exceeds 35% even at the
 * plateau, and no row anywhere in this table (or beyond it) ever reaches a
 * fourth tier - Gravity's own `expert` levels are simply never queried by
 * this generator (see `poolForKindAndTier`), which is the actual ceiling:
 * not a number that approaches "too hard", a tier that's structurally
 * unreachable regardless of how high `levelNumber` climbs. Ramps faster
 * than this table's first draft (medium arrives by level 4, hard by level
 * 16, the plateau by level 26, instead of 6/31/51) and settles at a
 * genuinely harder permanent mix (35% hard, not 25%) - tuned after
 * feedback that the original curve felt too gentle for too long.
 */
interface TierBand {
  readonly maxLevel: number; // inclusive; the last band's maxLevel is ignored (it's the permanent plateau)
  readonly batchSize: number;
  readonly weights: TierWeights;
}

const TIER_CURVE: ReadonlyArray<TierBand> = [
  { maxLevel: 2, batchSize: 4, weights: { easy: 1.0, medium: 0, hard: 0 } },
  { maxLevel: 5, batchSize: 4, weights: { easy: 0.55, medium: 0.45, hard: 0 } },
  { maxLevel: 9, batchSize: 6, weights: { easy: 0.3, medium: 0.55, hard: 0.15 } },
  { maxLevel: 18, batchSize: 6, weights: { easy: 0.12, medium: 0.53, hard: 0.35 } },
  { maxLevel: Infinity, batchSize: 8, weights: { easy: 0.05, medium: 0.45, hard: 0.5 } }, // the permanent plateau
];

/** The first level number whose band can deal a hard-tier puzzle - read
 * off `TIER_CURVE` rather than written down twice, so re-tuning the table
 * cannot leave this behind. */
/**
 * The difficulty arc - per game: every game ramps on its own, by how many
 * of *that game's* puzzles the player has solved, so a game met for the
 * first time late on still starts gently.
 *  1. its first 3 puzzles: easy (its easiest boards, in order);
 *  2. the next 3: easy, medium, easy;
 *  3. the next 9: easy, medium, then a signposted hard challenge;
 *  4. after that: random, extreme challenges included - within guard
 *     rails that hold across everything the player plays, so it never
 *     turns stressful: every level has an easy puzzle, two challenges never
 *     come back to back, an extreme is always followed by an easy one, and
 *     a level holds at most one extreme.
 * Hard and extreme puzzles only ever come as signposted challenges.
 */
export const GAME_EASY_ONLY = 3;
export const GAME_EASY_MEDIUM = 6;
export const GAME_RHYTHM = 15;
/** No hard puzzle before this level for anyone: a game needs six solved
 * boards before it can deal one, so this is a floor, not the rule. Kept
 * short now that games arrive quickly - with twelve games taking turns, a
 * longer ramp kept the first hundred puzzles at one flat difficulty. */
export const HARD_TIER_FIRST_LEVEL = 8;

/** Phase 4's draw for one slot, before the guard rails. */
const RANDOM_WEIGHTS: ReadonlyArray<readonly [Slot, number]> = [
  ['easy', 0.3],
  ['medium', 0.35],
  ['hard', 0.25],
  ['extreme', 0.1],
];

type Slot = 'easy' | 'medium' | 'hard' | 'extreme';

/** A game's first puzzles for a player are always its easiest boards, in
 * order (phase 1 of the arc above). */
export const NEW_GAME_PUZZLES = GAME_EASY_ONLY;

/**
 * Variety, dealt fairly: each slot goes to the game the player has gone
 * longest without, picked among the few longest-waiting so it never feels
 * mechanical - so every game comes round about equally often, and never
 * the same game twice running. A game of the same kind of play as the one
 * just dealt waits a little longer, so a logic grid is followed by a
 * picture or a moving piece, not by another logic grid.
 */
const HISTORY = 40;
const PICK_AMONG = 3;
/** How much longer a game of the same family as the last one waits. */
const SAME_FAMILY_DELAY = 0.5;

/** Puzzles of a game after which it is settled into the rotation, and
 * how far ahead in the queue it stands until then. */
const SETTLED = 10;
const SETTLING_HEAD_START = 3;

/** The three kinds of play, for alternating them. */
const FAMILY: Readonly<Record<GameKind, 'logic' | 'shape' | 'motion'>> = {
  binairo: 'logic',
  glass: 'logic',
  bridges: 'logic',
  vanes: 'logic',
  mosaic: 'shape',
  bloom: 'shape',
  mirror: 'shape',
  arukone: 'shape',
  gravity: 'motion',
  lilypads: 'motion',
  adjacent: 'motion',
  lightsout: 'motion',
};

/**
 * Games arrive one at a time. A new player starts with Lanterns alone (the
 * gentlest to pick up, and the prettiest first impression), and
 * the next game in this order (from the simplest to pick up to the most
 * involved, alternating kinds of play) arrives only once the newest one
 * has `INTRO_SOLVES` puzzles solved - long enough to understand a game
 * before meeting another. While a game is being learned it takes most of
 * each set; the games before it keep turning up between its puzzles. Its
 * arrival is a small event: dealt at once, opening on its lesson. A
 * Daily or Weekly Grand never brings a game early: both are dealt from the
 * games the player already has until every game has arrived.
 */
export const INTRO_ORDER: ReadonlyArray<GameKind> = [
  'lightsout',
  'glass',
  'adjacent',
  'mosaic',
  'binairo',
  'lilypads',
  'gravity',
  'bridges',
  'mirror',
  'bloom',
  'vanes',
  'arukone',
];
/**
 * Puzzles of the newest game to solve before the next one arrives, by how
 * many games the player already has: quick at first, so a newcomer meets
 * several games in their first sittings rather than one game for an hour,
 * and a little longer as the list grows and each new game has more company.
 * With the game being learned dealt every other puzzle, a player has met
 * about six games by level 10 and all twelve by about level 22; and a game
 * just past its introduction keeps coming round a little more often until
 * it has ten puzzles behind it (see `SETTLED`).
 */
const INTRO_SOLVES_BY_POSITION: ReadonlyArray<number> = [4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5];

/** Solves of the game at `position` in the order that bring the next one. */
export function introSolvesAt(position: number): number {
  return INTRO_SOLVES_BY_POSITION[Math.min(position, INTRO_SOLVES_BY_POSITION.length - 1)];
}

/** The longest any game waits for the next - for copy that needs one
 * number. */
export const INTRO_SOLVES = INTRO_SOLVES_BY_POSITION[INTRO_SOLVES_BY_POSITION.length - 1];

const NOTHING_PENDING: ReadonlyMap<GameKind, number> = new Map();

/** The schedule, as this player stands on it: each game's solves (plus
 * any `pending` - dealt into the set being built, not yet solved). */
function schedule(progress: PlayerProgress, pending: ReadonlyMap<GameKind, number>) {
  const solved = solvedPerGame(progress);
  const order = INTRO_ORDER.filter(kind => !progress.retired.includes(kind));
  const count = (kind: GameKind) => (solved.get(kind) ?? 0) + (pending.get(kind) ?? 0);
  // The frontier: the first game in the order not yet learned.
  const frontier = order.findIndex((kind, i) => count(kind) < introSolvesAt(i));
  return { order, count, frontier };
}

/**
 * The games this player has: every game up to and including the one being
 * learned. Retired games are never counted or dealt.
 */
export function unlockedGames(progress: PlayerProgress, pending: ReadonlyMap<GameKind, number> = NOTHING_PENDING): GameKind[] {
  const { order, frontier } = schedule(progress, pending);
  if (frontier === -1) return order;
  return order.slice(0, frontier + 1);
}

/** The game being learned - the newest arrival, until it has its
 * `introSolvesAt` puzzles - which the dealer puts in the spotlight. */
function gameBeingLearned(progress: PlayerProgress, pending: ReadonlyMap<GameKind, number>): GameKind | null {
  const { order, frontier } = schedule(progress, pending);
  return frontier === -1 ? null : order[frontier];
}

/** The games this player has solved at least one puzzle of - so Home can
 * mark a game making its debut in the current set as new. */
export function gamesPlayed(progress: PlayerProgress): ReadonlySet<GameKind> {
  return new Set(solvedPerGame(progress).keys());
}

/**
 * The game still to come, for Home's progress bar: which game it is, the
 * game being learned that gates it, and how far through that one the
 * player is. Null once every game has arrived.
 */
export function nextGameToArrive(progress: PlayerProgress): { kind: GameKind; gate: GameKind; done: number; need: number; inPuzzles: number } | null {
  const { order, count } = schedule(progress, NOTHING_PENDING);
  const unlocked = new Set(unlockedGames(progress));
  const at = order.findIndex(kind => !unlocked.has(kind));
  if (at <= 0) return null;
  const gate = order[at - 1];
  const need = introSolvesAt(at - 1);
  const done = Math.min(need, count(gate));
  return { kind: order[at], gate, done, need, inPuzzles: Math.max(1, need - done) };
}

function tierBandForLevel(levelNumber: number): TierBand {
  return TIER_CURVE.find(band => levelNumber <= band.maxLevel) ?? TIER_CURVE[TIER_CURVE.length - 1];
}



/** Whether the puzzle at continuous index `puzzleIndex` (0-based) is the
 * challenge. Hard tier has to actually be reachable at this level for the
 * answer to be yes, so a new player's opening levels stay a clean ramp
 * with no spikes at all. */
/** What a game deals next to this player, from how many of its puzzles
 * they have solved - phases 1 to 3 of the arc; phase 4 returns null (the
 * caller draws it at random). */
function rampSlot(played: number): Slot | null {
  if (played < GAME_EASY_ONLY) return 'easy';
  if (played < GAME_EASY_MEDIUM) return played % 2 === 0 ? 'medium' : 'easy';
  if (played < GAME_RHYTHM) return ['easy', 'medium', 'hard'][(played - GAME_EASY_MEDIUM) % 3] as Slot;
  return null;
}

/** The guard rails, applied to whatever a slot would deal. */
function calm(wanted: Slot | null, context: { last: Slot | null; hadEasy: boolean; hadExtreme: boolean; lastSlot: boolean }, rng: () => number): Slot {
  const allowed = (tier: Slot) => {
    if (context.last === 'extreme') return tier === 'easy';
    if (context.last === 'hard' && (tier === 'hard' || tier === 'extreme')) return false;
    if (tier === 'extreme' && context.hadExtreme) return false;
    if (context.lastSlot && !context.hadEasy) return tier === 'easy';
    return true;
  };
  if (wanted !== null) {
    if (allowed(wanted)) return wanted;
    // A challenge held back by the rails becomes a medium, or an easy where
    // only an easy will do.
    return allowed('medium') ? 'medium' : 'easy';
  }
  return weightedPick(RANDOM_WEIGHTS.filter(([tier]) => allowed(tier)), rng);
}

function slotOf(ref: BatchPuzzleRef | undefined): Slot | null {
  if (!ref) return null;
  if (ref.extreme) return 'extreme';
  if (ref.challenge) return 'hard';
  return null;
}

/** How many puzzles of each game the player has solved. */
function solvedPerGame(progress: PlayerProgress): ReadonlyMap<GameKind, number> {
  const counts = new Map<GameKind, number>();
  for (const id of Object.keys(progress.levels)) {
    const kind = kindOfId(id);
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

/** The games of the player's most recently solved puzzles, newest last -
 * read off the save's own order (a puzzle's entry is added when it is
 * first solved). */
function recentGames(progress: PlayerProgress, count: number): GameKind[] {
  const ids = Object.keys(progress.levels);
  return ids
    .slice(Math.max(0, ids.length - count))
    .map(kindOfId)
    .filter((kind): kind is GameKind => kind !== null);
}

const kindCache = new Map<string, GameKind | null>();
function kindOfId(id: string): GameKind | null {
  let kind = kindCache.get(id);
  if (kind === undefined) {
    kind = puzzleKindOf(id)?.kind ?? null;
    kindCache.set(id, kind);
  }
  return kind;
}

/** Every puzzle id at one game+tier - the batch generator's only read path
 * into each game's own pool. Gravity's own `expert` tier is structurally
 * unreachable here: `PuzzleDifficulty` has no `'expert'` value, so no call
 * site can ever ask `getLevelsByDifficulty` for one. */
function poolForKindAndTier(kind: GameKind, tier: PuzzleDifficulty): ReadonlyArray<string> {
  switch (kind) {
    case 'gravity':
      return getGravityLevelsForTier(tier).map(level => level.id);
    case 'mirror':
      return getMirrorMazesByDifficulty(tier).map(puzzle => puzzle.id);
    case 'lilypads':
      return lilyIdsFor(tier);
    case 'vanes':
      return vaneIdsFor(tier);
    case 'binairo':
      return getBinairoByDifficulty(tier).map(puzzle => puzzle.id);
    case 'arukone':
      return getArukoneByDifficulty(tier).map(puzzle => puzzle.id);
    case 'glass':
      return glassIdsFor(tier);
    case 'lightsout':
      return getLightsOutByDifficulty(tier).map(puzzle => puzzle.id);
    case 'adjacent':
      return getAdjacentByDifficulty(tier).map(puzzle => puzzle.id);
    case 'bloom':
      return getBloomByDifficulty(tier).map(puzzle => puzzle.id);
    case 'mosaic':
      return getMosaicByDifficulty(tier).map(puzzle => puzzle.id);
    case 'bridges':
      return getBridgesByDifficulty(tier).map(puzzle => puzzle.id);
  }
}

/** How many boards a game's practice run deals before it starts over. */
export const PRACTICE_BOARDS = 6;

/**
 * The boards a game is tried out on from Settings: its first easy ones -
 * the same a new player meets first - topped up with endless easy boards
 * where the curated pool is shorter.
 */
export function practiceBoards(kind: GameKind): ReadonlyArray<string> {
  const pool = poolForKindAndTier(kind, 'easy').slice(0, PRACTICE_BOARDS);
  const ids = [...pool];
  for (let index = 0; ids.length < PRACTICE_BOARDS; index += 1) ids.push(endlessId(kind, 'easy', index));
  return ids;
}

/** Weighted pick from `entries` (`[item, weight]` pairs) - falls back to a
 * uniform pick over all entries if every weight is zero (should not happen
 * in practice; every game has a non-empty pool at every tier), rather than
 * ever throwing or returning nothing. */
function weightedPick<T>(entries: ReadonlyArray<readonly [T, number]>, rng: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return entries[Math.floor(rng() * entries.length)][0];
  let r = rng() * total;
  for (const [item, weight] of entries) {
    if (r < weight) return item;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}

/** A game's own sampling weight for one tier: the same for every game that
 * has puzzles there. It used to be the square root of the pool's size,
 * which gave Gravity (57 levels at easy alone) several times the pull of a
 * twenty-board game - so a player met Gravity constantly and some games
 * barely at all. Variety is the point of a mixed level; pool depth is not
 * a reason to deal a game more, and a small pool simply recycles (or runs
 * endless) once it is used up. */
function gameWeight(kind: GameKind, tier: PuzzleDifficulty): number {
  return poolForKindAndTier(kind, tier).length > 0 || ENDLESS_KINDS.has(kind) ? 1 : 0;
}

/** How strongly a game is discouraged when it was just seen: already in
 * this level, or in the level before. Never zero - a small collection must
 * still be able to fill a level - but far enough down that a player sees
 * a real spread of games from one level to the next. */
const SAME_LEVEL_PENALTY = 0.04;

/** Every game deals new boards forever: once a game's curated pool is
 * used up at a tier, it moves on to endless boards generated from their id
 * (or, for Mosaic, baked offline) - never a replay of a board already
 * solved. That is what lets the level sets run to a thousand and beyond
 * without repeating themselves. */
const ENDLESS_KINDS: ReadonlySet<GameKind> = new Set<GameKind>(ROTATION);

/** The first endless id of this game+tier the player has neither
 * completed nor already been dealt in this batch. Scans upward from zero,
 * which is cheap (a map lookup per completed board) and, unlike a random
 * draw, guarantees the puzzle is genuinely new every single time. */
function nextEndlessId(kind: GameKind, tier: PuzzleDifficulty, progress: PlayerProgress, usedInBatch: ReadonlySet<string>): string {
  for (let index = 0; ; index += 1) {
    const id = endlessId(kind, tier, index);
    if (progress.levels[id] === undefined && !usedInBatch.has(id) && id !== getDailyEntry().puzzleId) return id;
  }
}

/**
 * Gravity's mechanics arrive one at a time, like the games do: a level is
 * dealt only once every mechanic on it has been reached, counted in
 * Gravity puzzles solved. Walls are there from the start; anchors, then
 * portals, then hazards, then gravity zones, then sand and gates join as
 * the player settles in -
 * so a newcomer never meets a portal, an anchor and a zone in one set.
 */
export const GRAVITY_MECHANIC_AT: Readonly<Record<string, number>> = {
  obstacles: 0,
  anchored: 3,
  portals: 6,
  hazard: 9,
  'gravity-zone': 12,
  sand: 16,
};

function gravityMechanicsReady(id: string, played: number): boolean {
  const level = getLevelById(id);
  if (!level) return true;
  return mechanicsOf(level).every(m => played >= (GRAVITY_MECHANIC_AT[m] ?? 0));
}

/**
 * The available puzzle ids for one game+tier, given what's already been
 * completed (system-wide, from `progress.levels` - no separate "seen"
 * tracking needed) and what's already used earlier in *this* batch.
 *
 * The curated pool always comes first: those boards are authored, and a
 * player should meet all of them before the app starts inventing any. It
 * is only once a tier is genuinely used up that this reaches for an
 * endless id - which is the behaviour that replaced simply replaying the
 * pool, the point at which the app previously began handing back puzzles
 * a player had already solved with no acknowledgement that it had run
 * out of new ones.
 */
function availablePuzzleIds(kind: GameKind, tier: PuzzleDifficulty, progress: PlayerProgress, usedInBatch: ReadonlySet<string>): ReadonlyArray<string> {
  // Today's Daily is never dealt into a set: it is played on its own, and
  // a set puzzle that was secretly the Daily ended the set at Home.
  const daily = getDailyEntry().puzzleId;
  const gravityPlayed = kind === 'gravity' ? solvedPerGame(progress).get('gravity') ?? 0 : 0;
  const pool = poolForKindAndTier(kind, tier).filter(id => id !== daily && (kind !== 'gravity' || gravityMechanicsReady(id, gravityPlayed)));
  const notCompleted = pool.filter(id => progress.levels[id] === undefined);
  const notUsed = notCompleted.filter(id => !usedInBatch.has(id));
  if (notUsed.length > 0) return notUsed;
  if (ENDLESS_KINDS.has(kind)) return [nextEndlessId(kind, tier, progress, usedInBatch)];
  const poolNotUsed = pool.filter(id => !usedInBatch.has(id));
  if (poolNotUsed.length > 0) return poolNotUsed;
  return pool;
}

/**
 * Builds the next batch for `levelNumber`. `previousBatch` (the batch just
 * completed, or `null` for level 1) feeds the soft cross-level anti-
 * repetition rule; `rng` defaults to `Math.random` and is only a parameter
 * so tests can pass a seeded/deterministic function instead.
 */
export function generateBatch(levelNumber: number, progress: PlayerProgress, previousBatch: BatchState | null, rng: () => number = Math.random): BatchState {
  const band = tierBandForLevel(levelNumber);
  const solved = solvedPerGame(progress);
  // What the player has just been playing, newest last: their recent
  // solves, then the set before this one (in case it was left unfinished),
  // then each slot of this set as it is dealt.
  const recent: GameKind[] = [...recentGames(progress, HISTORY)];
  for (const ref of previousBatch?.puzzles ?? []) if (!progress.levels[ref.puzzleId]) recent.push(ref.kind);

  const puzzles: BatchPuzzleRef[] = [];
  const usedIds = new Set<string>();
  const dealtHere = new Map<GameKind, number>();

  let last: Slot | null = slotOf(previousBatch ? previousBatch.puzzles[previousBatch.puzzles.length - 1] : undefined);
  let hadEasy = false;
  let hadExtreme = false;

  for (let slot = 0; slot < band.batchSize; slot += 1) {
    const unlocked = unlockedGames(progress, dealtHere);
    const playedSoFar = (kind: GameKind) => (solved.get(kind) ?? 0) + (dealtHere.get(kind) ?? 0);
    // A game that has just arrived is dealt at once: its first puzzle,
    // with its lesson, is the moment it is introduced.
    const debut = unlocked.find(kind => playedSoFar(kind) === 0);
    const learning = gameBeingLearned(progress, dealtHere);
    const kind = debut ?? nextInRotation(unlocked, recent, learning, rng, playedSoFar);
    const played = (solved.get(kind) ?? 0) + (dealtHere.get(kind) ?? 0);
    const wanted = levelNumber < HARD_TIER_FIRST_LEVEL ? (rampSlot(played) === 'hard' ? 'medium' : rampSlot(played) ?? 'medium') : rampSlot(played);
    // Each game's own ramp (easy first, then medium, then a signposted
    // challenge) keeps a game gentle while it is new; there is no longer a
    // blanket wait for every game to arrive, which kept the first hundred
    // and more puzzles at one flat difficulty.
    const dealt: Slot = calm(wanted, { last, hadEasy, hadExtreme, lastSlot: slot === band.batchSize - 1 }, rng);
    const extreme = dealt === 'extreme';
    const challenge = extreme || dealt === 'hard';
    const tier: PuzzleDifficulty = challenge ? 'hard' : dealt === 'easy' ? 'easy' : 'medium';
    const ids = availablePuzzleIds(kind, tier, progress, usedIds);
    // A game's first boards are its easiest, in order - and while it is the
    // game being learned, every board it deals comes in order, so its
    // introduction climbs steadily instead of jumping about. An extreme draws
    // from the toughest third of what is left at hard - each game's hard
    // collection runs from its gentler boards to its fiercest.
    const pool = extreme && ids.length > 2 ? ids.slice(Math.floor((ids.length * 2) / 3)) : ids;
    const puzzleId = played < GAME_EASY_ONLY || (kind === learning && !challenge) ? ids[0] : pool[Math.floor(rng() * pool.length)];
    last = dealt;
    hadEasy = hadEasy || dealt === 'easy';
    hadExtreme = hadExtreme || extreme;

    // About one puzzle in `GOLDEN_EVERY` is golden - a surprise, so it is
    // decided here, at random, and not on any rhythm a player could count.
    const golden = rng() < 1 / GOLDEN_EVERY;
    puzzles.push({ kind, puzzleId, ...(challenge ? { challenge: true } : {}), ...(golden ? { golden: true } : {}), ...(extreme ? { extreme: true } : {}) });
    usedIds.add(puzzleId);
    dealtHere.set(kind, (dealtHere.get(kind) ?? 0) + 1);
    recent.push(kind);
  }

  return { levelNumber, puzzles, completedPuzzleIds: [] };
}

/**
 * The next game in the rotation: of the games the player has, the one they
 * have gone longest without (never the one just played, while there is a
 * choice), picked among the few longest-waiting - the longest most often -
 * with a game of the same kind of play as the last waiting a little
 * longer. The game being learned, meanwhile, takes every other puzzle.
 */
function nextInRotation(unlocked: ReadonlyArray<GameKind>, recent: ReadonlyArray<GameKind>, learning: GameKind | null, rng: () => number, played: (kind: GameKind) => number = () => SETTLED): GameKind {
  const last = recent[recent.length - 1];
  // The game being learned comes every other puzzle: whenever the last one
  // was something else. Never twice running while there is a choice.
  if (learning && learning !== last && unlocked.includes(learning)) return learning;
  const candidates = unlocked.filter(kind => gameWeight(kind, 'easy') > 0 && (kind !== last || unlocked.length === 1));
  if (candidates.length === 0) return unlocked[0];
  const waited = (kind: GameKind) => {
    const at = recent.lastIndexOf(kind);
    let wait = at < 0 ? HISTORY + 1 : recent.length - at;
    // A game that has only just arrived comes round a little sooner than
    // the rest for a while, so a player gets used to it - and then joins
    // the rotation like any other, before it can wear thin.
    if (played(kind) < SETTLED) wait += SETTLING_HEAD_START;
    if (last && FAMILY[kind] === FAMILY[last]) wait *= SAME_FAMILY_DELAY;
    // A hair of noise, so equal waits are broken fairly.
    return wait + rng() * 0.01;
  };
  const ranked = candidates.map(kind => [kind, waited(kind)] as const).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, PICK_AMONG);
  return weightedPick(top.map(([kind], i) => [kind, PICK_AMONG - i] as const), rng);
}

/** Whether every puzzle in `batch` has been completed. */
export function isBatchComplete(batch: BatchState): boolean {
  return batch.completedPuzzleIds.length >= batch.puzzles.length;
}

/** The next puzzle in `batch` the player hasn't finished yet, or `null` if
 * the batch is already complete (the caller's cue to advance to the next
 * level's batch instead - see `PlayerProgressProvider`). */
export function nextInBatch(batch: BatchState): BatchPuzzleRef | null {
  const completed = new Set(batch.completedPuzzleIds);
  return batch.puzzles.find(p => !completed.has(p.puzzleId)) ?? null;
}

/** Marks `puzzleId` completed within `batch`, idempotently (completing the
 * same puzzle twice - a replay - doesn't add a second entry). Pure. */
export function markPuzzleCompleted(batch: BatchState, puzzleId: string): BatchState {
  if (batch.completedPuzzleIds.includes(puzzleId)) return batch;
  if (!batch.puzzles.some(p => p.puzzleId === puzzleId)) return batch;
  return { ...batch, completedPuzzleIds: [...batch.completedPuzzleIds, puzzleId] };
}

/**
 * The tier a puzzle was dealt at - by the pool the dealer drew it from,
 * not by its own label: Gravity is dealt by solving depth
 * (`getGravityLevelsForTier`), so a level labelled medium can be a hard
 * deal. A swap must replace like with like.
 */
export function dealtTierOf(ref: BatchPuzzleRef): PuzzleDifficulty {
  const endless = parseEndlessId(ref.puzzleId);
  if (endless) return endless.tier;
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    if (poolForKindAndTier(ref.kind, tier).includes(ref.puzzleId)) return tier;
  }
  return puzzleKindOf(ref.puzzleId)?.difficulty ?? (ref.challenge ? 'hard' : 'medium');
}

/**
 * Replaces the unfinished slots `puzzleIds` of the current set with a
 * puzzle of another game, at the same tier and keeping any challenge flag
 * - for "swap this puzzle" and for a game just retired. The replacement is
 * never the same game, never a retired one, and prefers games not already
 * in the set. Finished slots are never touched.
 */
export function replaceInBatch(batch: BatchState, puzzleIds: ReadonlyArray<string>, progress: PlayerProgress, rng: () => number = Math.random): BatchState {
  const done = new Set(batch.completedPuzzleIds);
  const usedIds = new Set(batch.puzzles.map(p => p.puzzleId));
  const puzzles = batch.puzzles.map(p => ({ ...p }));
  for (let slot = 0; slot < puzzles.length; slot += 1) {
    const ref = puzzles[slot];
    if (!puzzleIds.includes(ref.puzzleId) || done.has(ref.puzzleId)) continue;
    const tier = dealtTierOf(ref);
    const inSet = new Set(puzzles.map(p => p.kind));
    const unlocked = unlockedGames(progress);
    const weighted = ROTATION.map((kind): readonly [GameKind, number] => {
      if (kind === ref.kind || !unlocked.includes(kind)) return [kind, 0] as const;
      const weight = gameWeight(kind, tier);
      return [kind, inSet.has(kind) ? weight * SAME_LEVEL_PENALTY : weight] as const;
    });
    if (!weighted.some(([, w]) => w > 0)) continue;
    const kind = weightedPick(weighted, rng);
    const ids = availablePuzzleIds(kind, tier, progress, usedIds);
    const puzzleId = ids[Math.floor(rng() * ids.length)];
    usedIds.add(puzzleId);
    puzzles[slot] = { kind, puzzleId, ...(ref.challenge ? { challenge: true } : {}), ...(ref.golden ? { golden: true } : {}), ...(ref.extreme ? { extreme: true } : {}) };
  }
  return { ...batch, puzzles };
}

import { getGravityLevelsForTier } from '../game/levels';
import { getMirrorMazesByDifficulty } from '../game/mirror';
import { getTentsTreesByDifficulty } from '../game/tents';
import { getTowersByDifficulty } from '../game/towers';
import { getBinairoByDifficulty } from '../game/binairo';
import { getArukoneByDifficulty } from '../game/arukone';
import { getFillaPixByDifficulty } from '../game/fillapix';
import { getLightsOutByDifficulty } from '../game/lightsout';
import { getBloomByDifficulty } from '../game/bloom';
import { getMosaicByDifficulty } from '../game/mosaic';
import { getBridgesByDifficulty } from '../game/bridges';
import { getAdjacentByDifficulty } from '../game/adjacent';
import { GameKind, ROTATION, puzzleKindOf } from '../game/journey';
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
  { maxLevel: 2, batchSize: 3, weights: { easy: 1.0, medium: 0, hard: 0 } },
  { maxLevel: 5, batchSize: 3, weights: { easy: 0.55, medium: 0.45, hard: 0 } },
  { maxLevel: 9, batchSize: 4, weights: { easy: 0.3, medium: 0.55, hard: 0.15 } },
  { maxLevel: 18, batchSize: 4, weights: { easy: 0.12, medium: 0.53, hard: 0.35 } },
  { maxLevel: Infinity, batchSize: 5, weights: { easy: 0.05, medium: 0.45, hard: 0.5 } }, // the permanent plateau
];

/** The first level number whose band can deal a hard-tier puzzle - read
 * off `TIER_CURVE` rather than written down twice, so re-tuning the table
 * cannot leave this behind. */
/**
 * The difficulty arc - per game: every game ramps on its own, by how many
 * of *that game's* puzzles the player has solved, so a game met for the
 * first time late on still starts gently.
 *  1. its first 3 puzzles: easy (its easiest boards, in order);
 *  2. the next 3: easy and medium, alternating;
 *  3. the next 6: easy, medium, then a signposted hard challenge;
 *  4. after that: random, extreme challenges included - within guard
 *     rails that hold across everything the player plays, so it never
 *     turns stressful: every level has an easy puzzle, two challenges never
 *     come back to back, an extreme is always followed by an easy one, and
 *     a level holds at most one extreme.
 * Hard and extreme puzzles only ever come as signposted challenges.
 */
export const GAME_EASY_ONLY = 3;
export const GAME_EASY_MEDIUM = 6;
export const GAME_RHYTHM = 12;
/** No hard puzzle before this level for anyone: a game needs nine solved
 * boards before it can deal one, so this is a floor, not the rule. */
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

/** Variety: a game played in the player's last `RECENT_BLOCK` puzzles is
 * not dealt again (unless nothing else is left), one from a little further
 * back is much less likely, and one not seen for a while a little more. */
const RECENT_BLOCK = 4;
const RECENT_WINDOW = 9;
const RECENT_PENALTY = 0.2;
const FRESH_BONUS = 1.6;

/**
 * Games arrive one at a time. A new player starts with Gravity alone; a
 * new game joins every `INTRO_EVERY` solved puzzles, in this order (from
 * the simplest to pick up to the most involved, alternating kinds of
 * play), until all twelve are in the mix. Each arrival is a small event:
 * it is dealt at once, opens with its lesson, and comes up often until its
 * first easy boards are done. Anyone who has already played a game keeps
 * it, whatever the count says, so no existing player loses a game.
 */
export const INTRO_ORDER: ReadonlyArray<GameKind> = [
  'gravity',
  'lightsout',
  'adjacent',
  'binairo',
  'tents',
  'mosaic',
  'bridges',
  'mirror',
  'bloom',
  'fillapix',
  'towers',
  'arukone',
];
export const INTRO_EVERY = 5;
/** A new game's weight while it is still in its first easy boards. */
const NEWCOMER_BOOST = 5;

function totalSolved(progress: PlayerProgress): number {
  let total = 0;
  for (const count of solvedPerGame(progress).values()) total += count;
  return total;
}

/**
 * The games this player has, in the order they arrived: every game they
 * have played, then the next ones in `INTRO_ORDER` up to the count their
 * solves have earned. `aheadBy` counts puzzles dealt but not yet solved
 * (the earlier slots of a set being built), so a game can arrive mid-set.
 * Retired games are never counted or dealt.
 */
export function unlockedGames(progress: PlayerProgress, aheadBy = 0): GameKind[] {
  const solved = solvedPerGame(progress);
  const order = INTRO_ORDER.filter(kind => !progress.retired.includes(kind));
  const earned = earnedGames(progress, aheadBy);
  const unlocked = order.filter(kind => (solved.get(kind) ?? 0) > 0);
  for (const kind of order) {
    if (unlocked.length >= earned) break;
    if (!unlocked.includes(kind)) unlocked.push(kind);
  }
  return unlocked;
}

function earnedGames(progress: PlayerProgress, aheadBy: number): number {
  return 1 + Math.floor((totalSolved(progress) + aheadBy) / INTRO_EVERY);
}

/** The game that has just arrived on the schedule, while it is still in
 * its first easy boards - the one the dealer puts in the spotlight. None
 * for a player whose games came from playing them before (their roster is
 * ahead of the schedule, so nothing on it is new). */
function spotlight(progress: PlayerProgress, unlocked: ReadonlyArray<GameKind>, aheadBy: number, played: (kind: GameKind) => number): GameKind | null {
  if (unlocked.length > earnedGames(progress, aheadBy)) return null;
  const newest = unlocked[unlocked.length - 1];
  return newest && played(newest) < GAME_EASY_ONLY ? newest : null;
}

/** The games this player has solved at least one puzzle of - so Home can
 * mark a game making its debut in the current set as new. */
export function gamesPlayed(progress: PlayerProgress): ReadonlySet<GameKind> {
  return new Set(solvedPerGame(progress).keys());
}

/** The game still to come, and how many more solves bring it - for Home's
 * "next game" line. Null once every game has arrived. */
export function nextGameToArrive(progress: PlayerProgress): { kind: GameKind; inPuzzles: number } | null {
  const unlocked = new Set(unlockedGames(progress));
  const kind = INTRO_ORDER.find(k => !unlocked.has(k) && !progress.retired.includes(k));
  if (!kind) return null;
  const total = totalSolved(progress);
  return { kind, inPuzzles: INTRO_EVERY - (total % INTRO_EVERY) };
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
    case 'tents':
      return getTentsTreesByDifficulty(tier).map(puzzle => puzzle.id);
    case 'towers':
      return getTowersByDifficulty(tier).map(puzzle => puzzle.id);
    case 'binairo':
      return getBinairoByDifficulty(tier).map(puzzle => puzzle.id);
    case 'arukone':
      return getArukoneByDifficulty(tier).map(puzzle => puzzle.id);
    case 'fillapix':
      return getFillaPixByDifficulty(tier).map(puzzle => puzzle.id);
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
    if (progress.levels[id] === undefined && !usedInBatch.has(id)) return id;
  }
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
  const pool = poolForKindAndTier(kind, tier);
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
  const recent: GameKind[] = [...recentGames(progress, RECENT_WINDOW)];
  for (const ref of previousBatch?.puzzles ?? []) if (!progress.levels[ref.puzzleId]) recent.push(ref.kind);

  const puzzles: BatchPuzzleRef[] = [];
  const usedIds = new Set<string>();
  const dealtHere = new Map<GameKind, number>();

  let last: Slot | null = slotOf(previousBatch ? previousBatch.puzzles[previousBatch.puzzles.length - 1] : undefined);
  let hadEasy = false;
  let hadExtreme = false;

  for (let slot = 0; slot < band.batchSize; slot += 1) {
    const lastBlock = new Set(recent.slice(-RECENT_BLOCK));
    const lastWindow = new Set(recent.slice(-RECENT_WINDOW));
    const unlocked = unlockedGames(progress, slot);
    const playedSoFar = (kind: GameKind) => (solved.get(kind) ?? 0) + (dealtHere.get(kind) ?? 0);
    // A game that has just arrived is dealt at once: its first puzzle,
    // with its lesson, is the moment it is introduced.
    const debut = unlocked.find(kind => playedSoFar(kind) === 0);
    const newcomer = spotlight(progress, unlocked, slot, playedSoFar);
    const weighted = ROTATION.map((kind): readonly [GameKind, number] => {
      // A game not yet arrived, or retired (see the shop), is never dealt.
      if (!unlocked.includes(kind)) return [kind, 0] as const;
      let weight = gameWeight(kind, 'easy');
      if (kind === newcomer && recent[recent.length - 1] !== kind) weight *= NEWCOMER_BOOST;
      else if (lastBlock.has(kind)) weight *= 0.0001;
      else if (lastWindow.has(kind)) weight *= RECENT_PENALTY;
      else weight *= FRESH_BONUS;
      return [kind, weight] as const;
    });

    const kind = debut ?? weightedPick(weighted, rng);
    const played = (solved.get(kind) ?? 0) + (dealtHere.get(kind) ?? 0);
    const wanted = levelNumber < HARD_TIER_FIRST_LEVEL ? (rampSlot(played) === 'hard' ? 'medium' : rampSlot(played) ?? 'medium') : rampSlot(played);
    const dealt = calm(wanted, { last, hadEasy, hadExtreme, lastSlot: slot === band.batchSize - 1 }, rng);
    const extreme = dealt === 'extreme';
    const challenge = extreme || dealt === 'hard';
    const tier: PuzzleDifficulty = challenge ? 'hard' : dealt === 'easy' ? 'easy' : 'medium';
    const ids = availablePuzzleIds(kind, tier, progress, usedIds);
    // A game's first boards are its easiest, in order. An extreme draws
    // from the toughest third of what is left at hard - each game's hard
    // collection runs from its gentler boards to its fiercest.
    const pool = extreme && ids.length > 2 ? ids.slice(Math.floor((ids.length * 2) / 3)) : ids;
    const puzzleId = played < GAME_EASY_ONLY ? ids[0] : pool[Math.floor(rng() * pool.length)];
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

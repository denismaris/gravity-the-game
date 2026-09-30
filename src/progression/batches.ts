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
   * `CHALLENGE_EVERY`) and announced everywhere it shows up rather than
   * sprung on the player. Absent rather than `false` on ordinary slots,
   * so a batch saved before this existed reads back correctly as "no
   * challenge" with no migration. */
  readonly challenge?: boolean;
  /** A golden puzzle: triple coins on its first solve (see `coins.ts`).
   * Absent rather than `false`, like `challenge`. */
  readonly golden?: boolean;
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
export const HARD_TIER_FIRST_LEVEL: number = (() => {
  for (let level = 1; level <= 200; level += 1) {
    if (tierBandForLevel(level).weights.hard > 0) return level;
  }
  return 1;
})();

function tierBandForLevel(levelNumber: number): TierBand {
  return TIER_CURVE.find(band => levelNumber <= band.maxLevel) ?? TIER_CURVE[TIER_CURVE.length - 1];
}

/**
 * How often a deliberately hard, signposted puzzle lands: every fourth
 * one, counted continuously across levels rather than per batch, so the
 * rhythm survives batch size changing from three to five along the curve.
 * Three gentler puzzles, then one that asks something. (Every sixth was
 * the first setting; playtesting called the whole run "too easy", and a
 * hard puzzle in six was a large part of why.)
 *
 * This cadence is the whole point of the redesign: difficulty used to be
 * drawn independently per slot, which meant a level could deal three hard
 * puzzles in a row or none at all, with nothing anywhere saying which was
 * which. Players read that as the game being arbitrary rather than as
 * variety - which is exactly what it was.
 */
export const CHALLENGE_EVERY = 4;

/** How many puzzles came before `levelNumber` begins - the offset that
 * turns a within-batch slot into a continuous puzzle number. The explicit
 * bands are few and short, and every batch past the plateau is the same
 * size, so the tail is arithmetic rather than a loop that grows without
 * bound as the level count climbs. */
function puzzlesBeforeLevel(levelNumber: number): number {
  const plateau = TIER_CURVE[TIER_CURVE.length - 1];
  const lastExplicitLevel = TIER_CURVE[TIER_CURVE.length - 2].maxLevel;
  let total = 0;
  for (let level = 1; level <= Math.min(levelNumber - 1, lastExplicitLevel); level += 1) {
    total += tierBandForLevel(level).batchSize;
  }
  if (levelNumber - 1 > lastExplicitLevel) {
    total += (levelNumber - 1 - lastExplicitLevel) * plateau.batchSize;
  }
  return total;
}

/** Whether the puzzle at continuous index `puzzleIndex` (0-based) is the
 * challenge. Hard tier has to actually be reachable at this level for the
 * answer to be yes, so a new player's opening levels stay a clean ramp
 * with no spikes at all. */
function isChallengeSlot(levelNumber: number, puzzleIndex: number): boolean {
  if (levelNumber < HARD_TIER_FIRST_LEVEL) return false;
  return puzzleIndex % CHALLENGE_EVERY === CHALLENGE_EVERY - 1;
}

/**
 * The tier mix for an ordinary, non-challenge slot: the band's own weights
 * with `hard` retired and its weight handed to *medium*. Hard arrives on
 * the cadence instead of at random, so leaving it in here would put
 * unannounced spikes straight back; but the first version split its weight
 * evenly with easy, which left the plateau dealing an easy puzzle in every
 * three or so ordinary slots, a long way past the point a player needs
 * them. Giving it all to medium keeps the curve's climb honest: by the
 * plateau an ordinary slot is almost always medium, and every hard puzzle
 * is still one the player was told about.
 */
function restWeights(weights: TierWeights): TierWeights {
  return { easy: weights.easy, medium: weights.medium + weights.hard, hard: 0 };
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

function sampleTier(weights: TierWeights, rng: () => number): PuzzleDifficulty {
  const total = weights.easy + weights.medium + weights.hard;
  const r = rng() * total;
  if (r < weights.easy) return 'easy';
  if (r < weights.easy + weights.medium) return 'medium';
  return 'hard';
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
const PREVIOUS_LEVEL_PENALTY = 0.4;

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
  const previousKinds = new Set(previousBatch?.puzzles.map(p => p.kind) ?? []);

  const puzzles: BatchPuzzleRef[] = [];
  const usedIds = new Set<string>();
  let lastKind: GameKind | null = null;
  const firstPuzzleIndex = puzzlesBeforeLevel(levelNumber);

  // The tiers first, for the whole level: challenges stay on their fixed
  // positions, and the ordinary slots are then put in order, easier first -
  // so every level warms up and builds, rather than lurching between tiers
  // in whatever order the draws happened to fall.
  const challengeAt = Array.from({ length: band.batchSize }, (_v, slot) => isChallengeSlot(levelNumber, firstPuzzleIndex + slot));
  const TIER_ORDER: Record<PuzzleDifficulty, number> = { easy: 0, medium: 1, hard: 2 };
  const ordinaryTiers = challengeAt
    .filter(isChallenge => !isChallenge)
    .map(() => sampleTier(restWeights(band.weights), rng))
    .sort((a, b) => TIER_ORDER[a] - TIER_ORDER[b]);
  const tiers: PuzzleDifficulty[] = challengeAt.map(isChallenge => (isChallenge ? 'hard' : ordinaryTiers.shift()!));
  const usedKinds = new Set<GameKind>();

  for (let slot = 0; slot < band.batchSize; slot += 1) {
    const challenge = challengeAt[slot];
    const tier = tiers[slot];

    const weighted = ROTATION.map((kind): readonly [GameKind, number] => {
      // A game the player retired (see the shop) is never dealt.
      let weight = progress.retired.includes(kind) ? 0 : gameWeight(kind, tier);
      if (usedKinds.has(kind)) weight *= SAME_LEVEL_PENALTY;
      else if (previousKinds.has(kind)) weight *= PREVIOUS_LEVEL_PENALTY;
      return [kind, weight] as const;
    });

    // No back-to-back repeat within a batch, unless every other game would
    // then have zero weight (only the last-used game has anything left) -
    // the same "only the last-used game is left" fallback the old Journey
    // round-robin used.
    const withoutLastKind = weighted.map(([kind, weight]) => [kind, kind === lastKind ? 0 : weight] as const);
    const candidates = withoutLastKind.some(([, weight]) => weight > 0) ? withoutLastKind : weighted;

    const kind = weightedPick(candidates, rng);
    const ids = availablePuzzleIds(kind, tier, progress, usedIds);
    const puzzleId = ids[Math.floor(rng() * ids.length)];

    // About one puzzle in `GOLDEN_EVERY` is golden - a surprise, so it is
    // decided here, at random, and not on any rhythm a player could count.
    const golden = rng() < 1 / GOLDEN_EVERY;
    puzzles.push({ kind, puzzleId, ...(challenge ? { challenge: true } : {}), ...(golden ? { golden: true } : {}) });
    usedIds.add(puzzleId);
    usedKinds.add(kind);
    lastKind = kind;
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
    const weighted = ROTATION.map((kind): readonly [GameKind, number] => {
      if (kind === ref.kind || progress.retired.includes(kind)) return [kind, 0] as const;
      const weight = gameWeight(kind, tier);
      return [kind, inSet.has(kind) ? weight * SAME_LEVEL_PENALTY : weight] as const;
    });
    if (!weighted.some(([, w]) => w > 0)) continue;
    const kind = weightedPick(weighted, rng);
    const ids = availablePuzzleIds(kind, tier, progress, usedIds);
    const puzzleId = ids[Math.floor(rng() * ids.length)];
    usedIds.add(puzzleId);
    puzzles[slot] = { kind, puzzleId, ...(ref.challenge ? { challenge: true } : {}), ...(ref.golden ? { golden: true } : {}) };
  }
  return { ...batch, puzzles };
}

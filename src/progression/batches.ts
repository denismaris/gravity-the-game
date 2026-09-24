import { getLevelsByDifficulty } from '../game/levels';
import { getMirrorMazesByDifficulty } from '../game/mirror';
import { getTentsTreesByDifficulty } from '../game/tents';
import { getTowersByDifficulty } from '../game/towers';
import { getBinairoByDifficulty } from '../game/binairo';
import { GameKind, ROTATION } from '../game/journey';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { PlayerProgress } from './playerProgress';

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
  { maxLevel: 3, batchSize: 3, weights: { easy: 1.0, medium: 0, hard: 0 } },
  { maxLevel: 8, batchSize: 3, weights: { easy: 0.6, medium: 0.4, hard: 0 } },
  { maxLevel: 15, batchSize: 4, weights: { easy: 0.5, medium: 0.5, hard: 0 } },
  { maxLevel: 25, batchSize: 4, weights: { easy: 0.35, medium: 0.55, hard: 0.1 } },
  { maxLevel: Infinity, batchSize: 5, weights: { easy: 0.15, medium: 0.5, hard: 0.35 } }, // the permanent plateau
];

function tierBandForLevel(levelNumber: number): TierBand {
  return TIER_CURVE.find(band => levelNumber <= band.maxLevel) ?? TIER_CURVE[TIER_CURVE.length - 1];
}

/** Every puzzle id at one game+tier - the batch generator's only read path
 * into each game's own pool. Gravity's own `expert` tier is structurally
 * unreachable here: `PuzzleDifficulty` has no `'expert'` value, so no call
 * site can ever ask `getLevelsByDifficulty` for one. */
function poolForKindAndTier(kind: GameKind, tier: PuzzleDifficulty): ReadonlyArray<string> {
  switch (kind) {
    case 'gravity':
      return getLevelsByDifficulty(tier).map(level => level.id);
    case 'mirror':
      return getMirrorMazesByDifficulty(tier).map(puzzle => puzzle.id);
    case 'tents':
      return getTentsTreesByDifficulty(tier).map(puzzle => puzzle.id);
    case 'towers':
      return getTowersByDifficulty(tier).map(puzzle => puzzle.id);
    case 'binairo':
      return getBinairoByDifficulty(tier).map(puzzle => puzzle.id);
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

/** A game's own sampling weight for one tier - the square root of its pool
 * size at that tier, not the raw count. Gravity's medium tier alone (61
 * levels) outnumbers Mirror Maze's entire pool (12) many times over;
 * weighting directly by count would make the four small-pool games all but
 * never appear. The square root compresses that gap (sqrt(61) ~= 7.8 vs.
 * sqrt(4) = 2, a ~4x pull toward Gravity rather than ~15x) while still
 * giving the deeper pool a real, deliberate edge - "varied, weighted
 * toward Gravity's depth", not "uniform" and not "proportional". */
function gameWeight(kind: GameKind, tier: PuzzleDifficulty): number {
  return Math.sqrt(poolForKindAndTier(kind, tier).length);
}

/** The available puzzle ids for one game+tier, given what's already been
 * completed (system-wide, from `progress.levels` - no separate "seen"
 * tracking needed) and what's already used earlier in *this* batch. Falls
 * back to the full tier pool, then (if still exhausted, e.g. a very small
 * pool fully used within one batch) to the full pool minus only the
 * in-batch usage, so a slot is never left with zero candidates. */
function availablePuzzleIds(kind: GameKind, tier: PuzzleDifficulty, progress: PlayerProgress, usedInBatch: ReadonlySet<string>): ReadonlyArray<string> {
  const pool = poolForKindAndTier(kind, tier);
  const notCompleted = pool.filter(id => progress.levels[id] === undefined);
  const notUsed = notCompleted.filter(id => !usedInBatch.has(id));
  if (notUsed.length > 0) return notUsed;
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

  for (let slot = 0; slot < band.batchSize; slot += 1) {
    const tier = sampleTier(band.weights, rng);

    const weighted = ROTATION.map((kind): readonly [GameKind, number] => {
      const weight = gameWeight(kind, tier) * (previousKinds.has(kind) ? 0.5 : 1); // soft cross-level penalty
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

    puzzles.push({ kind, puzzleId });
    usedIds.add(puzzleId);
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

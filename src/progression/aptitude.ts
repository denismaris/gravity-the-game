import { ARUKONE } from '../game/arukone';
import { BINAIRO } from '../game/binairo';
import { FILLAPIX } from '../game/fillapix';
import { GameKind, ROTATION } from '../game/journey';
import { LEVELS } from '../game/levels';
import { LIGHTS_OUT } from '../game/lightsout';
import { BLOOM } from '../game/bloom';
import { ADJACENT } from '../game/adjacent';
import { MIRROR_MAZES } from '../game/mirror';
import { TENTS_TREES } from '../game/tents';
import { TOWERS } from '../game/towers';
import { getLevelStars, isLevelCompleted, PlayerProgress } from './playerProgress';

/**
 * A reading of how the player is actually doing, per game and overall.
 *
 * This is the app's own score, derived entirely from puzzles solved inside
 * it. It is **not** a psychometric measure and nothing here should ever be
 * presented as one - the number it produces is a game score on a
 * deliberately familiar-looking scale, the same way a chess app shows a
 * rating.
 *
 * Two things are worth measuring and they are not the same:
 *
 *  - **Precision** - how cleanly you solve what you attempt. Stars already
 *    encode this exactly: every non-Gravity game scores three stars for a
 *    hintless solve, two for one hint, one for more (`HINT_STAR_THRESHOLDS`
 *    in `PlayerProgressProvider`), and Gravity scores against par. So
 *    precision needs no new tracking at all.
 *  - **Coverage** - how much of the app you have actually met. On its own
 *    this rewards grinding; on its own precision rewards solving three easy
 *    puzzles perfectly and stopping. The index blends them, weighted toward
 *    precision, and the per-game chart shows precision alone.
 *
 * Nothing here is stored. Like unlocks and achievements, it is recomputed
 * from `PlayerProgress` every time - so a re-tiered puzzle or a new pool
 * takes effect immediately and no save ever needs migrating.
 */

interface PoolEntry {
  readonly id: string;
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

const POOLS: Readonly<Record<GameKind, ReadonlyArray<PoolEntry>>> = {
  gravity: LEVELS.map(level => ({ id: level.id, difficulty: level.difficulty })),
  mirror: MIRROR_MAZES.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  tents: TENTS_TREES.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  towers: TOWERS.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  binairo: BINAIRO.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  arukone: ARUKONE.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  fillapix: FILLAPIX.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  lightsout: LIGHTS_OUT.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  adjacent: ADJACENT.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
  bloom: BLOOM.map(puzzle => ({ id: puzzle.id, difficulty: puzzle.difficulty })),
};

/**
 * What a clean solve at each tier is worth. A *multiplier on the score*,
 * not a weight in an average - the distinction matters and the first
 * version of this file got it backwards.
 *
 * Weighting a mean by difficulty does not reward difficulty at all: if
 * every puzzle is solved equally well the weights cancel and a flawless
 * run of easy boards scores exactly what a flawless run of hard ones
 * does. Worse, it makes a *scrappy* hard solve drag the average down
 * harder than a scrappy easy one, which is precisely backwards - fumbling
 * a demanding puzzle deserves more credit than fumbling a trivial one.
 *
 * Scaling each puzzle's own score fixes both. Only `hard` and `expert`
 * exceed 1, so the chart cannot be maxed out on easy material however
 * cleanly it is played, and a struggle on a hard board still outscores
 * the same struggle on an easy one. Spread is deliberately narrow: a
 * flawless run of easy puzzles should read as genuinely good, just not
 * as full marks.
 */
const TIER_MULTIPLIER: Readonly<Record<PoolEntry['difficulty'], number>> = {
  easy: 0.8,
  medium: 0.95,
  hard: 1.1,
  expert: 1.2,
};

/**
 * The multiplier of an average puzzle in this app, which every score is
 * measured against - so "full marks" means *the whole app solved
 * flawlessly*, exactly.
 *
 * Without it the multipliers above are absolute, and since the pools are
 * not uniformly hard, a player who had solved literally every puzzle at
 * three stars would land a shade under 100% and the top of the scale
 * would be unreachable by anyone, ever. Dividing by the app's own mean
 * makes the ceiling reachable by construction rather than by a number
 * tuned to today's pools and gone stale by the next content pass.
 */
const REFERENCE_MULTIPLIER: number = (() => {
  let sum = 0;
  let count = 0;
  for (const kind of ROTATION) {
    for (const puzzle of POOLS[kind]) {
      sum += TIER_MULTIPLIER[puzzle.difficulty];
      count += 1;
    }
  }
  return count > 0 ? sum / count : 1;
})();

export interface GameAptitude {
  readonly kind: GameKind;
  readonly solved: number;
  readonly total: number;
  /** Stars earned across this game, out of `solved * 3`. */
  readonly stars: number;
  /** How cleanly this game's solved puzzles went, 0..1, weighted by how
   * hard each one was. Zero when nothing here has been solved - which is
   * "untested", not "bad", and callers must say so rather than drawing it
   * as a failure (see `tested`). */
  readonly precision: number;
  /** How much of this game's pool has been solved, 0..1. */
  readonly coverage: number;
  /** Whether there is any signal here at all. */
  readonly tested: boolean;
}

export interface Aptitude {
  readonly games: ReadonlyArray<GameAptitude>;
  readonly solved: number;
  readonly total: number;
  /** Stars earned across puzzles that still exist, out of `solved * 3`.
   * Deliberately not `getTotalStars`, which sums the whole save including
   * stars won on retired puzzles - showing that figure next to `solved`
   * gave a star count higher than the solves could possibly support. */
  readonly stars: number;
  readonly precision: number;
  readonly coverage: number;
  /** The headline score, or `null` until there is enough to say anything.
   * See `MIN_SOLVES_FOR_INDEX`. */
  readonly index: number | null;
  /** The player's best and worst tested games, for the one line of prose
   * the chart is worth. Both `null` until at least two games are tested -
   * "strongest of one" says nothing. */
  readonly strongest: GameKind | null;
  readonly weakest: GameKind | null;
}

/**
 * How many puzzles have to be solved before a score is shown at all.
 *
 * A brand-new player scoring anything is worse than showing nothing: the
 * number would be built from one or two puzzles, would swing wildly for
 * the first few solves, and reads as a judgement delivered before they
 * have done anything. Five is enough for the figure to stop lurching.
 */
export const MIN_SOLVES_FOR_INDEX = 5;

/** The scale the index is drawn on. Centred and spread to look like the
 * familiar thing it is imitating, with a floor well above zero because
 * this measures how well you are playing, and someone who has solved five
 * puzzles is playing. */
const INDEX_FLOOR = 85;
const INDEX_RANGE = 60;

/** Precision counts for more than coverage: solving everything badly
 * should not outscore solving a decent amount of it cleanly. Coverage
 * still carries real weight, because a score built from precision alone
 * would peak after a handful of perfect easy solves and then never move
 * again however much of the app you went on to finish. */
const PRECISION_SHARE = 0.7;

interface Tally {
  solved: number;
  stars: number;
  /** Sum of per-puzzle scaled scores; divide by `solved` for precision. */
  score: number;
}

function tally(progress: PlayerProgress, pool: ReadonlyArray<PoolEntry>): Tally {
  const result: Tally = { solved: 0, stars: 0, score: 0 };
  for (const puzzle of pool) {
    if (!isLevelCompleted(progress, puzzle.id)) continue;
    const stars = getLevelStars(progress, puzzle.id);
    result.solved += 1;
    result.stars += stars;
    result.score += (stars / 3) * (TIER_MULTIPLIER[puzzle.difficulty] / REFERENCE_MULTIPLIER);
  }
  return result;
}

/** The mean per-puzzle score, held to 0..1. The cap is what makes the
 * multipliers above safe: hard and expert solves can carry a player's mean
 * past 1, and that headroom is exactly what lets strong play on hard
 * material offset easier puzzles in the same pool - it is not meant to
 * push the reading itself above full marks. */
function precisionOf(tallied: Tally): number {
  return tallied.solved > 0 ? Math.min(1, tallied.score / tallied.solved) : 0;
}

/** The whole reading. One pass over every pool, so cheap enough to call
 * straight from a render without memoising - though Home memoises it
 * anyway, since `progress` is a stable reference between mutations. */
export function computeAptitude(progress: PlayerProgress): Aptitude {
  const games: GameAptitude[] = [];
  const overall: Tally = { solved: 0, stars: 0, score: 0 };
  let total = 0;

  for (const kind of ROTATION) {
    const pool = POOLS[kind];
    const counts = tally(progress, pool);
    total += pool.length;
    overall.solved += counts.solved;
    overall.stars += counts.stars;
    overall.score += counts.score;

    games.push({
      kind,
      solved: counts.solved,
      total: pool.length,
      stars: counts.stars,
      precision: precisionOf(counts),
      coverage: pool.length > 0 ? counts.solved / pool.length : 0,
      tested: counts.solved > 0,
    });
  }

  const precision = precisionOf(overall);
  const coverage = total > 0 ? overall.solved / total : 0;
  const blend = PRECISION_SHARE * precision + (1 - PRECISION_SHARE) * coverage;

  const tested = games.filter(game => game.tested);
  const ranked = [...tested].sort((a, b) => b.precision - a.precision);

  return {
    games,
    solved: overall.solved,
    total,
    stars: overall.stars,
    precision,
    coverage,
    index: overall.solved >= MIN_SOLVES_FOR_INDEX ? Math.round(INDEX_FLOOR + INDEX_RANGE * blend) : null,
    strongest: ranked.length >= 2 ? ranked[0].kind : null,
    weakest: ranked.length >= 2 ? ranked[ranked.length - 1].kind : null,
  };
}

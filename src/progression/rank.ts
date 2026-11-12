import { PlayerProgress } from './playerProgress';

/**
 * The player's rank: a long, named road that gives the whole almanac a
 * direction. It is measured in **levels finished** - the one number every
 * player can see and count for themselves, and the one that only playing
 * moves (it was a blend of stars, puzzles, errands and streak days, called
 * XP, which nobody could work out from the board in front of them).
 *
 * Derived from the save's level cursor, never stored as a running total,
 * so it cannot drift. A rank once reached is never taken back: a save
 * that reached a rank on the old measure keeps it (see `rankOf`).
 */

/** Levels finished: every level set completed so far. */
export function levelsFinished(progress: PlayerProgress): number {
  return Math.max(0, progress.currentLevel - 1);
}

export interface RankTier {
  readonly title: string;
  /** Levels finished at which this rank is reached. */
  readonly at: number;
}

/** The named ranks, in order: close together at first, so the opening
 * evenings bring a few, then wider apart. Past the last, it carries on as
 * numbered Luminary ranks - see `rankAt`. */
export const RANKS: ReadonlyArray<RankTier> = [
  { title: 'Novice', at: 0 },
  { title: 'Apprentice', at: 3 },
  { title: 'Wayfarer', at: 7 },
  { title: 'Navigator', at: 12 },
  { title: 'Cartographer', at: 18 },
  { title: 'Almanac Keeper', at: 25 },
  { title: 'Puzzle Sage', at: 34 },
  { title: 'Grand Master', at: 45 },
  { title: 'Star Reader', at: 58 },
  { title: 'Tide Watcher', at: 72 },
  { title: 'Lantern Bearer', at: 88 },
  { title: 'Weather Wise', at: 105 },
  { title: 'Keeper of Keys', at: 125 },
  { title: 'Loremaster', at: 150 },
  { title: 'Archivist', at: 180 },
  { title: 'Illuminator', at: 215 },
  { title: 'Polymath', at: 255 },
  { title: 'Luminary', at: 300 },
];
/** Levels between each numbered Luminary rank past the last named one. */
export const GRAND_MASTER_STEP = 50;

/** Levels finished at which rank `n` (1-based) is reached. */
export function rankThreshold(n: number): number {
  if (n <= RANKS.length) return RANKS[Math.max(1, n) - 1].at;
  return RANKS[RANKS.length - 1].at + (n - RANKS.length) * GRAND_MASTER_STEP;
}

/** Coins paid out on reaching rank `n` (1-based; rank 1 is where you
 * start and pays nothing). */
export function rankReward(n: number): number {
  return n <= 1 ? 0 : 20 + 10 * n;
}

export interface Rank {
  /** 1-based rank number. */
  readonly number: number;
  readonly title: string;
  /** Levels finished when this rank began, and when the next one begins. */
  readonly from: number;
  readonly to: number;
  /** Levels finished so far. */
  readonly levels: number;
  /** 0-1 of the way to the next rank. */
  readonly share: number;
}

/** The rank held with `levels` levels finished. */
export function rankAt(levels: number): Rank {
  const last = RANKS[RANKS.length - 1];
  if (levels >= last.at) {
    const beyond = Math.floor((levels - last.at) / GRAND_MASTER_STEP);
    const from = last.at + beyond * GRAND_MASTER_STEP;
    const to = from + GRAND_MASTER_STEP;
    return {
      number: RANKS.length + beyond,
      title: beyond === 0 ? last.title : `${last.title} ${toRoman(beyond + 1)}`,
      from,
      to,
      levels,
      share: (levels - from) / (to - from),
    };
  }
  let index = 0;
  while (index + 1 < RANKS.length && RANKS[index + 1].at <= levels) index += 1;
  const from = RANKS[index].at;
  const to = RANKS[index + 1].at;
  return { number: index + 1, title: RANKS[index].title, from, to, levels, share: (levels - from) / (to - from) };
}

export function rankOf(progress: PlayerProgress): Rank {
  const levels = levelsFinished(progress);
  const rank = rankAt(levels);
  // Never lower than a rank already celebrated and paid for.
  const kept = progress.rankRewarded;
  if (kept <= rank.number) return rank;
  const from = rankThreshold(kept);
  const to = rankThreshold(kept + 1);
  return { number: kept, title: rankTitle(kept), from, to, levels, share: Math.max(0, Math.min(1, (levels - from) / (to - from))) };
}

/** The title of rank `n`, whether reached or not. */
export function rankTitle(n: number): string {
  if (n <= RANKS.length) return RANKS[Math.max(1, n) - 1].title;
  return `${RANKS[RANKS.length - 1].title} ${toRoman(n - RANKS.length + 1)}`;
}

/** Ranks reached but not yet celebrated and paid - normally none, one
 * after a rank-up, several for a save that predates ranks. */
export function pendingRanks(progress: PlayerProgress): number[] {
  const reached = rankOf(progress).number;
  const pending: number[] = [];
  for (let n = Math.max(2, progress.rankRewarded + 1); n <= reached; n += 1) pending.push(n);
  return pending;
}

/** Collects every pending rank: pays their coins and marks them done. */
export function collectRanks(progress: PlayerProgress): { progress: PlayerProgress; ranks: number[]; coins: number } {
  const ranks = pendingRanks(progress);
  if (ranks.length === 0) return { progress, ranks, coins: 0 };
  const coins = ranks.reduce((sum, n) => sum + rankReward(n), 0);
  return { progress: { ...progress, coins: progress.coins + coins, rankRewarded: ranks[ranks.length - 1] }, ranks, coins };
}

export function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rest = Math.max(1, Math.floor(n));
  let out = '';
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

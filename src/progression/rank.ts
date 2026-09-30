import { PlayerProgress, getTotalStars } from './playerProgress';

/**
 * The player's rank: a long, named road that gives the whole almanac a
 * direction - every star, every puzzle, every errand run moves you along
 * it.
 *
 * Experience is *derived* from what the save already records (stars,
 * puzzles solved, errands claimed, the best Daily run), never stored as a
 * running total - so it can't drift, and a player who had been playing
 * long before ranks existed arrives already partway up the road, with the
 * ranks they had earned waiting to be collected.
 */

/** What each thing is worth. Stars dominate: a clean solve is worth
 * more than a hinted one, and replays that win new stars still count. */
export const XP_PER_STAR = 10;
export const XP_PER_PUZZLE = 5;
export const XP_PER_ERRAND = 25;
export const XP_PER_STREAK_DAY = 5;

export interface RankTier {
  readonly title: string;
  /** Experience at which this rank is reached. */
  readonly at: number;
}

/** The named ranks, in order. Past the last, the road carries on as
 * numbered Grand Master ranks - see `rankAt`. */
export const RANKS: ReadonlyArray<RankTier> = [
  { title: 'Novice', at: 0 },
  { title: 'Apprentice', at: 150 },
  { title: 'Wayfarer', at: 400 },
  { title: 'Navigator', at: 800 },
  { title: 'Cartographer', at: 1400 },
  { title: 'Almanac Keeper', at: 2200 },
  { title: 'Puzzle Sage', at: 3300 },
  { title: 'Grand Master', at: 4800 },
];
/** Each numbered Grand Master rank past the last named one. */
export const GRAND_MASTER_STEP = 2000;

/** Coins paid out on reaching rank `n` (1-based; rank 1 is where you
 * start and pays nothing). */
export function rankReward(n: number): number {
  return n <= 1 ? 0 : 40 + 20 * n;
}

export function experienceOf(progress: PlayerProgress): number {
  const puzzles = Object.keys(progress.levels).length;
  return (
    getTotalStars(progress) * XP_PER_STAR +
    puzzles * XP_PER_PUZZLE +
    progress.errandsClaimed * XP_PER_ERRAND +
    progress.bestDailyStreak * XP_PER_STREAK_DAY
  );
}

export interface Rank {
  /** 1-based rank number. */
  readonly number: number;
  readonly title: string;
  /** Experience this rank began at, and the next one begins at. */
  readonly from: number;
  readonly to: number;
  readonly xp: number;
  /** 0-1 of the way to the next rank. */
  readonly share: number;
}

/** The rank held with `xp` experience. */
export function rankAt(xp: number): Rank {
  const last = RANKS[RANKS.length - 1];
  if (xp >= last.at) {
    const beyond = Math.floor((xp - last.at) / GRAND_MASTER_STEP);
    const from = last.at + beyond * GRAND_MASTER_STEP;
    const to = from + GRAND_MASTER_STEP;
    return {
      number: RANKS.length + beyond,
      title: beyond === 0 ? last.title : `${last.title} ${toRoman(beyond + 1)}`,
      from,
      to,
      xp,
      share: (xp - from) / (to - from),
    };
  }
  let index = 0;
  while (index + 1 < RANKS.length && RANKS[index + 1].at <= xp) index += 1;
  const from = RANKS[index].at;
  const to = RANKS[index + 1].at;
  return { number: index + 1, title: RANKS[index].title, from, to, xp, share: (xp - from) / (to - from) };
}

export function rankOf(progress: PlayerProgress): Rank {
  return rankAt(experienceOf(progress));
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

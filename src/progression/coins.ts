import { StarRating } from '../game/scoring';

/**
 * The coin economy: every number in one place, and the one pure function
 * that decides what a solve is worth.
 *
 * Coins are earned by *progress*, never by repetition - a puzzle pays out
 * the first time it is solved and again only for stars it had not earned
 * before, so replaying an easy board cannot farm them. And hints already
 * cost stars, so a player who leans on hints also earns fewer coins to buy
 * the next ones: the economy balances itself rather than needing a cap.
 */

/** What a new player (and an existing save on its first load with coins)
 * starts with - enough to try a few hints before earning any. */
export const STARTING_COINS = 100;

/** One hint, in every game that has them: about one solve's pay, so a
 * hint is a real choice without ever being out of reach. (Setting this to
 * 0 makes hints free - the Hint pill then hides its price tag.) */
export const HINT_COST = 15;
/** One undo (Gravity, Fill-a-Pix, Adjacent). Deliberately cheap: an undo
 * fixes a slip, it does not solve anything. */
/** Undo is free: taking a move back is part of thinking, not a power. */
export const UNDO_COST = 0;

/** Insight, the superpower: each charge reveals and explains the next
 * move. A new player starts with a few; more come from a video (the
 * player's choice) or are bought with coins when they run out. */
export const STARTING_INSIGHTS = 3;
export const INSIGHTS_PER_VIDEO = 2;

/** A first solve, by the stars it earned. */
export const FIRST_SOLVE_COINS: Readonly<Record<StarRating, number>> = { 1: 4, 2: 7, 3: 10 };
/** Each star a replay earns that the puzzle had not had before. */
export const STAR_UPGRADE_COINS = 3;
/** The Daily, on top of its own solve - once per day. */
export const DAILY_BONUS = 15;
/** Finishing a whole level set. */
export const SET_BONUS = 20;
/** On top of the stars, for a signposted challenge's first solve: the hard
 * ones should be worth the effort. */
export const CHALLENGE_BONUS = 15;
/** For an extreme challenge, instead of the challenge bonus. */
export const EXTREME_BONUS = 30;

export interface SolveReward {
  /** Best stars before this solve, or 0 if it had never been solved. */
  readonly previousStars: 0 | StarRating;
  /** Best stars after it. */
  readonly bestStars: StarRating;
  /** This solve was today's Daily, and the Daily was not already done. */
  readonly firstDailyToday: boolean;
  /** This solve completed the level set. */
  readonly setCompleted: boolean;
  /** A signposted challenge (see `batches.ts`). */
  readonly challenge?: boolean;
  /** An extreme challenge. */
  readonly extreme?: boolean;
}

/** One dealt puzzle in this many is golden, paying `GOLDEN_MULTIPLIER`
 * times the coins on its first solve. */
export const GOLDEN_EVERY = 8;
export const GOLDEN_MULTIPLIER = 3;

/**
 * The clean-run combo: consecutive solves without a hint multiply what
 * each pays, and a hint resets it - the reward for playing on your own.
 */
export function cleanRunMultiplier(run: number): number {
  if (run >= 5) return 2;
  if (run >= 3) return 1.5;
  if (run >= 2) return 1.2;
  return 1;
}

export function coinsForSolve({ previousStars, bestStars, firstDailyToday, setCompleted, challenge, extreme }: SolveReward): number {
  let coins = 0;
  if (previousStars === 0) coins += FIRST_SOLVE_COINS[bestStars] + (extreme ? EXTREME_BONUS : challenge ? CHALLENGE_BONUS : 0);
  else if (bestStars > previousStars) coins += (bestStars - previousStars) * STAR_UPGRADE_COINS;
  if (firstDailyToday) coins += DAILY_BONUS;
  if (setCompleted) coins += SET_BONUS;
  return coins;
}

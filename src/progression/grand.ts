import { grandWeekOf, weekIndexOf } from '../game/journey';
import { PlayerProgress } from './playerProgress';
import { grantCosmetic } from './shop';

/**
 * What the Weekly Grand pays: coins every week, and - at a few milestones
 * of Grands solved - a cosmetic the shop does not sell. The one way to
 * wear them is to have played for them.
 */

export const GRAND_COINS = 100;

export interface GrandReward {
  /** Grands solved, in all, that earn it. */
  readonly at: number;
  readonly cosmetic: string;
}

export const GRAND_REWARDS: ReadonlyArray<GrandReward> = [
  { at: 1, cosmetic: 'confetti-laurel' },
  { at: 3, cosmetic: 'garden-orchid' },
  { at: 6, cosmetic: 'ball-meteorite' },
  { at: 10, cosmetic: 'chart-admiralty' },
];

/** The next exclusive still to be won, or null once all are. */
export function nextGrandReward(progress: PlayerProgress): GrandReward | null {
  return GRAND_REWARDS.find(reward => reward.at > progress.grandsSolved.length) ?? null;
}

export function isGrandSolved(progress: PlayerProgress, week: number): boolean {
  return progress.grandsSolved.includes(week);
}

/**
 * Pays a Grand solved for the first time. A board carries its own week, so
 * one begun on a Sunday and finished on the Monday still counts - but only
 * last week's, not any older one.
 */
export function recordGrand(progress: PlayerProgress, puzzleId: string, now: Date): { progress: PlayerProgress; cosmetic: string | null } | null {
  const week = grandWeekOf(puzzleId);
  if (week === null || isGrandSolved(progress, week)) return null;
  const current = weekIndexOf(now);
  if (week > current || week < current - 1) return null;
  const grandsSolved = [...progress.grandsSolved, week];
  const reward = GRAND_REWARDS.find(r => r.at === grandsSolved.length);
  let next: PlayerProgress = { ...progress, grandsSolved, coins: progress.coins + GRAND_COINS };
  if (reward) next = grantCosmetic(next, reward.cosmetic);
  return { progress: next, cosmetic: reward?.cosmetic ?? null };
}

import { mergeLevelResult } from '../game/scoring';
import { getCompletedCount, PlayerProgress } from '../progression/playerProgress';

/**
 * Two copies of one player's progress - this device's and the cloud's -
 * made into one, without losing anything earned or paying anything twice.
 *
 * - **Everything earned only grows**, so it is taken from both: every
 *   puzzle at its best result, every piece owned, the Patron pass, every
 *   Grand, stamp, chapter and set already claimed, the best streak.
 * - **Running state** - the purse, the current level and its set, today's
 *   errands, charges, what is worn - cannot be added up without paying
 *   twice, so it comes whole from whichever copy is further along.
 * - **Claimed rewards are unioned**, so a reward claimed on either device
 *   is claimed in the result. At worst a reward claimed on the other copy
 *   is not in this purse - never a reward paid twice.
 */
export function mergeProgress(local: PlayerProgress, remote: PlayerProgress): PlayerProgress {
  const primary = furtherAlong(local, remote) ? local : remote;
  const other = primary === local ? remote : local;

  const levels = { ...other.levels };
  for (const [id, result] of Object.entries(primary.levels)) {
    const theirs = levels[id];
    levels[id] = theirs ? mergeLevelResult(theirs, { stars: result.stars, moves: result.bestMoves }) : result;
  }

  const dailyTimes: Record<string, number> = { ...other.dailyTimes };
  for (const [day, ms] of Object.entries(primary.dailyTimes)) {
    dailyTimes[day] = dailyTimes[day] === undefined ? ms : Math.min(dailyTimes[day], ms);
  }

  // The Daily streak: whichever copy solved a Daily more recently knows
  // the streak as it stands.
  const daily = (primary.daily.lastCompletedKey ?? '') >= (other.daily.lastCompletedKey ?? '') ? primary.daily : other.daily;

  return {
    ...primary,
    levels,
    daily,
    bestDailyStreak: Math.max(primary.bestDailyStreak, other.bestDailyStreak, daily.streak),
    owned: union(primary.owned, other.owned),
    patron: primary.patron || other.patron,
    grandsSolved: union(primary.grandsSolved, other.grandsSolved),
    stampsClaimed: union(primary.stampsClaimed, other.stampsClaimed),
    chaptersClaimed: union(primary.chaptersClaimed, other.chaptersClaimed),
    setsClaimed: union(primary.setsClaimed, other.setsClaimed),
    // Built pieces stay built; the tiles in hand are running state.
    villa: union(primary.villa, other.villa),
    rankRewarded: Math.max(primary.rankRewarded, other.rankRewarded),
    errandsClaimed: Math.max(primary.errandsClaimed, other.errandsClaimed),
    introSeen: primary.introSeen || other.introSeen,
    dailyTimes,
  };
}

/** Whether `a` is further along than `b`: by level, then by puzzles solved.
 * A tie goes to `a`. */
function furtherAlong(a: PlayerProgress, b: PlayerProgress): boolean {
  if (a.currentLevel !== b.currentLevel) return a.currentLevel > b.currentLevel;
  return getCompletedCount(a) >= getCompletedCount(b);
}

function union<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): T[] {
  return [...new Set([...a, ...b])];
}

/** Whether a copy holds no play at all - a fresh install. */
export function isFresh(progress: PlayerProgress): boolean {
  return getCompletedCount(progress) === 0 && progress.owned.length === 0 && !progress.patron;
}

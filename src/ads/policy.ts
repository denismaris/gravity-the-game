/**
 * When Tessera may show an ad - written down as rules, in one place, so
 * "not too many ads" is a promise the code keeps rather than a feeling.
 *
 *  - Never inside a puzzle. A full-screen ad only ever appears between
 *    level sets, after the player has finished one and moves on.
 *  - Never for a new player: none until they have solved
 *    `minSolvedBeforeAds` puzzles, so the first sessions are ad-free.
 *  - At most one every `setsBetweenAds` finished sets, at least
 *    `minMinutesBetweenAds` apart, and no more than `maxPerDay` a day.
 *  - Never while the player has ad-free time from the shop.
 *  - Videos for coins are only ever the player's choice, a few a day.
 *
 * Pure: the ledger is plain data, kept on the phone by `src/ads/index.ts`.
 */

export const AD_RULES = {
  minSolvedBeforeAds: 10,
  setsBetweenAds: 2,
  minMinutesBetweenAds: 5,
  maxPerDay: 6,
  videoCoins: 20,
  /** Every rewarded video counts here - for coins or for Insight. */
  maxVideosPerDay: 6,
} as const;

export interface AdLedger {
  /** When the last full-screen ad was shown (ms), or 0. */
  readonly lastShownAt: number;
  /** The day the counts below are for (`YYYY-MM-DD`, local). */
  readonly dayKey: string;
  readonly shownToday: number;
  readonly videosToday: number;
  /** Sets finished since the last full-screen ad. */
  readonly setsSinceAd: number;
}

export const EMPTY_LEDGER: AdLedger = { lastShownAt: 0, dayKey: '', shownToday: 0, videosToday: 0, setsSinceAd: 0 };

/** The ledger with today's counts reset if it is from another day. */
export function onDay(ledger: AdLedger, dayKey: string): AdLedger {
  return ledger.dayKey === dayKey ? ledger : { ...ledger, dayKey, shownToday: 0, videosToday: 0 };
}

export interface BetweenSets {
  readonly now: number;
  readonly dayKey: string;
  /** Puzzles the player has ever solved. */
  readonly solved: number;
  /** Ad-free time from the shop is running. */
  readonly adFree: boolean;
}

/** A level set was just finished: counts it, and says whether an ad may
 * show now. The caller records the ad with `adShown` only if one actually
 * played (one may fail to load - then nothing is owed). */
export function setFinished(ledger: AdLedger, at: BetweenSets): { ledger: AdLedger; showAd: boolean } {
  const next = { ...onDay(ledger, at.dayKey), setsSinceAd: ledger.setsSinceAd + 1 };
  const showAd =
    !at.adFree &&
    at.solved >= AD_RULES.minSolvedBeforeAds &&
    next.setsSinceAd >= AD_RULES.setsBetweenAds &&
    next.shownToday < AD_RULES.maxPerDay &&
    at.now - next.lastShownAt >= AD_RULES.minMinutesBetweenAds * 60_000;
  return { ledger: next, showAd };
}

export function adShown(ledger: AdLedger, now: number, dayKey: string): AdLedger {
  const day = onDay(ledger, dayKey);
  return { ...day, lastShownAt: now, shownToday: day.shownToday + 1, setsSinceAd: 0 };
}

/** How many coin videos the player can still choose to watch today. */
export function videosLeft(ledger: AdLedger, dayKey: string): number {
  return Math.max(0, AD_RULES.maxVideosPerDay - onDay(ledger, dayKey).videosToday);
}

export function videoWatched(ledger: AdLedger, dayKey: string): AdLedger {
  const day = onDay(ledger, dayKey);
  return { ...day, videosToday: day.videosToday + 1 };
}

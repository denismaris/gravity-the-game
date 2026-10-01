import type { PlayerProgress } from './playerProgress';
import { LUCKY_CHARM_CHARGES, MAX_LUCKY_CHARGES } from './shop';

/**
 * The daily gift: something waiting every day the almanac is opened.
 *
 * Seven days make a week of gifts, each a little larger than the last,
 * and the seventh is the one worth coming back for: coins and a lucky
 * charm. Opening the app on consecutive days walks the week; a missed day
 * starts it again from the first. A player who has been away three days
 * or more is welcomed back with something extra on top, so returning
 * never feels like a penalty.
 *
 * Priced against the economy in `coins.ts`: a full week pays about 345
 * coins, roughly one good day of play, spread so no single gift is worth
 * more than playing.
 */

export const GIFT_COINS: ReadonlyArray<number> = [20, 25, 30, 40, 50, 60, 120];
export const GIFT_DAYS = GIFT_COINS.length;
/** Extra coins for coming back after `WELCOME_BACK_AFTER` days away. */
export const WELCOME_BACK_COINS = 100;
export const WELCOME_BACK_AFTER = 3;

export interface GiftLog {
  /** The day key of the last gift claimed, or '' if never. */
  readonly lastKey: string;
  /** Which day of the week that gift was, 1 to 7 (0 if never). */
  readonly day: number;
}

export const EMPTY_GIFT: GiftLog = { lastKey: '', day: 0 };

export interface Gift {
  /** 1 to 7. */
  readonly day: number;
  readonly coins: number;
  /** The seventh day's lucky charm. */
  readonly charm: boolean;
  /** Extra coins for a player returning after a break. */
  readonly welcomeBack: number;
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = Date.parse(`${fromKey}T00:00:00Z`);
  const b = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function previousKey(key: string): string {
  const d = new Date(Date.parse(`${key}T00:00:00Z`) - 86400000);
  return d.toISOString().slice(0, 10);
}

/** The gift for `dayKey` - or null if it has already been claimed. */
export function giftFor(progress: PlayerProgress, dayKey: string): Gift | null {
  const log = progress.gift;
  if (log.lastKey === dayKey) return null;
  const consecutive = log.lastKey !== '' && log.lastKey === previousKey(dayKey);
  const day = consecutive ? (log.day % GIFT_DAYS) + 1 : 1;
  const away = log.lastKey === '' ? 0 : daysBetween(log.lastKey, dayKey);
  return {
    day,
    coins: GIFT_COINS[day - 1],
    charm: day === GIFT_DAYS,
    welcomeBack: away >= WELCOME_BACK_AFTER ? WELCOME_BACK_COINS : 0,
  };
}

/** What tomorrow's gift will be, assuming today's is (or will be) claimed. */
export function tomorrowsGift(progress: PlayerProgress, dayKey: string): Gift {
  const today = giftFor(progress, dayKey);
  const day = today ? today.day : progress.gift.day;
  const next = (day % GIFT_DAYS) + 1;
  return { day: next, coins: GIFT_COINS[next - 1], charm: next === GIFT_DAYS, welcomeBack: 0 };
}

/** Claims today's gift. Null if there is none to claim. A seventh-day
 * charm that would overflow the charm cap pays its worth in coins. */
export function claimGift(progress: PlayerProgress, dayKey: string): { progress: PlayerProgress; gift: Gift } | null {
  const gift = giftFor(progress, dayKey);
  if (!gift) return null;
  let coins = progress.coins + gift.coins + gift.welcomeBack;
  let luckyCharges = progress.luckyCharges;
  if (gift.charm) {
    if (luckyCharges + LUCKY_CHARM_CHARGES <= MAX_LUCKY_CHARGES) luckyCharges += LUCKY_CHARM_CHARGES;
    else coins += 100;
  }
  return {
    progress: { ...progress, coins, luckyCharges, gift: { lastKey: dayKey, day: gift.day } },
    gift,
  };
}

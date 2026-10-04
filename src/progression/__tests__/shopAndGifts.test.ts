// Node's own modules, typed by hand: the app's tsconfig has no Node types.
const fs = require('fs') as { existsSync(path: string): boolean; readFileSync(path: string, encoding: 'utf8'): string };
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';
import { claimGift, GIFT_COINS, GIFT_DAYS, giftFor, tomorrowsGift, WELCOME_BACK_COINS } from '../gift';
import {
  COSMETIC_SETS,
  COSMETICS,
  buyCosmetic,
  claimSet,
  cosmeticById,
  featuredItem,
  inSeason,
  owns,
  seasonDaysLeft,
  seasonOf,
  seasonalItems,
  setProgress,
  unclaimedSets,
  LUCKY_CHARM_CHARGES,
  MAX_LUCKY_CHARGES,
  priceFor,
  buyAdFree,
  isAdFree,
} from '../shop';
import { COIN_PACKS, PATRON_COINS, applyPurchase } from '../store';

const ROOT = `${__dirname}/../../..`;
const rich = (): PlayerProgress => ({ ...emptyProgress(), coins: 100000 });

/** Claims the gift on each of `keys` in turn. */
function claimOn(progress: PlayerProgress, keys: string[]): PlayerProgress {
  return keys.reduce((p, key) => claimGift(p, key)!.progress, progress);
}

describe('the daily gift', () => {
  it('walks a week on consecutive days, the seventh paying coins and a lucky charm', () => {
    let p = emptyProgress();
    const coinsBefore = p.coins;
    for (let d = 1; d <= GIFT_DAYS; d += 1) {
      const key = `2026-10-${String(d).padStart(2, '0')}`;
      const gift = giftFor(p, key)!;
      expect(gift.day).toBe(d);
      expect(gift.charm).toBe(d === GIFT_DAYS);
      p = claimGift(p, key)!.progress;
    }
    expect(p.coins - coinsBefore).toBe(GIFT_COINS.reduce((a, b) => a + b, 0));
    expect(p.luckyCharges).toBe(LUCKY_CHARM_CHARGES);
    // The eighth day starts the next week.
    expect(giftFor(p, '2026-10-08')!.day).toBe(1);
  });

  it('is claimed once a day', () => {
    const p = claimOn(emptyProgress(), ['2026-10-01']);
    expect(giftFor(p, '2026-10-01')).toBeNull();
    expect(claimGift(p, '2026-10-01')).toBeNull();
  });

  it('starts the week again after a missed day', () => {
    const p = claimOn(emptyProgress(), ['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(giftFor(p, '2026-10-05')!.day).toBe(1);
  });

  it('welcomes back a player who has been away three days or more', () => {
    const p = claimOn(emptyProgress(), ['2026-10-01']);
    expect(giftFor(p, '2026-10-03')!.welcomeBack).toBe(0);
    expect(giftFor(p, '2026-10-04')!.welcomeBack).toBe(WELCOME_BACK_COINS);
    // A brand-new player is not "back".
    expect(giftFor(emptyProgress(), '2026-10-01')!.welcomeBack).toBe(0);
  });

  it('pays a full charm cap in coins instead of overflowing it', () => {
    const keys = Array.from({ length: 6 }, (_v, i) => `2026-10-0${i + 1}`);
    const p = { ...claimOn(emptyProgress(), keys), luckyCharges: MAX_LUCKY_CHARGES };
    const out = claimGift(p, '2026-10-07')!;
    expect(out.progress.luckyCharges).toBe(MAX_LUCKY_CHARGES);
    expect(out.progress.coins - p.coins).toBe(GIFT_COINS[6] + 100);
  });

  it("says what tomorrow's gift is, before and after today's is claimed", () => {
    const p = claimOn(emptyProgress(), ['2026-10-01']);
    expect(tomorrowsGift(p, '2026-10-02').day).toBe(3);
    expect(tomorrowsGift(claimOn(p, ['2026-10-02']), '2026-10-02').day).toBe(3);
  });

  it('survives a save round-trip, and a damaged one reads as a fresh week', () => {
    const p = claimOn(emptyProgress(), ['2026-10-01', '2026-10-02']);
    expect(parseProgress(JSON.stringify(p)).gift).toEqual({ lastKey: '2026-10-02', day: 2 });
    expect(parseProgress(JSON.stringify({ ...p, gift: { lastKey: 'soon', day: 99 } })).gift).toEqual({ lastKey: '', day: 0 });
  });
});

describe('the seasons', () => {
  it('follows the calendar month', () => {
    expect(seasonOf(new Date('2026-03-01T12:00:00Z'))).toBe('spring');
    expect(seasonOf(new Date('2026-08-31T12:00:00Z'))).toBe('summer');
    expect(seasonOf(new Date('2026-10-01T12:00:00Z'))).toBe('autumn');
    expect(seasonOf(new Date('2026-12-01T12:00:00Z'))).toBe('winter');
    expect(seasonOf(new Date('2027-02-28T12:00:00Z'))).toBe('winter');
  });

  it('counts the days left, across a year end', () => {
    expect(seasonDaysLeft(new Date('2026-10-01T12:00:00Z'))).toBe(61);
    expect(seasonDaysLeft(new Date('2026-11-30T12:00:00Z'))).toBe(1);
    expect(seasonDaysLeft(new Date('2026-12-31T12:00:00Z'))).toBe(60);
  });

  it('sells three pieces each season, and only in that season', () => {
    const autumn = new Date('2026-10-01T12:00:00Z');
    const spring = new Date('2027-04-01T12:00:00Z');
    for (const date of [autumn, spring, new Date('2026-07-01T12:00:00Z'), new Date('2027-01-01T12:00:00Z')]) {
      expect(seasonalItems(date)).toHaveLength(3);
    }
    const maple = cosmeticById('garden-maple')!;
    expect(inSeason(maple, autumn)).toBe(true);
    expect(buyCosmetic(rich(), 'garden-maple', autumn)).not.toBeNull();
    expect(buyCosmetic(rich(), 'garden-maple', spring)).toBeNull();
    // Bought in season, kept for good.
    const bought = buyCosmetic(rich(), 'garden-maple', autumn)!;
    expect(owns(bought, 'garden-maple')).toBe(true);
  });

  it('never features a seasonal piece, so the feature cannot vanish mid-season', () => {
    for (let d = 0; d < 400; d += 1) {
      expect(featuredItem(new Date(Date.UTC(2026, 0, 1 + d))).season).toBeUndefined();
    }
  });
});

describe('streak prizes', () => {
  it('belong to whoever has reached the streak, and are never sold', () => {
    const prizes = COSMETICS.filter(item => item.streak !== undefined);
    expect(prizes.map(item => item.streak)).toEqual([7, 30, 100]);
    for (const prize of prizes) {
      expect(owns({ ...rich(), bestDailyStreak: prize.streak! - 1 }, prize.id)).toBe(false);
      expect(owns({ ...rich(), bestDailyStreak: prize.streak! }, prize.id)).toBe(true);
      expect(buyCosmetic(rich(), prize.id)).toBeNull();
    }
  });
});

describe('sets', () => {
  it('are made of real pieces, and pay back about a tenth of what they cost', () => {
    for (const set of COSMETIC_SETS) {
      const items = set.items.map(id => cosmeticById(id));
      expect(items.every(Boolean)).toBe(true);
      const cost = items.reduce((sum, item) => sum + item!.price, 0);
      expect(set.reward / cost).toBeGreaterThan(0.08);
      expect(set.reward / cost).toBeLessThan(0.2);
    }
  });

  it('pay their bonus once, and only when complete', () => {
    const set = COSMETIC_SETS[0];
    const partial = { ...rich(), owned: set.items.slice(1) };
    expect(claimSet(partial, set.id)).toBeNull();
    const full = { ...rich(), owned: [...set.items] };
    expect(unclaimedSets(full).map(s => s.id)).toContain(set.id);
    const paid = claimSet(full, set.id)!;
    expect(paid.coins - full.coins).toBe(set.reward);
    expect(setProgress(paid, set).claimed).toBe(true);
    expect(claimSet(paid, set.id)).toBeNull();
    expect(parseProgress(JSON.stringify(paid)).setsClaimed).toEqual([set.id]);
  });
});

describe('the catalogue', () => {
  it('has unique ids', () => {
    expect(new Set(COSMETICS.map(item => item.id)).size).toBe(COSMETICS.length);
  });

  it("bundles every chime's sound on both platforms", () => {
    const pbx = fs.readFileSync(`${ROOT}/ios/GravityInit.xcodeproj/project.pbxproj`, 'utf8');
    for (const item of COSMETICS.filter(c => c.slot === 'chime' && c.sound)) {
      expect(fs.existsSync(`${ROOT}/ios/GravityInit/Sounds/${item.sound}`)).toBe(true);
      expect(fs.existsSync(`${ROOT}/android/app/src/main/res/raw/${item.sound}`)).toBe(true);
      expect(pbx).toContain(item.sound!);
    }
  });
});

describe('the store (simulated for now)', () => {
  it('adds a coin pack to the purse, every time it is bought', () => {
    const p = emptyProgress();
    const once = applyPurchase(p, 'coins-purse')!;
    expect(once.coins - p.coins).toBe(COIN_PACKS.find(pack => pack.id === 'coins-purse')!.coins);
    expect(applyPurchase(once, 'coins-purse')!.coins - once.coins).toBe(1500);
  });

  it('sells the Patron pass once, with its coins and its pieces', () => {
    const p = emptyProgress();
    expect(owns(p, 'confetti-gilt')).toBe(false);
    const patron = applyPurchase(p, 'patron')!;
    expect(patron.patron).toBe(true);
    expect(patron.coins - p.coins).toBe(PATRON_COINS);
    expect(owns(patron, 'confetti-gilt')).toBe(true);
    expect(owns(patron, 'chime-patron')).toBe(true);
    expect(applyPurchase(patron, 'patron')).toBeNull();
    expect(parseProgress(JSON.stringify(patron)).patron).toBe(true);
    // Patron pieces are never for sale.
    expect(buyCosmetic(rich(), 'confetti-gilt')).toBeNull();
  });

  it("halves this season's prices for a Patron, and nothing else", () => {
    const autumn = new Date('2026-10-01T12:00:00Z');
    const maple = cosmeticById('garden-maple')!;
    const patron = { ...rich(), patron: true };
    const half = Math.round(maple.price / 20) * 10; // half, to the nearest 10
    expect(priceFor(maple, autumn, patron)).toBe(half);
    expect(priceFor(maple, autumn, rich())).toBe(maple.price);
    const plain = COSMETICS.find(item => item.price > 0 && !item.season && featuredItem(autumn).id !== item.id)!;
    expect(priceFor(plain, autumn, patron)).toBe(plain.price);
    expect(buyCosmetic(patron, 'garden-maple', autumn)!.coins).toBe(patron.coins - half);
  });
});

describe('ad-free time', () => {
  it('runs from now, and buying more extends it', () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const day = buyAdFree({ ...rich(), adFreeUntil: null }, 'day', now)!;
    expect(day.adFreeUntil).toBe(now + 24 * 3600000);
    expect(isAdFree(day, now + 3600000)).toBe(true);
    const more = buyAdFree(day, 'week', now + 3600000)!;
    expect(more.adFreeUntil).toBe(now + 24 * 3600000 + 7 * 24 * 3600000);
    expect(isAdFree(more, more.adFreeUntil! + 1)).toBe(false);
    expect(more.coins).toBe(rich().coins - 300 - 1600);
  });

  it('costs coins the player has, and survives a save', () => {
    expect(buyAdFree({ ...rich(), coins: 100 }, 'day')).toBeNull();
    const p = buyAdFree(rich(), 'month', 1000)!;
    expect(parseProgress(JSON.stringify(p)).adFreeUntil).toBe(p.adFreeUntil);
  });
});

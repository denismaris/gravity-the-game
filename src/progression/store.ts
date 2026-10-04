import type { PlayerProgress } from './playerProgress';

/**
 * Things bought with real money: coin packs and the one-time Patron pass.
 *
 * TEMPORARY: purchases are simulated. `purchase` waits a moment and
 * reports success, and no money changes hands. When the App Store and
 * Google Play are connected, only `purchase` and `restorePurchases`
 * change (to call the store and verify its receipt); the products and
 * `applyPurchase` stay as they are.
 */
export const STORE_SIMULATED = true;

/** Whether the app sells anything for real money. Off for the first
 * release: no coin packs, no Patron pass, no "get more coins" anywhere -
 * coins come from playing only. Turning it back on brings the Coins tab,
 * the Patron card and the purse's "+" back as they were. */
export const PURCHASES_ENABLED = false;

export type ProductId = 'coins-pouch' | 'coins-purse' | 'coins-chest' | 'coins-vault' | 'patron';

export interface CoinPack {
  readonly id: ProductId;
  readonly name: string;
  readonly coins: number;
  /** Percent extra over the Pouch's rate, for the card. */
  readonly bonus: number;
  /** Placeholder until the store reports the local price. */
  readonly price: string;
  readonly tag?: string;
}

export const COIN_PACKS: ReadonlyArray<CoinPack> = [
  { id: 'coins-pouch', name: 'Pouch', coins: 600, bonus: 0, price: '$0.99' },
  { id: 'coins-purse', name: 'Purse', coins: 1500, bonus: 25, price: '$1.99' },
  { id: 'coins-chest', name: 'Chest', coins: 3600, bonus: 50, price: '$3.99', tag: 'MOST POPULAR' },
  { id: 'coins-vault', name: 'Vault', coins: 9000, bonus: 65, price: '$8.99', tag: 'BEST VALUE' },
];

export const PATRON_PRICE = '$4.99';
export const PATRON_COINS = 4000;
/** What a Patron pays for this season's pieces. */
export const PATRON_SEASON_DISCOUNT = 0.5;

/** What a completed purchase gives. Null if it gives nothing (a second
 * Patron pass, an unknown product). */
export function applyPurchase(progress: PlayerProgress, id: ProductId): PlayerProgress | null {
  if (id === 'patron') {
    if (progress.patron) return null;
    return { ...progress, patron: true, coins: progress.coins + PATRON_COINS };
  }
  const pack = COIN_PACKS.find(p => p.id === id);
  if (!pack) return null;
  return { ...progress, coins: progress.coins + pack.coins };
}

const SIMULATED_DELAY_MS = 900;

/** Asks the store to sell `id`. Resolves true once paid for. */
export function purchase(_id: ProductId): Promise<boolean> {
  return new Promise(resolve => setTimeout(() => resolve(true), SIMULATED_DELAY_MS));
}

/** Asks the store for one-time purchases made on another device. The
 * simulated store has none: the save already holds everything bought. */
export function restorePurchases(): Promise<ReadonlyArray<ProductId>> {
  return new Promise(resolve => setTimeout(() => resolve([]), SIMULATED_DELAY_MS));
}

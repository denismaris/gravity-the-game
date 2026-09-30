import { GameKind } from '../game/journey';
import { PlayerProgress } from './playerProgress';

/**
 * The shop: what coins are *for*. Cosmetics that change how the almanac
 * looks and celebrates - never anything that makes a puzzle easier - and
 * one consumable, the streak freeze.
 *
 * Every slot has a free default that is always owned, so a player who
 * never spends a coin loses nothing. Some items are also the reward for
 * finishing a chapter (see `chapters.ts`); those can still be bought early.
 */

/** A game's own look: its pieces, lamps, beams or glazes. */
export type SkinGame = Exclude<GameKind, 'bridges'>;
export const SKIN_GAMES: ReadonlyArray<SkinGame> = ['gravity', 'mirror', 'tents', 'towers', 'binairo', 'arukone', 'fillapix', 'lightsout', 'adjacent', 'bloom', 'mosaic'];
/** Bridges' look is its chart (the `chart` slot) - it had one first. */
export type CosmeticSlot = 'confetti' | 'ball' | 'chart' | 'garden' | `skin-${SkinGame}`;
export const COSMETIC_SLOTS: ReadonlyArray<CosmeticSlot> = ['confetti', 'ball', 'chart', 'garden', ...SKIN_GAMES.map(g => `skin-${g}` as const)];

export function skinSlot(game: GameKind): CosmeticSlot {
  return game === 'bridges' ? 'chart' : `skin-${game}`;
}

/** Four tiers, priced against what play actually earns: a player who
 * works through three level sets, the Daily and the errands collects
 * roughly 350 coins a day. A Common piece is about a day of that, Fine
 * two, Rare three, and a Masterwork most of a week - something to save
 * for, not something that falls into your lap. */
export type Rarity = 'common' | 'fine' | 'rare' | 'masterwork';
export const RARITY_PRICES: Readonly<Record<Rarity, number>> = { common: 350, fine: 600, rare: 900, masterwork: 1500 };
export const RARITY_NAMES: Readonly<Record<Rarity, string>> = { common: 'Common', fine: 'Fine', rare: 'Rare', masterwork: 'Masterwork' };

export function rarityOf(item: Cosmetic): Rarity | null {
  if (item.price <= 0) return null;
  if (item.price >= RARITY_PRICES.masterwork) return 'masterwork';
  if (item.price >= RARITY_PRICES.rare) return 'rare';
  if (item.price >= RARITY_PRICES.fine) return 'fine';
  return 'common';
}

export interface Cosmetic {
  readonly id: string;
  readonly slot: CosmeticSlot;
  readonly name: string;
  readonly blurb: string;
  readonly price: number;
  /** The colours that make it what it is - read by whatever draws it. */
  readonly colors: ReadonlyArray<string>;
  /** Never sold: won in the Weekly Grand (see `grand.ts`). */
  readonly exclusive?: true;
  /** A game skin: the palette tokens it repaints while worn (see
   * `skinOverrides`), with its own values by night where they differ. */
  readonly tokens?: Readonly<Record<string, string>>;
  readonly darkTokens?: Readonly<Record<string, string>>;
}

/** The default in each slot - owned from the start, never sold. */
export const DEFAULT_EQUIPPED: Readonly<Record<CosmeticSlot, string>> = {
  confetti: 'confetti-almanac',
  ball: 'ball-violet',
  chart: 'chart-day',
  garden: 'garden-terracotta',
  ...(Object.fromEntries(SKIN_GAMES.map(g => [`skin-${g}`, `skin-${g}-classic`])) as Record<`skin-${SkinGame}`, string>),
};

const { common, fine, rare, masterwork } = RARITY_PRICES;

/** One game's Classic look (free, the game as designed) and its two skins. */
function skins(game: SkinGame, classic: string, items: ReadonlyArray<Omit<Cosmetic, 'slot'>>): Cosmetic[] {
  const slot = `skin-${game}` as const;
  return [{ id: `skin-${game}-classic`, slot, name: 'Classic', blurb: classic, price: 0, colors: [] }, ...items.map(item => ({ ...item, slot }))];
}

export const COSMETICS: ReadonlyArray<Cosmetic> = [
  // Solve confetti - the burst behind every solved card, in every game.
  { id: 'confetti-almanac', slot: 'confetti', name: 'Almanac', blurb: 'The house colours.', price: 0, colors: ['#C46C33', '#B7892F', '#5C7C4A', '#3F6FA0'] },
  { id: 'confetti-gold', slot: 'confetti', name: 'Gold Leaf', blurb: 'A shower of gilt.', price: common, colors: ['#E3B341', '#C99422', '#F3D98A', '#A77912'] },
  { id: 'confetti-blossom', slot: 'confetti', name: 'Blossom', blurb: 'Petals on the wind.', price: fine, colors: ['#E58FA4', '#F4C2CF', '#C8506A', '#FBE3E9'] },
  { id: 'confetti-harbour', slot: 'confetti', name: 'Harbour', blurb: 'Sea spray and sails.', price: fine, colors: ['#1683A6', '#7CC4D8', '#F6EBCB', '#2F5DAF'] },
  { id: 'confetti-starlight', slot: 'confetti', name: 'Starlight', blurb: 'Midnight and silver.', price: rare, colors: ['#3B1F52', '#9A86C2', '#E9E3F5', '#B7892F'] },
  { id: 'confetti-aurora', slot: 'confetti', name: 'Aurora', blurb: 'The northern sky, falling.', price: masterwork, colors: ['#6FE3D4', '#9B7ED0', '#F59BB5', '#F5C95E'] },
  // The relaxation break's marble: [rim, body, core, band].
  { id: 'ball-violet', slot: 'ball', name: 'Violet', blurb: 'The original marble.', price: 0, colors: ['#3B1F52', '#6E4B8E', '#A68BC4', '#F6EBCB'] },
  { id: 'ball-coral', slot: 'ball', name: 'Coral', blurb: 'Warm as the hearth.', price: common, colors: ['#8E3A1C', '#C4602F', '#EDA077', '#FFE7D2'] },
  { id: 'ball-jade', slot: 'ball', name: 'Jade', blurb: 'Cool polished stone.', price: common, colors: ['#1F5A45', '#3D8A6A', '#86C4A5', '#E6F5EC'] },
  { id: 'ball-gold', slot: 'ball', name: 'Gold', blurb: 'Heavy, bright, lucky.', price: fine, colors: ['#7A5510', '#B7892F', '#E8C66E', '#FFF4D0'] },
  { id: 'ball-pearl', slot: 'ball', name: 'Pearl', blurb: 'Soft sheen from the deep.', price: fine, colors: ['#8D8497', '#C9C1D2', '#EFEAF4', '#FFFFFF'] },
  { id: 'ball-obsidian', slot: 'ball', name: 'Obsidian', blurb: 'Volcanic glass.', price: rare, colors: ['#121016', '#2B2733', '#57506A', '#C8BEDC'] },
  { id: 'ball-opal', slot: 'ball', name: 'Opal', blurb: 'Every colour at once.', price: masterwork, colors: ['#4F6E7E', '#8FBBC8', '#E4F4F0', '#FFD9EA'] },
  // Bridges' chart: [water, contour, survey dot, neatline, mat].
  { id: 'chart-day', slot: 'chart', name: 'Day Chart', blurb: 'Pale water, clear skies.', price: 0, colors: ['#D8E8EA', '#BBD5DA', '#B6D0D5', '#3B1F52', '#FFFDF8'] },
  { id: 'chart-tropic', slot: 'chart', name: 'Tropic', blurb: 'Lagoon turquoise.', price: fine, colors: ['#BDE8E1', '#8FD3C9', '#96D2C9', '#1D6E63', '#FFFDF8'] },
  { id: 'chart-night', slot: 'chart', name: 'Night Chart', blurb: 'Islands by lantern light.', price: rare, colors: ['#243B52', '#34526E', '#3F5F7C', '#E9DCC0', '#17263A'] },
  { id: 'chart-arctic', slot: 'chart', name: 'Arctic', blurb: 'Ice floes and still water.', price: rare, colors: ['#E3EEF6', '#C6D9E8', '#BCD2E4', '#2E4A6B', '#FFFFFF'] },
  // Page art: the blossom in the corner of every screen: [blossom].
  { id: 'garden-terracotta', slot: 'garden', name: 'Terracotta', blurb: 'The almanac as printed.', price: 0, colors: ['#C46C33'] },
  { id: 'garden-camellia', slot: 'garden', name: 'Camellia', blurb: 'Deep rose, early spring.', price: fine, colors: ['#C8506A'] },
  { id: 'garden-marigold', slot: 'garden', name: 'Marigold', blurb: 'High-summer gold.', price: fine, colors: ['#D9A032'] },
  { id: 'garden-sage', slot: 'garden', name: 'Sage', blurb: 'A quiet herb garden.', price: fine, colors: ['#7FA36A'] },
  { id: 'garden-hydrangea', slot: 'garden', name: 'Hydrangea', blurb: 'Cool blue by the sea.', price: rare, colors: ['#6F8FD6'] },
  // Won, not bought: the Weekly Grand's rewards.
  { id: 'confetti-laurel', slot: 'confetti', name: 'Laurel', blurb: 'For a Grand, solved.', price: 0, exclusive: true, colors: ['#2E5E3A', '#B7892F', '#E8C66E', '#6E9B5A'] },
  { id: 'garden-orchid', slot: 'garden', name: 'Orchid', blurb: 'Rare, and grown slowly.', price: 0, exclusive: true, colors: ['#8E5BB5'] },
  { id: 'ball-meteorite', slot: 'ball', name: 'Meteorite', blurb: 'Fell from a hard week.', price: 0, exclusive: true, colors: ['#2A1E16', '#5E4632', '#A98458', '#F2D9A8'] },
  { id: 'chart-admiralty', slot: 'chart', name: 'Admiralty', blurb: 'Sepia, for old sea dogs.', price: 0, exclusive: true, colors: ['#E6DBC2', '#D2C29E', '#CBB994', '#6B2D2D', '#FFFBF1'] },

  // --- Game skins: every game's own pieces, in new materials. ---
  ...skins('gravity', 'Blue glass pieces.', [
    { id: 'skin-gravity-ember', name: 'Ember', blurb: 'Pieces fired in the kiln.', price: common, colors: ['#C4602F'], tokens: { pieceBlue: '#C4602F' }, darkTokens: { pieceBlue: '#E08452' } },
    { id: 'skin-gravity-jade', name: 'Jade', blurb: 'Polished green stone.', price: fine, colors: ['#2F8A5E'], tokens: { pieceBlue: '#2F8A5E' }, darkTokens: { pieceBlue: '#5CB88A' } },
  ]),
  ...skins('mirror', 'A silver-blue beam.', [
    { id: 'skin-mirror-rose', name: 'Rose Beam', blurb: 'Light through a pink pane.', price: fine, colors: ['#E98AA8', '#FFF0F4'], tokens: { mirrorBeamGlow: '#E98AA8', mirrorBeamCore: '#FFF0F4' } },
    { id: 'skin-mirror-emerald', name: 'Emerald Beam', blurb: 'A lighthouse at sea.', price: rare, colors: ['#63CF97', '#F0FFF6'], tokens: { mirrorBeamGlow: '#63CF97', mirrorBeamCore: '#F0FFF6' } },
  ]),
  ...skins('tents', 'Green canvas.', [
    { id: 'skin-tents-ochre', name: 'Ochre Canvas', blurb: 'Tents the colour of wheat.', price: common, colors: ['#D9A441', '#A8761F'], tokens: { tentLight: '#D9A441', tentDark: '#A8761F' } },
    { id: 'skin-tents-ember', name: 'Ember Canvas', blurb: 'Red tents in the pines.', price: fine, colors: ['#D0664F', '#9A3F2E'], tokens: { tentLight: '#D0664F', tentDark: '#9A3F2E' } },
  ]),
  ...skins('towers', 'Violet towers, golden windows.', [
    { id: 'skin-towers-neon', name: 'Neon Windows', blurb: 'A city that never sleeps.', price: fine, colors: ['#452963', '#6FE3D4'], tokens: { towersWindow: '#6FE3D4' } },
    { id: 'skin-towers-midnight', name: 'Midnight Blue', blurb: 'Steel towers, warm lamps.', price: rare, colors: ['#23385E', '#F5C95E'], tokens: { towersBuilding: '#23385E', towersBuildingRoof: '#3C5A8C' } },
  ]),
  ...skins('binairo', 'Terracotta and teal.', [
    { id: 'skin-binairo-gold', name: 'Gold & Ink', blurb: 'A ledger in gilt and violet.', price: fine, colors: ['#C99422', '#5B3B8C'], tokens: { binairoMarkFilled: '#C99422', binairoMarkFilledLight: '#E8C66E', binairoMarkFilledDark: '#8A6414', binairoMarkOutline: '#5B3B8C', binairoMarkOutlineLight: '#8D6FC0', binairoMarkOutlineDark: '#34205A' } },
    { id: 'skin-binairo-berry', name: 'Berry & Sage', blurb: 'Summer fruit on green.', price: rare, colors: ['#B83A5E', '#5E8B4E'], tokens: { binairoMarkFilled: '#B83A5E', binairoMarkFilledLight: '#E07A96', binairoMarkFilledDark: '#7A1E3A', binairoMarkOutline: '#5E8B4E', binairoMarkOutlineLight: '#8DB87A', binairoMarkOutlineDark: '#35572B' } },
  ]),
  ...skins('arukone', 'Wine-red cords.', [
    { id: 'skin-arukone-indigo', name: 'Indigo Cords', blurb: 'Dyed in deep blue.', price: common, colors: ['#3E5CB0'], tokens: { arukoneAccent: '#3E5CB0' }, darkTokens: { arukoneAccent: '#7B93E0' } },
    { id: 'skin-arukone-copper', name: 'Copper Wire', blurb: 'Bright, bent metal.', price: fine, colors: ['#B8683A'], tokens: { arukoneAccent: '#B8683A' }, darkTokens: { arukoneAccent: '#E0955F' } },
  ]),
  ...skins('fillapix', 'Deep teal ink.', [
    { id: 'skin-fillapix-violet', name: 'Violet Ink', blurb: 'Pictures in the house colour.', price: common, colors: ['#5B3B8C'], tokens: { fillapixAccent: '#5B3B8C' }, darkTokens: { fillapixAccent: '#9C82D4' } },
    { id: 'skin-fillapix-ember', name: 'Ember Ink', blurb: 'Warm as a woodcut.', price: fine, colors: ['#C4602F'], tokens: { fillapixAccent: '#C4602F' }, darkTokens: { fillapixAccent: '#E08A52' } },
  ]),
  ...skins('lightsout', 'Warm golden lamps.', [
    { id: 'skin-lightsout-ice', name: 'Ice Lamps', blurb: 'Cold blue light.', price: fine, colors: ['#9FD8FF', '#EAF7FF'], tokens: { lightsOutLit: '#9FD8FF', lightsOutLitCore: '#EAF7FF' } },
    { id: 'skin-lightsout-rose', name: 'Rose Lanterns', blurb: 'Paper lanterns at a festival.', price: rare, colors: ['#FF9DBB', '#FFF0F5'], tokens: { lightsOutLit: '#FF9DBB', lightsOutLitCore: '#FFF0F5' } },
  ]),
  ...skins('adjacent', 'Five kiln glazes.', [
    { id: 'skin-adjacent-pastel', name: 'Pastel Kiln', blurb: 'Soft, chalky glazes.', price: fine, colors: ['#E39A7B', '#E3C56A', '#8CC49A', '#86A9D9', '#B69AD9'], tokens: { adjacentTile0: '#E39A7B', adjacentTile1: '#E3C56A', adjacentTile2: '#8CC49A', adjacentTile3: '#86A9D9', adjacentTile4: '#B69AD9' } },
    { id: 'skin-adjacent-jewel', name: 'Jewel Box', blurb: 'Ruby, topaz, emerald, sapphire, amethyst.', price: rare, colors: ['#B8325A', '#D9A21F', '#1F8A6E', '#2F5DAF', '#7A3FA8'], tokens: { adjacentTile0: '#B8325A', adjacentTile1: '#D9A21F', adjacentTile2: '#1F8A6E', adjacentTile3: '#2F5DAF', adjacentTile4: '#7A3FA8' } },
  ]),
  ...skins('bloom', 'Camellia-rose flowers.', [
    { id: 'skin-bloom-lavender', name: 'Lavender', blurb: 'A field in Provence.', price: common, colors: ['#8E6FC7'], tokens: { bloomAccent: '#8E6FC7' }, darkTokens: { bloomAccent: '#B49BE6' } },
    { id: 'skin-bloom-marigold', name: 'Marigold', blurb: 'Gold heads in summer.', price: fine, colors: ['#D9A032'], tokens: { bloomAccent: '#D9A032' }, darkTokens: { bloomAccent: '#E8B85A' } },
  ]),
  ...skins('mosaic', 'A sand-coloured grout bed.', [
    { id: 'skin-mosaic-marble', name: 'Marble Bed', blurb: 'Tiles set in white stone.', price: fine, colors: ['#ECE8E2', '#D6D0C8'], tokens: { mosaicSocket: '#EEEAE4', mosaicGrout: '#D8D2CA', mosaicSlabEdge: '#B9B1A7', mosaicSocketWall: '#D1CAC1' }, darkTokens: { mosaicSocket: '#34313B', mosaicGrout: '#28252E', mosaicSlabEdge: '#121016', mosaicSocketWall: '#211E27' } },
    { id: 'skin-mosaic-slate', name: 'Slate Bed', blurb: 'Tiles set in blue-grey slate.', price: rare, colors: ['#E8E9EC', '#C4CAD2'], tokens: { mosaicSocket: '#E8E9EC', mosaicGrout: '#C4CAD2', mosaicSlabEdge: '#8D98A4', mosaicSocketWall: '#BCC3CC' }, darkTokens: { mosaicSocket: '#262C36', mosaicGrout: '#1D222A', mosaicSlabEdge: '#0B0E12', mosaicSocketWall: '#181C23' } },
  ]),
];

/** The palette tokens every worn game skin repaints - by day, and by
 * night where the skin says otherwise. */
export function skinOverrides(progress: PlayerProgress): { light: Record<string, string>; dark: Record<string, string> } {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const game of SKIN_GAMES) {
    const item = equipped(progress, `skin-${game}`);
    Object.assign(light, item.tokens ?? {});
    Object.assign(dark, item.tokens ?? {}, item.darkTokens ?? {});
  }
  return { light, dark };
}

export const STREAK_FREEZE_PRICE = 100;
export const MAX_STREAK_FREEZES = 3;

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find(item => item.id === id);
}

export function cosmeticsFor(slot: CosmeticSlot): ReadonlyArray<Cosmetic> {
  return COSMETICS.filter(item => item.slot === slot);
}

export function owns(progress: PlayerProgress, id: string): boolean {
  const item = cosmeticById(id);
  return item !== undefined && ((item.price === 0 && !item.exclusive) || progress.owned.includes(id));
}

/** The item worn in `slot` - falling back to the default if the save
 * names something that no longer exists or was never owned. */
export function equipped(progress: PlayerProgress, slot: CosmeticSlot): Cosmetic {
  const id = progress.equipped[slot];
  const item = id ? cosmeticById(id) : undefined;
  if (item && item.slot === slot && owns(progress, item.id)) return item;
  return cosmeticById(DEFAULT_EQUIPPED[slot])!;
}

/** Buys an item and puts it on at once. Null if it cannot be bought (not
 * for sale, already owned, or too dear). */
export function buyCosmetic(progress: PlayerProgress, id: string): PlayerProgress | null {
  const item = cosmeticById(id);
  if (!item || item.price === 0 || owns(progress, id) || progress.coins < item.price) return null;
  return {
    ...progress,
    coins: progress.coins - item.price,
    owned: [...progress.owned, id],
    equipped: { ...progress.equipped, [item.slot]: id },
  };
}

/** Gives an item for free (a chapter reward). Owning it already is fine. */
export function grantCosmetic(progress: PlayerProgress, id: string): PlayerProgress {
  const item = cosmeticById(id);
  if (!item || owns(progress, id)) return progress;
  return { ...progress, owned: [...progress.owned, id] };
}

export function equipCosmetic(progress: PlayerProgress, id: string): PlayerProgress {
  const item = cosmeticById(id);
  if (!item || !owns(progress, id) || progress.equipped[item.slot] === id) return progress;
  return { ...progress, equipped: { ...progress.equipped, [item.slot]: id } };
}

export function buyStreakFreeze(progress: PlayerProgress): PlayerProgress | null {
  if (progress.streakFreezes >= MAX_STREAK_FREEZES || progress.coins < STREAK_FREEZE_PRICE) return null;
  return { ...progress, coins: progress.coins - STREAK_FREEZE_PRICE, streakFreezes: progress.streakFreezes + 1 };
}

// ---------------------------------------------------------------------------
// Passes: the shop's non-cosmetic items. None of them solves anything for
// the player - they shape *what* gets played, and how well it pays.
// ---------------------------------------------------------------------------

/** At most this many games can be retired - the almanac stays an almanac. */
export const MAX_RETIRED = 3;
/** Retiring gets dearer with each game already retired. Bringing one back
 * is free (the coins are not refunded). */
export const RETIRE_PRICES: ReadonlyArray<number> = [500, 800, 1200];

export function retirePrice(progress: PlayerProgress): number | null {
  return progress.retired.length >= MAX_RETIRED ? null : RETIRE_PRICES[progress.retired.length];
}

export function retireGame(progress: PlayerProgress, kind: GameKind): PlayerProgress | null {
  const price = retirePrice(progress);
  if (price === null || progress.retired.includes(kind) || progress.coins < price) return null;
  return { ...progress, coins: progress.coins - price, retired: [...progress.retired, kind] };
}

export function reinstateGame(progress: PlayerProgress, kind: GameKind): PlayerProgress {
  if (!progress.retired.includes(kind)) return progress;
  return { ...progress, retired: progress.retired.filter(k => k !== kind) };
}

/** The lucky charm: the next few solves that pay anything pay double. */
export const LUCKY_CHARM_PRICE = 200;
export const LUCKY_CHARM_CHARGES = 8;
export const MAX_LUCKY_CHARGES = 24;

export function buyLuckyCharm(progress: PlayerProgress): PlayerProgress | null {
  if (progress.coins < LUCKY_CHARM_PRICE || progress.luckyCharges + LUCKY_CHARM_CHARGES > MAX_LUCKY_CHARGES) return null;
  return { ...progress, coins: progress.coins - LUCKY_CHARM_PRICE, luckyCharges: progress.luckyCharges + LUCKY_CHARM_CHARGES };
}

/** Swapping the puzzle a player is stuck on for another game's. */
export const SWAP_PRICE = 100;

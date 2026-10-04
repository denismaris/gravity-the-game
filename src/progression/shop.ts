import { GameKind, dailyKeyOf } from '../game/journey';
import { PlayerProgress } from './playerProgress';
import { PATRON_SEASON_DISCOUNT } from './store';

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
export type CosmeticSlot = 'confetti' | 'ball' | 'chart' | 'garden' | 'chime' | `skin-${SkinGame}`;
export const COSMETIC_SLOTS: ReadonlyArray<CosmeticSlot> = ['confetti', 'ball', 'chart', 'garden', 'chime', ...SKIN_GAMES.map(g => `skin-${g}` as const)];

/** The four seasons, by the calendar month (northern hemisphere, like the
 * almanac's own moon). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASON_NAMES: Readonly<Record<Season, string>> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

export function skinSlot(game: GameKind): CosmeticSlot {
  return game === 'bridges' ? 'chart' : `skin-${game}`;
}

/** Four tiers, priced against what play actually earns. A regular player
 * (ten puzzles, the Daily, three errands, the gift and a couple of
 * optional videos) collects about 450 coins a day; a casual one about 250,
 * a devoted one about 900. A Common
 * piece is about a regular day, Fine two, Rare three, and a Masterwork
 * most of a week - something to save for, not something that falls into
 * your lap. */
export type Rarity = 'common' | 'fine' | 'rare' | 'masterwork';
export const RARITY_PRICES: Readonly<Record<Rarity, number>> = { common: 450, fine: 850, rare: 1350, masterwork: 2700 };
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
  /** Sold only in this season; owned for good once bought. */
  readonly season?: Season;
  /** Never sold: earned by reaching a Daily streak this long. */
  readonly streak?: number;
  /** A solve chime: the sound file it plays (see `sound.ts`). */
  readonly sound?: string;
  /** Never sold: comes with the Patron pass (see `store.ts`). */
  readonly patron?: true;
}

/** The default in each slot - owned from the start, never sold. */
export const DEFAULT_EQUIPPED: Readonly<Record<CosmeticSlot, string>> = {
  confetti: 'confetti-almanac',
  ball: 'ball-violet',
  chart: 'chart-day',
  garden: 'garden-terracotta',
  chime: 'chime-house',
  ...(Object.fromEntries(SKIN_GAMES.map(g => [`skin-${g}`, `skin-${g}-classic`])) as Record<`skin-${SkinGame}`, string>),
};

const { common, fine, rare, masterwork } = RARITY_PRICES;

/** One game's Classic look (free, the game as designed) and its two skins. */
function skins(game: SkinGame, classic: string, items: ReadonlyArray<Omit<Cosmetic, 'slot'>>): Cosmetic[] {
  const slot = `skin-${game}` as const;
  return [{ id: `skin-${game}-classic`, slot, name: 'Classic', blurb: classic, price: 0, colors: [] }, ...items.map(item => ({ ...item, slot }))];
}

/** Each game's Masterwork - the top of its shelf. */
function masterworks(items: ReadonlyArray<Omit<Cosmetic, 'slot' | 'price'> & { game: SkinGame }>): Cosmetic[] {
  return items.map(({ game, ...item }) => ({ ...item, slot: `skin-${game}` as const, price: masterwork }));
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

  // --- Streak prizes: never sold, earned by keeping the Daily going. ---
  { id: 'confetti-bunting', slot: 'confetti', name: 'Bunting', blurb: 'A week of Dailies, flagged.', price: 0, exclusive: true, streak: 7, colors: ['#C8506A', '#F3D98A', '#3F6FA0', '#FFFDF8'] },
  { id: 'ball-sunstone', slot: 'ball', name: 'Sunstone', blurb: 'A month of mornings, set in stone.', price: 0, exclusive: true, streak: 30, colors: ['#8A3A12', '#D4692A', '#F2A25A', '#FFE3C2'] },
  { id: 'garden-lotus', slot: 'garden', name: 'Golden Lotus', blurb: 'A hundred days. It opens for very few.', price: 0, exclusive: true, streak: 100, colors: ['#D4A72C'] },

  // --- Patron pieces: come with the Patron pass, never sold. ---
  { id: 'confetti-gilt', slot: 'confetti', name: 'Gilt Patron', blurb: 'Gold leaf and ink, for Patrons.', price: 0, exclusive: true, patron: true, colors: ['#B7892F', '#E8C66E', '#3B1F52', '#FFF4D0'] },
  { id: 'chime-patron', slot: 'chime', name: 'Patron Bells', blurb: 'A gilded peal, for Patrons.', price: 0, exclusive: true, patron: true, sound: 'sfx_chime_patron.wav', colors: ['#B7892F', '#3B1F52'] },

  // --- In season: each sold only in its own three months. ---
  { id: 'confetti-leaves', slot: 'confetti', name: 'Falling Leaves', blurb: 'Maple and oak on the wind.', price: rare, season: 'autumn', colors: ['#B5452B', '#D9822B', '#E3B341', '#7A4A2A'] },
  { id: 'garden-maple', slot: 'garden', name: 'Maple', blurb: 'October red.', price: fine, season: 'autumn', colors: ['#B5452B'] },
  { id: 'ball-chestnut', slot: 'ball', name: 'Chestnut', blurb: 'Fresh from the husk, polished.', price: fine, season: 'autumn', colors: ['#3D2416', '#6E3F24', '#A8693E', '#F2D2B0'] },
  { id: 'confetti-snowfall', slot: 'confetti', name: 'Snowfall', blurb: 'The first quiet snow.', price: rare, season: 'winter', colors: ['#FFFFFF', '#DCE8F2', '#A9C3D9', '#7FA3C4'] },
  { id: 'garden-holly', slot: 'garden', name: 'Holly', blurb: 'Red berries in the frost.', price: fine, season: 'winter', colors: ['#A3233A'] },
  { id: 'ball-frost', slot: 'ball', name: 'Frost', blurb: 'A window pane, rolled.', price: fine, season: 'winter', colors: ['#5E7E9E', '#9FBCD6', '#E3EEF7', '#FFFFFF'] },
  { id: 'confetti-showers', slot: 'confetti', name: 'April Showers', blurb: 'Rain, petals, and sun between.', price: rare, season: 'spring', colors: ['#9CC3E0', '#C8DDB0', '#F4C2CF', '#FFFFFF'] },
  { id: 'garden-wisteria', slot: 'garden', name: 'Wisteria', blurb: 'Hanging over the garden wall.', price: fine, season: 'spring', colors: ['#9A86C2'] },
  { id: 'ball-robin', slot: 'ball', name: "Robin's Egg", blurb: 'The blue of a new nest.', price: fine, season: 'spring', colors: ['#4E9A9E', '#86C9C7', '#CDEDEA', '#FFFFFF'] },
  { id: 'confetti-fireflies', slot: 'confetti', name: 'Fireflies', blurb: 'A warm night, lit up.', price: rare, season: 'summer', colors: ['#F5E27A', '#C9F26B', '#2E3B2A', '#FFF6C8'] },
  { id: 'garden-sunflower', slot: 'garden', name: 'Sunflower', blurb: 'Turned to the light.', price: fine, season: 'summer', colors: ['#E3A21F'] },
  { id: 'ball-seaglass', slot: 'ball', name: 'Sea Glass', blurb: 'Worn smooth by the tide.', price: fine, season: 'summer', colors: ['#2F7F78', '#6FB8AE', '#BFE6DD', '#F4FFFB'] },

  // --- Solve chimes: the sound of every solved puzzle. ---
  { id: 'chime-house', slot: 'chime', name: 'House Chimes', blurb: "Each game's own finish.", price: 0, colors: ['#C46C33', '#3B1F52'] },
  { id: 'chime-kalimba', slot: 'chime', name: 'Kalimba', blurb: 'Thumbed metal, warm wood.', price: fine, sound: 'sfx_chime_kalimba.wav', colors: ['#B8683A', '#F2D2B0'] },
  { id: 'chime-wind', slot: 'chime', name: 'Wind Chimes', blurb: 'A breeze on the porch.', price: fine, sound: 'sfx_chime_wind.wav', colors: ['#6F8FD6', '#E3EEF7'] },
  { id: 'chime-bell', slot: 'chime', name: 'Temple Bell', blurb: 'One deep, long note.', price: rare, sound: 'sfx_chime_bell.wav', colors: ['#8C6A1C', '#E8C66E'] },
  { id: 'chime-harp', slot: 'chime', name: 'Glass Harp', blurb: 'Wet fingers on crystal rims.', price: masterwork, sound: 'sfx_chime_harp.wav', colors: ['#6FE3D4', '#E9E3F5'] },

  { id: 'chart-golden', slot: 'chart', name: 'Golden Hour', blurb: 'The sea at the end of the day.', price: masterwork, colors: ['#F6E3C0', '#EDCF98', '#E9C88F', '#5A3A1E', '#FFFBF2'] },

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

  // --- Masterworks: every game's finest set. ---
  ...masterworks([
    { game: 'gravity', id: 'skin-gravity-amethyst', name: 'Amethyst', blurb: 'Cut from a geode.', colors: ['#7A4FB8'], tokens: { pieceBlue: '#7A4FB8' }, darkTokens: { pieceBlue: '#A783E0' } },
    { game: 'mirror', id: 'skin-mirror-sunbeam', name: 'Sunbeam', blurb: 'Noon light, caught and bent.', colors: ['#F5C24E', '#FFF8E1'], tokens: { mirrorBeamGlow: '#F5C24E', mirrorBeamCore: '#FFF8E1' } },
    { game: 'tents', id: 'skin-tents-pavilion', name: 'Royal Pavilion', blurb: 'Tents fit for a tournament.', colors: ['#3F5FB5', '#273E80'], tokens: { tentLight: '#3F5FB5', tentDark: '#273E80' }, darkTokens: { tentLight: '#6F8FE0', tentDark: '#3F5FB5' } },
    { game: 'towers', id: 'skin-towers-rose', name: 'Rose Quartz', blurb: 'A pink city at dawn.', colors: ['#8E4A62', '#FFE9B8'], tokens: { towersBuilding: '#8E4A62', towersBuildingRoof: '#B56A84', towersWindow: '#FFE9B8' } },
    { game: 'binairo', id: 'skin-binairo-sapphire', name: 'Sapphire & Coral', blurb: 'Deep sea and its reef.', colors: ['#2F5DAF', '#E07A5F'], tokens: { binairoMarkFilled: '#2F5DAF', binairoMarkFilledLight: '#6F93D6', binairoMarkFilledDark: '#1B3A73', binairoMarkOutline: '#E07A5F', binairoMarkOutlineLight: '#F2A88F', binairoMarkOutlineDark: '#A84A33' } },
    { game: 'arukone', id: 'skin-arukone-gold', name: 'Gold Thread', blurb: 'Embroidery in real gilt.', colors: ['#B7892F'], tokens: { arukoneAccent: '#B7892F' }, darkTokens: { arukoneAccent: '#E3B341' } },
    { game: 'fillapix', id: 'skin-fillapix-midnight', name: 'Midnight Ink', blurb: 'Blue-black, like a fountain pen.', colors: ['#1F2A44'], tokens: { fillapixAccent: '#1F2A44' }, darkTokens: { fillapixAccent: '#B9C6E6' } },
    { game: 'lightsout', id: 'skin-lightsout-firefly', name: 'Firefly', blurb: 'Green-gold lamps in the dusk.', colors: ['#C9F26B', '#F7FFE0'], tokens: { lightsOutLit: '#C9F26B', lightsOutLitCore: '#F7FFE0' } },
    { game: 'adjacent', id: 'skin-adjacent-ember', name: 'Ember Kiln', blurb: 'Five glazes from the hottest fire.', colors: ['#9E3B2B', '#C7682B', '#D9A032', '#6E7B3A', '#4A3B57'], tokens: { adjacentTile0: '#9E3B2B', adjacentTile1: '#C7682B', adjacentTile2: '#D9A032', adjacentTile3: '#6E7B3A', adjacentTile4: '#4A3B57' } },
    { game: 'bloom', id: 'skin-bloom-iris', name: 'Midnight Iris', blurb: 'Flowers that open after dark.', colors: ['#4B4FB5'], tokens: { bloomAccent: '#4B4FB5' }, darkTokens: { bloomAccent: '#8C90E8' } },
    { game: 'mosaic', id: 'skin-mosaic-gold', name: 'Gold Leaf Bed', blurb: 'Tiles set in gilded grout.', colors: ['#F4E7C2', '#D9C384'], tokens: { mosaicSocket: '#F4E7C2', mosaicGrout: '#E3CF95', mosaicSlabEdge: '#B99A4E', mosaicSocketWall: '#D9C384' }, darkTokens: { mosaicSocket: '#3A3122', mosaicGrout: '#2B2418', mosaicSlabEdge: '#120E08', mosaicSocketWall: '#241D12' } },
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

export const STREAK_FREEZE_PRICE = 150;
export const MAX_STREAK_FREEZES = 3;

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find(item => item.id === id);
}

export function cosmeticsFor(slot: CosmeticSlot): ReadonlyArray<Cosmetic> {
  return COSMETICS.filter(item => item.slot === slot);
}

export function owns(progress: PlayerProgress, id: string): boolean {
  const item = cosmeticById(id);
  if (item === undefined) return false;
  // A streak prize is the streak itself: derived, so it can never drift.
  if (item.streak !== undefined) return progress.bestDailyStreak >= item.streak;
  if (item.patron) return progress.patron;
  return (item.price === 0 && !item.exclusive) || progress.owned.includes(id);
}

/** The season a date falls in, by its UTC month (as the Daily keys are). */
export function seasonOf(date: Date = new Date()): Season {
  const m = date.getUTCMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

/** Whole days left in the current season, counting today. */
export function seasonDaysLeft(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  // Each season ends as its third month does: May, August, November, February.
  const endMonth = m >= 2 && m <= 4 ? 5 : m >= 5 && m <= 7 ? 8 : m >= 8 && m <= 10 ? 11 : 2;
  const endYear = endMonth === 2 && m >= 11 ? y + 1 : y;
  const end = Date.UTC(endYear, endMonth, 1);
  const today = Date.UTC(y, m, date.getUTCDate());
  return Math.max(1, Math.round((end - today) / 86400000));
}

/** Whether an item can be bought on this date: always, unless it belongs
 * to a season other than this one. */
export function inSeason(item: Cosmetic, date: Date = new Date()): boolean {
  return item.season === undefined || item.season === seasonOf(date);
}

/** This season's pieces. */
export function seasonalItems(date: Date = new Date()): ReadonlyArray<Cosmetic> {
  const season = seasonOf(date);
  return COSMETICS.filter(item => item.season === season);
}

/** The item worn in `slot` - falling back to the default if the save
 * names something that no longer exists or was never owned. */
export function equipped(progress: PlayerProgress, slot: CosmeticSlot): Cosmetic {
  const id = progress.equipped[slot];
  const item = id ? cosmeticById(id) : undefined;
  if (item && item.slot === slot && owns(progress, item.id)) return item;
  return cosmeticById(DEFAULT_EQUIPPED[slot])!;
}

/** Today's feature: one item a day, the same for everyone, at a fifth
 * off. Chosen from the calendar alone (like the Daily), so it never
 * changes mid-day - buy it and it simply reads as yours until tomorrow. */
export const FEATURED_DISCOUNT = 0.2;
export function featuredItem(date: Date = new Date()): Cosmetic {
  const pool = COSMETICS.filter(item => item.price > 0 && !item.exclusive && item.season === undefined);
  const key = dailyKeyOf(date);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 1000003;
  return pool[hash % pool.length];
}

/** What an item costs today - its tier price, or less if it is today's
 * feature, or a seasonal piece bought by a Patron. Rounded to a tidy ten. */
export function priceFor(item: Cosmetic, date: Date = new Date(), progress?: PlayerProgress): number {
  if (item.price > 0 && featuredItem(date).id === item.id) return Math.round((item.price * (1 - FEATURED_DISCOUNT)) / 10) * 10;
  if (item.season && progress?.patron) return Math.round((item.price * (1 - PATRON_SEASON_DISCOUNT)) / 10) * 10;
  return item.price;
}

/** Buys an item and puts it on at once. Null if it cannot be bought (not
 * for sale, already owned, or too dear). A pinned goal it fulfils is
 * cleared. */
export function buyCosmetic(progress: PlayerProgress, id: string, date: Date = new Date()): PlayerProgress | null {
  const item = cosmeticById(id);
  if (!item || item.price === 0 || owns(progress, id) || !inSeason(item, date)) return null;
  const price = priceFor(item, date, progress);
  if (progress.coins < price) return null;
  return {
    ...progress,
    coins: progress.coins - price,
    owned: [...progress.owned, id],
    equipped: { ...progress.equipped, [item.slot]: id },
    shopGoal: progress.shopGoal === id ? null : progress.shopGoal,
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
export const RETIRE_PRICES: ReadonlyArray<number> = [600, 1000, 1500];

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
export const LUCKY_CHARM_PRICE = 250;
/** Ten doubled solves give back 230 to 300 coins: a small bet on yourself
 * that only pays if the solves are clean. */
export const LUCKY_CHARM_CHARGES = 10;
export const MAX_LUCKY_CHARGES = 30;

export function buyLuckyCharm(progress: PlayerProgress): PlayerProgress | null {
  if (progress.coins < LUCKY_CHARM_PRICE || progress.luckyCharges + LUCKY_CHARM_CHARGES > MAX_LUCKY_CHARGES) return null;
  return { ...progress, coins: progress.coins - LUCKY_CHARM_PRICE, luckyCharges: progress.luckyCharges + LUCKY_CHARM_CHARGES };
}

/** Swapping the puzzle a player is stuck on for another game's. */
export const SWAP_PRICE = 100;

// ---------------------------------------------------------------------------
// Sets: pieces that belong together. Owning every piece of one pays a
// one-off bonus, about a tenth of what the set cost.
// ---------------------------------------------------------------------------

export interface CosmeticSet {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly items: ReadonlyArray<string>;
  readonly reward: number;
}

export const COSMETIC_SETS: ReadonlyArray<CosmeticSet> = [
  { id: 'set-kiln', name: 'The Kiln', blurb: 'Everything fired, glazed and warm.', items: ['skin-gravity-ember', 'skin-tents-ember', 'skin-fillapix-ember', 'ball-coral', 'skin-arukone-copper'], reward: 430 },
  { id: 'set-green', name: 'The Green Room', blurb: 'Jade, sage and sea.', items: ['ball-jade', 'skin-gravity-jade', 'skin-mirror-emerald', 'garden-sage', 'chart-tropic'], reward: 500 },
  { id: 'set-garden', name: 'Garden Party', blurb: 'Petals, lanterns and soft glaze.', items: ['confetti-blossom', 'garden-camellia', 'skin-bloom-lavender', 'skin-lightsout-rose', 'skin-adjacent-pastel'], reward: 500 },
  { id: 'set-night', name: 'Night Sea', blurb: 'Lamps and stars over dark water.', items: ['chart-night', 'ball-obsidian', 'confetti-starlight', 'skin-towers-midnight', 'skin-lightsout-ice'], reward: 670 },
  { id: 'set-gilded', name: 'The Gilded Age', blurb: 'Gold, and then more gold.', items: ['confetti-gold', 'ball-gold', 'skin-binairo-gold', 'garden-marigold', 'skin-arukone-gold', 'chime-bell'], reward: 950 },
  { id: 'set-seasons', name: 'Four Seasons', blurb: "One confetti from each season. A year's work.", items: ['confetti-showers', 'confetti-fireflies', 'confetti-leaves', 'confetti-snowfall'], reward: 1000 },
];

export function setProgress(progress: PlayerProgress, set: CosmeticSet): { owned: number; total: number; complete: boolean; claimed: boolean } {
  const owned = set.items.filter(id => owns(progress, id)).length;
  return { owned, total: set.items.length, complete: owned === set.items.length, claimed: progress.setsClaimed.includes(set.id) };
}

/** The sets an item belongs to. */
export function setsWith(id: string): ReadonlyArray<CosmeticSet> {
  return COSMETIC_SETS.filter(set => set.items.includes(id));
}

/** Sets complete but not yet claimed. */
export function unclaimedSets(progress: PlayerProgress): ReadonlyArray<CosmeticSet> {
  return COSMETIC_SETS.filter(set => {
    const p = setProgress(progress, set);
    return p.complete && !p.claimed;
  });
}

/** Pays a completed set's bonus once. Null if not complete or already paid. */
export function claimSet(progress: PlayerProgress, id: string): PlayerProgress | null {
  const set = COSMETIC_SETS.find(s => s.id === id);
  if (!set) return null;
  const p = setProgress(progress, set);
  if (!p.complete || p.claimed) return null;
  return { ...progress, coins: progress.coins + set.reward, setsClaimed: [...progress.setsClaimed, id] };
}

// ---------------------------------------------------------------------------
// Ad-free time, bought with coins. It runs from the moment it is bought (or
// from the end of the time already held), and buying more extends it.
// ---------------------------------------------------------------------------

export interface AdFreeOption {
  readonly id: 'day' | 'week' | 'month';
  readonly label: string;
  readonly hours: number;
  readonly price: number;
}

/** Ads are light (see src/ads/policy.ts: one between level sets at most,
 * never mid-puzzle), so a day without them costs most of a day of play -
 * a treat, not a tax: a regular player can afford it now and then, and
 * a month is a real goal to save for. */
export const AD_FREE_OPTIONS: ReadonlyArray<AdFreeOption> = [
  { id: 'day', label: '1 day', hours: 24, price: 300 },
  { id: 'week', label: '7 days', hours: 24 * 7, price: 1600 },
  { id: 'month', label: '30 days', hours: 24 * 30, price: 5000 },
];

/** Whether ad-free time is running at `now`. */
export function isAdFree(progress: PlayerProgress, now: number = Date.now()): boolean {
  return progress.adFreeUntil !== null && progress.adFreeUntil > now;
}

export function buyAdFree(progress: PlayerProgress, id: AdFreeOption['id'], now: number = Date.now()): PlayerProgress | null {
  const option = AD_FREE_OPTIONS.find(o => o.id === id);
  if (!option || progress.coins < option.price) return null;
  const from = Math.max(now, progress.adFreeUntil ?? 0);
  return { ...progress, coins: progress.coins - option.price, adFreeUntil: from + option.hours * 3600000 };
}

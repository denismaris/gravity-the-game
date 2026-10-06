import { PlayerProgress } from './playerProgress';

/**
 * The Villas: what the puzzles build. Tessellatum is the Latin for a floor
 * laid from small tiles, so every solve pays tesserae - tiles - and the
 * player spends them building a villa on its own little island, one piece
 * at a time. A finished villa stays finished, and the next island rises:
 * a new name, a new palette, a new arrangement, a little dearer. They
 * never run out.
 *
 * Tiles are their own purse, apart from coins: coins buy help and looks,
 * tiles only ever build. Nothing here is for sale.
 */

/** What a piece adds to the island - and so how it is drawn. */
export type VillaPieceKind = 'terrace' | 'house' | 'pool' | 'tower' | 'colonnade' | 'cypresses' | 'olives' | 'fountain';

export interface VillaPiece {
  readonly id: string;
  readonly kind: VillaPieceKind;
  readonly name: string;
  /** What building it does to the island, in a line. */
  readonly blurb: string;
  readonly cost: number;
}

/** The kind of place a villa is: each draws different buildings, trees,
 * water and ground, so no two neighbouring villas look alike. */
export type VillaStyle = 'classic' | 'courtyard' | 'lighthouse' | 'vineyard' | 'temple' | 'domed';

/** One villa's character: everything the drawing varies, from its number. */
export interface VillaLook {
  readonly style: VillaStyle;
  readonly wall: string;
  readonly roof: string;
  readonly shutter: string;
  /** House and tower trade sides, so neighbours do not look alike. */
  readonly mirrored: boolean;
  readonly towerStoreys: 2 | 3;
  /** A colonnade with a flat beam, or a pergola under vines. */
  readonly pergola: boolean;
  readonly houseLength: number;
}

export interface VillaPlan {
  /** 0 for the first villa, and so on, forever. */
  readonly index: number;
  readonly name: string;
  readonly look: VillaLook;
  /** Built in this order: each piece needs the one before it. */
  readonly pieces: ReadonlyArray<VillaPiece>;
}

const STYLES: ReadonlyArray<VillaStyle> = ['classic', 'courtyard', 'lighthouse', 'vineyard', 'temple', 'domed'];

/** What each style is called, and the colours it is built in. */
const STYLE_LOOKS: Record<VillaStyle, { prefix: string; walls: string[]; roofs: string[]; shutters: string[] }> = {
  classic: { prefix: 'Villa', walls: ['#F3EADB', '#EED9B9', '#F0D3C2'], roofs: ['#C0603A', '#B4532F'], shutters: ['#4F7A86', '#6B7F4E'] },
  courtyard: { prefix: 'Casa', walls: ['#F2E4C4', '#EBCFB2', '#F1DDD0'], roofs: ['#B4532F', '#A86A3F', '#C47450'], shutters: ['#7A4E3A', '#4F7A86'] },
  lighthouse: { prefix: 'Faro', walls: ['#F7F4EE', '#EEF1F2'], roofs: ['#C2463A', '#3E6FA8'], shutters: ['#3E6FA8', '#2F7F86'] },
  vineyard: { prefix: 'Tenuta', walls: ['#E6C99A', '#DDB98A', '#E9D3AE'], roofs: ['#9C3F2A', '#A9502C'], shutters: ['#5E6B3A', '#6B4A33'] },
  temple: { prefix: 'Tempio', walls: ['#F4F0E6', '#EFE9DC'], roofs: ['#E6DFD0', '#D9CFBC'], shutters: ['#8C7B5A'] },
  domed: { prefix: 'Villa', walls: ['#F6F3EC', '#F3EADB'], roofs: ['#3E6FA8', '#2F7F86', '#B4532F'], shutters: ['#3E6FA8', '#2F7F86'] },
};

const ROOTS = ['Aurelia', 'Serena', 'Marina', 'del Sole', 'Flora', 'Lucia', 'delle Rondini', 'Oliva', 'Celeste', 'del Mare', 'Aurora', 'dei Fiori', 'Bianca', 'del Vento', 'Stella', 'Rosa'];

/** What each piece is, in build order (its words come from the style). */
const PIECES: ReadonlyArray<{ kind: VillaPieceKind }> = [
  { kind: 'terrace' },
  { kind: 'house' },
  { kind: 'pool' },
  { kind: 'tower' },
  { kind: 'colonnade' },
  { kind: 'cypresses' },
  { kind: 'olives' },
  { kind: 'fountain' },
];

/** What each piece is called, by style, in build order: terrace, main
 * building, water, tower, walk, trees, garden, finishing touch. */
const PIECE_TEXT: Record<VillaStyle, ReadonlyArray<[string, string]>> = {
  classic: [
    ['Lay the terrace', 'Warm stone paving across the island, square by square.'],
    ['Build the house', 'White walls, arched windows and a terracotta roof.'],
    ['Dig the pool', 'A long pool in front of the house, catching the sky.'],
    ['Raise the tower', 'A little tower, to watch the sea from.'],
    ['Add the colonnade', 'A row of columns shading the side of the pool.'],
    ['Plant the cypresses', 'A dark green row along the edge, standing tall.'],
    ['Plant the olives', 'An old olive tree and pots of lemons.'],
    ['Light it up', 'A fountain and lanterns: the villa is lived in.'],
  ],
  courtyard: [
    ['Pave the courtyard', 'Sun-warmed stone, made for long afternoons.'],
    ['Build the two wings', 'A house in an L, wrapped round the courtyard.'],
    ['Sink the pool', 'Square and still, in the corner of the yard.'],
    ['Build the dovecote', 'A small square tower, for the doves.'],
    ['Raise the pergola', 'Vines over timber, a roof of leaves.'],
    ['Plant the palms', 'Three tall palms, swaying over the walls.'],
    ['Pot the garden', 'An olive tree and terracotta pots of lemons.'],
    ['Set the fountain', 'Running water and lanterns in the yard.'],
  ],
  lighthouse: [
    ['Lay the boardwalk', 'Pale sand and stone, swept by the wind.'],
    ['Build the cottage', "A flat-roofed keeper's house, blue doors and all."],
    ['Fill the rock pool', 'A pool cut into the rock, cold and clear.'],
    ['Raise the lighthouse', 'Red and white, tall enough to see from the sea.'],
    ['Build the shelter', 'Somewhere out of the sun for the keeper.'],
    ['Plant the pines', 'Umbrella pines, leaning with the wind.'],
    ['Plant the shore garden', 'Hardy shrubs that love salt air.'],
    ['Light the lamps', 'Lanterns along the path, and the great light above.'],
  ],
  vineyard: [
    ['Lay the yard', 'Grass, and a gravel path to the door.'],
    ['Build the farmhouse', 'Ochre walls, a red roof and a chimney.'],
    ['Dig the pond', 'A still pond with lily pads, for the ducks.'],
    ['Raise the round tower', 'Old stone, with a pointed roof.'],
    ['Build the pergola', 'Grapevines over beams by the pond.'],
    ['Plant the cypresses', 'A dark row standing guard at the edge.'],
    ['Plant the vines', 'Rows of vines across the hill. Next year, wine.'],
    ['Hang the lanterns', 'Lanterns for the harvest supper.'],
  ],
  temple: [
    ['Lay the marble', 'White marble, cool underfoot.'],
    ['Raise the temple', 'Steps, columns and a pediment, the old way.'],
    ['Fill the long pool', 'A narrow pool that doubles the columns.'],
    ['Raise the obelisk', 'A single stone needle, pointing at the sky.'],
    ['Build the colonnade', 'Columns along the side, for walking and thinking.'],
    ['Plant the cypresses', 'Dark, still, and very old.'],
    ['Plant the laurels', 'Laurel, for the crowns of winners.'],
    ['Light the braziers', 'Fire in bronze bowls, to welcome the evening.'],
  ],
  domed: [
    ['Tile the terrace', 'Terracotta tiles, warm in the sun.'],
    ['Build the domed house', 'White walls under a dome the colour of the sea.'],
    ['Dig the pool', 'Blue water against white stone.'],
    ['Raise the slender tower', 'Tall and narrow, with a little dome of its own.'],
    ['Build the arcade', 'Columns and shade along the pool.'],
    ['Plant the palms', 'Palms leaning over the white walls.'],
    ['Pot the garden', 'An olive tree and pots of lemons.'],
    ['Light it up', 'A fountain and lanterns for warm nights.'],
  ],
};

/** The first villa's prices; each later villa asks a little more, up to
 * double. A puzzle pays about four tiles, so a villa is a week or two. */
const BASE_COSTS = [12, 21, 30, 39, 48, 57, 66, 75];

/** A small deterministic stream, so villa N always looks the same. */
function seeded(seed: number): () => number {
  let state = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roman(n: number): string {
  const table: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let left = n;
  for (const [value, mark] of table) {
    while (left >= value) {
      out += mark;
      left -= value;
    }
  }
  return out;
}

/** The style of villa number `index`: all six in turn, then shifted
 * rounds - never the same style twice running. */
export function villaStyle(index: number): VillaStyle {
  return STYLES[(index + Math.floor(index / STYLES.length) * 2) % STYLES.length];
}

/** Villa number `index`: its name, its look and its pieces. */
export function villaAt(index: number): VillaPlan {
  const random = seeded(index + 1);
  const pick = <T,>(list: ReadonlyArray<T>) => list[Math.floor(random() * list.length)];
  const style = villaStyle(index);
  const kit = STYLE_LOOKS[style];
  const round = Math.floor(index / ROOTS.length);
  const name = `${kit.prefix} ${ROOTS[index % ROOTS.length]}${round > 0 ? ` ${roman(round + 1)}` : ''}`;
  const look: VillaLook = {
    style,
    wall: index === 0 ? kit.walls[0] : pick(kit.walls),
    roof: index === 0 ? kit.roofs[0] : pick(kit.roofs),
    shutter: index === 0 ? kit.shutters[0] : pick(kit.shutters),
    mirrored: index % 2 === 1,
    towerStoreys: random() < 0.5 ? 2 : 3,
    pergola: style === 'courtyard' || style === 'lighthouse' || style === 'vineyard',
    houseLength: random() < 0.5 ? 3 : 3.4,
  };
  const scale = 1 + Math.min(index, 8) * 0.125;
  const pieces = PIECES.map((piece, i) => ({
    ...piece,
    name: PIECE_TEXT[style][i][0],
    blurb: PIECE_TEXT[style][i][1],
    id: `v${index}-${i}`,
    cost: Math.round(BASE_COSTS[i] * scale),
  }));
  return { index, name, look, pieces };
}

export const PIECES_PER_VILLA = PIECES.length;

/** Where the player stands: the villa being built, how much of it is up,
 * and how many villas are already finished. */
export function currentVilla(progress: PlayerProgress): { plan: VillaPlan; built: number; finished: number } {
  const total = progress.villa.length;
  const index = Math.floor(total / PIECES_PER_VILLA);
  return { plan: villaAt(index), built: total % PIECES_PER_VILLA, finished: index };
}

/** Extra tiles for the day's first Daily solve. */
export const DAILY_TESSERAE = 5;

/**
 * Tiles a solve pays: on a first solve, one for the puzzle and one per
 * star; on a replay, one per star newly earned; and a handful more for
 * the day's Daily.
 */
export function tesseraeForSolve({ previousStars, bestStars, firstDailyToday }: { previousStars: number; bestStars: number; firstDailyToday: boolean }): number {
  const stars = previousStars === 0 ? 1 + bestStars : Math.max(0, bestStars - previousStars);
  return stars + (firstDailyToday ? DAILY_TESSERAE : 0);
}

/** The next piece to build. There always is one. */
export function nextPiece(progress: PlayerProgress): VillaPiece {
  const { plan, built } = currentVilla(progress);
  return plan.pieces[built];
}

/** Builds `pieceId`: only the next piece, and only with the tiles for it.
 * Null when it cannot be built. */
export function buildPiece(progress: PlayerProgress, pieceId: string): PlayerProgress | null {
  const next = nextPiece(progress);
  if (next.id !== pieceId || progress.tesserae < next.cost) return null;
  return { ...progress, tesserae: progress.tesserae - next.cost, villa: [...progress.villa, pieceId] };
}

/** Whether there is something to build right now - for Home. */
export function canBuild(progress: PlayerProgress): boolean {
  return progress.tesserae >= nextPiece(progress).cost;
}

/**
 * Pieces from the first version (one room, "atrium-*" ids) carried into
 * the villas: as many pieces of the first villa, in order, so nothing a
 * player built is lost.
 */
export function migrateVillaIds(ids: ReadonlyArray<string>): string[] {
  const legacy = ids.filter(id => id.startsWith('atrium-')).length;
  const current = ids.filter(id => /^v\d+-\d+$/.test(id));
  if (legacy === 0) return [...new Set(current)];
  const carried = Array.from({ length: Math.min(legacy, PIECES_PER_VILLA) }, (_v, i) => `v0-${i}`);
  return [...new Set([...carried, ...current])];
}

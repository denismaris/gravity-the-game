import { PuzzleDifficulty } from './puzzleDifficulty';

/**
 * Ids for puzzles that do not exist until someone asks for them.
 *
 * Every pool in this app is finite and hand-curated, which is right for
 * the opening hours and wrong for hour twenty: `availablePuzzleIds` used
 * to fall back to *replaying* the pool once a tier was exhausted, so a
 * player who finished a game simply started meeting the same boards
 * again with no acknowledgement that anything had changed.
 *
 * An endless id carries everything needed to rebuild its own puzzle -
 * the game, the tier and an index - so the board can be generated on
 * demand and then regenerated identically forever after. That last part
 * is not optional: `PlayerProgress.levels` keys a best result per id, so
 * an id that produced a different board on the next launch would silently
 * attach a player's stars to a puzzle they never played.
 *
 * Deliberately a *separate namespace* from the curated ids rather than a
 * continuation of their numbering. The curated pools stay exactly as they
 * are - finite, authored, and still the thing "solve every Lights Out
 * puzzle" means - and the endless stream begins where they run out.
 */

/** `lightsout-e-hard-7`: game, the endless marker, tier, index. */
const PATTERN = /^([a-z]+)-e-(easy|medium|hard)-(\d+)$/;

export interface EndlessRef {
  readonly kind: string;
  readonly tier: PuzzleDifficulty;
  readonly index: number;
}

export function endlessId(kind: string, tier: PuzzleDifficulty, index: number): string {
  return `${kind}-e-${tier}-${index}`;
}

/** The parts of an endless id, or `null` for a curated one. Cheap and
 * total - callers use it to decide whether to look a puzzle up or build
 * it, so it must never throw on an ordinary id. */
export function parseEndlessId(id: string): EndlessRef | null {
  const match = PATTERN.exec(id);
  if (!match) return null;
  return { kind: match[1], tier: match[2] as PuzzleDifficulty, index: Number(match[3]) };
}

export function isEndlessId(id: string): boolean {
  return PATTERN.test(id);
}

/**
 * A stable 32-bit seed for an endless id.
 *
 * Shared by every game that generates on demand so the same id always
 * rebuilds the same board, whichever module happens to ask first.
 */
/* eslint-disable no-bitwise -- FNV-1a is bitwise by definition */
export function endlessSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
/* eslint-enable no-bitwise */

/**
 * What an endless puzzle is called.
 *
 * Derived from the id rather than stored, and - importantly - derived
 * *without building the board*. Home asks for a puzzle's name to draw its
 * hero card, and generating a whole board to answer that would stall the
 * hub on a game whose generator is expensive (Adjacent's is ~70ms a
 * board). Names are therefore a pure function of the index.
 */
/**
 * Endless indices from here up are the Weekly Grand boards (see
 * `journey/weekly.ts`): index `GRAND_INDEX_BASE + week`. The dealer counts
 * up from 0, so it never reaches them.
 */
export const GRAND_INDEX_BASE = 50000;

export function endlessName(index: number, kind?: string): string {
  const words = kind ? ENDLESS_WORDS[kind] : undefined;
  if (!words) return `No. ${index + 1}`;
  if (index >= GRAND_INDEX_BASE) return `The Grand ${words[1][(index - GRAND_INDEX_BASE) % words[1].length]}`;
  // Every adjective with every noun before any pair repeats - then a
  // numeral, so the thousandth board still has a name of its own.
  const [adjectives, nouns] = words;
  const pairs = adjectives.length * nouns.length;
  const k = index % pairs;
  // A one-to-one walk over every (adjective, noun) pair: the noun steps
  // every board, and the adjective is offset by it, so neighbouring
  // boards share neither word and no pair repeats within a cycle.
  const n = k % nouns.length;
  const round = Math.floor(k / nouns.length);
  const noun = nouns[n];
  const adjective = adjectives[(round + n * 5) % adjectives.length];
  const cycle = Math.floor(index / pairs);
  return cycle === 0 ? `${adjective} ${noun}` : `${adjective} ${noun} ${ROMAN[Math.min(cycle, ROMAN.length - 1)]}`;
}

const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Themed words per game for endless boards' names - each game's own
 * vocabulary, so a generated Tents board is a grove and a generated
 * Bridges board a harbour. */
const ENDLESS_WORDS: Readonly<Record<string, readonly [ReadonlyArray<string>, ReadonlyArray<string>]>> = {
  gravity: [
    ['Falling', 'Heavy', 'Quiet', 'Steep', 'Silver', 'Hollow', 'Tilted', 'Deep', 'Sudden', 'Slow', 'Drifting', 'Leaden'],
    ['Stair', 'Shaft', 'Well', 'Chute', 'Drop', 'Ledge', 'Cellar', 'Spiral', 'Plumb', 'Pendulum', 'Cascade', 'Hourglass', 'Anchor', 'Keel'],
  ],
  mirror: [
    ['Bright', 'Glass', 'Polished', 'Silver', 'Crossed', 'Clear', 'Burning', 'Pale', 'Prism', 'Mirrored', 'Hidden', 'Gilded'],
    ['Beam', 'Lantern', 'Gallery', 'Signal', 'Halo', 'Corridor', 'Flare', 'Glint', 'Periscope', 'Lens', 'Beacon', 'Window', 'Facet', 'Ray'],
  ],
  tents: [
    ['Mossy', 'Pine', 'Quiet', 'Birch', 'Amber', 'Misty', 'Hidden', 'Sunlit', 'Hazel', 'Wild', 'Ferny', 'Old'],
    ['Grove', 'Clearing', 'Hollow', 'Copse', 'Glade', 'Thicket', 'Camp', 'Ridge', 'Brook', 'Meadow', 'Pinewood', 'Heath', 'Dell', 'Spinney'],
  ],
  towers: [
    ['High', 'Tall', 'Old', 'Stone', 'Glass', 'Northern', 'Evening', 'Golden', 'Crowded', 'Quiet', 'Twin', 'Iron'],
    ['Skyline', 'Quarter', 'Spire', 'Terrace', 'Belfry', 'Rooftops', 'Citadel', 'Avenue', 'Market', 'Harbourfront', 'Bastion', 'Arcade', 'Crescent', 'Square'],
  ],
  binairo: [
    ['Even', 'Balanced', 'Twin', 'Paired', 'Mirror', 'Level', 'Exact', 'Measured', 'Steady', 'True', 'Split', 'Double'],
    ['Ledger', 'Scale', 'Weave', 'Pattern', 'Lattice', 'Register', 'Column', 'Checker', 'Tally', 'Balance', 'Draughts', 'Signal', 'Rhythm', 'Stripe'],
  ],
  arukone: [
    ['Winding', 'Silken', 'Knotted', 'Paired', 'Crossing', 'Folded', 'Hidden', 'Gentle', 'Long', 'Twisting', 'Scarlet', 'Braided'],
    ['Thread', 'Path', 'Ribbon', 'Cord', 'Trail', 'Stitch', 'Lane', 'Loop', 'Tether', 'Weft', 'Route', 'Seam', 'Skein', 'Line'],
  ],
  fillapix: [
    ['Hidden', 'Secret', 'Faint', 'Painted', 'Stippled', 'Inked', 'Quiet', 'Tiny', 'Folded', 'Pressed', 'Printed', 'Woven'],
    ['Emblem', 'Crest', 'Sampler', 'Motif', 'Badge', 'Charm', 'Glyph', 'Seal', 'Token', 'Sigil', 'Pattern', 'Stamp', 'Tile', 'Mark'],
  ],
  lightsout: [
    ['Last', 'Late', 'Quiet', 'Dim', 'Midnight', 'Winter', 'Sleeping', 'Starlit', 'Harbour', 'Candle', 'Lantern', 'Fading'],
    ['Lights', 'Windows', 'Street', 'Arcade', 'Terrace', 'Square', 'Hall', 'Gallery', 'Lamps', 'Station', 'Pier', 'Chapel', 'Promenade', 'Row'],
  ],
  adjacent: [
    ['Tumbling', 'Stacked', 'Bright', 'Crowded', 'Painted', 'Cheerful', 'Loose', 'Sorted', 'Heaped', 'Clattering', 'Candied', 'Glazed'],
    ['Tray', 'Pile', 'Stack', 'Crate', 'Heap', 'Shelf', 'Basket', 'Drawer', 'Jar', 'Cabinet', 'Bin', 'Tower', 'Tumble', 'Cascade'],
  ],
  bloom: [
    ['Wild', 'Early', 'Pale', 'Climbing', 'Summer', 'Walled', 'Morning', 'Twilight', 'Hedge', 'Scented', 'Cottage', 'Hidden'],
    ['Rose', 'Garden', 'Posy', 'Bud', 'Border', 'Trellis', 'Bower', 'Arbour', 'Bouquet', 'Blossom', 'Orchard', 'Petal', 'Meadow', 'Wreath'],
  ],
  mosaic: [
    ['Glazed', 'Gilded', 'Terracotta', 'Lapis', 'Marble', 'Painted', 'Ancient', 'Sunlit', 'Coloured', 'Tessellated', 'Cobalt', 'Coral'],
    ['Panel', 'Floor', 'Frieze', 'Pavement', 'Tile', 'Medallion', 'Border', 'Courtyard', 'Fountain', 'Alcove', 'Vault', 'Niche', 'Rosette', 'Inlay'],
  ],
  bridges: [
    ['Quiet', 'Misty', 'Northern', 'Salt', 'Hidden', 'Windy', 'Coral', 'Sheltered', 'Sunken', 'Outer', 'Little', 'Tidal'],
    ['Harbour', 'Isles', 'Cove', 'Lagoon', 'Sound', 'Estuary', 'Reef', 'Channel', 'Inlet', 'Archipelago', 'Strait', 'Bay', 'Atoll', 'Skerries'],
  ],
};

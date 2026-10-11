import { PlayerProgress } from './playerProgress';
import { currentVilla } from './villa';

/**
 * Tessellatum Bay: what the villas are for. Every finished villa becomes a
 * home in a small seaside town, and someone moves in - a baker, a
 * glassblower, a lamplighter - with a name and a trade. Once a day the
 * residents leave the player a gift of tiles, a little more as the town
 * grows, which is what the next villa is built with: the town builds
 * itself a little, every day the player comes by.
 */

export interface Resident {
  readonly name: string;
  readonly trade: string;
  /** What they leave on the doorstep, in a few words. */
  readonly gift: string;
}

const RESIDENTS: ReadonlyArray<Resident> = [
  { name: 'Elena', trade: 'baker', gift: 'a warm loaf' },
  { name: 'Tomas', trade: 'boatwright', gift: 'a carved oar' },
  { name: 'Ines', trade: 'glassblower', gift: 'a green bead' },
  { name: 'Marco', trade: 'lamplighter', gift: 'a spare wick' },
  { name: 'Sofia', trade: 'gardener', gift: 'a sprig of rosemary' },
  { name: 'Luca', trade: 'potter', gift: 'a small bowl' },
  { name: 'Ana', trade: 'weaver', gift: 'a ribbon' },
  { name: 'Pietro', trade: 'fisherman', gift: 'a shell' },
  { name: 'Clara', trade: 'beekeeper', gift: 'a jar of honey' },
  { name: 'Matteo', trade: 'clockmaker', gift: 'a brass key' },
  { name: 'Rosa', trade: 'painter', gift: 'a postcard' },
  { name: 'Nico', trade: 'stonemason', gift: 'a smooth pebble' },
];

/** Who lives in villa `index` (0-based, in the order they were finished). */
export function residentOf(index: number): Resident {
  const base = RESIDENTS[index % RESIDENTS.length];
  // After a dozen homes, names come round again with a younger generation.
  const round = Math.floor(index / RESIDENTS.length);
  return round === 0 ? base : { ...base, name: `${base.name} the ${['younger', 'third', 'fourth'][Math.min(round - 1, 2)]}` };
}

/** Tiles each resident leaves a day, and the most the town gives. */
export const TILES_PER_RESIDENT = 2;
export const TOWN_GIFT_MAX = 16;

/** How many people live in the town: one per finished villa. */
export function residents(progress: PlayerProgress): number {
  return currentVilla(progress).finished;
}

/** Today's gift from the town in tiles, or 0 if there is no one yet or it
 * has been collected. */
export function townGift(progress: PlayerProgress, dayKey: string): number {
  if (progress.townGiftKey === dayKey) return 0;
  return Math.min(TOWN_GIFT_MAX, residents(progress) * TILES_PER_RESIDENT);
}

/** Collects today's gift. Null if there is nothing to collect. */
export function collectTownGift(progress: PlayerProgress, dayKey: string): PlayerProgress | null {
  const tiles = townGift(progress, dayKey);
  if (tiles === 0) return null;
  return { ...progress, tesserae: progress.tesserae + tiles, townGiftKey: dayKey };
}

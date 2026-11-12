import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateFolio } from './generator';
import { FolioPuzzle } from './types';

/**
 * The curated boards' names, in the order they are dealt. Paper and the
 * things made of it: a folio is a sheet folded once, the oldest unit of a
 * book. Appended, never inserted - ids are positional.
 */
const NAMES: Record<PuzzleDifficulty, ReadonlyArray<string>> = {
  easy: ['Letter', 'Napkin', 'Paper Hat', 'Bookmark', 'Envelope', 'Postcard', 'Place Card', 'Ticket', 'Gift Tag', 'Recipe Card'],
  medium: ['Paper Boat', 'Pamphlet', 'Programme', 'Seed Packet', 'Valentine', 'Fan', 'Map of the Town', 'Menu', 'Lantern Shade', 'Pocket Book'],
  hard: ['Folio', 'Quarto', 'Octavo', 'Atlas', 'Paper Crane', 'Broadsheet', 'Concertina', 'Sketchbook', 'Almanac', 'Origami Star'],
};

export interface FolioEntry {
  readonly id: string;
  readonly name: string;
  readonly difficulty: PuzzleDifficulty;
}

/**
 * Every curated board's id, name and tier, without building one: boards
 * are generated the first time they are opened (a few milliseconds each)
 * so the app's start pays nothing for this game.
 */
export const FOLIO: ReadonlyArray<FolioEntry> = (['easy', 'medium', 'hard'] as const).flatMap(difficulty =>
  NAMES[difficulty].map((name, index) => ({ id: `folio-${difficulty}-${String(index + 1).padStart(2, '0')}`, name, difficulty })),
);

const cache = new Map<string, FolioPuzzle>();

export function getFolioById(id: string): FolioPuzzle | undefined {
  const cached = cache.get(id);
  if (cached) return cached;
  const entry = FOLIO.find(e => e.id === id);
  let puzzle: FolioPuzzle | undefined;
  if (entry) {
    puzzle = generateFolio(entry.id, entry.name, entry.difficulty);
  } else {
    const endless = parseEndlessId(id);
    if (!endless || endless.kind !== 'folio') return undefined;
    puzzle = generateFolio(id, endlessName(endless.index, 'folio'), endless.tier);
  }
  cache.set(id, puzzle);
  return puzzle;
}

/** The name and tier of a curated board, from its id alone. */
export function folioCuratedInfo(id: string): FolioEntry | undefined {
  return FOLIO.find(e => e.id === id);
}

export function getFolioByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<FolioEntry> {
  return FOLIO.filter(e => e.difficulty === difficulty);
}

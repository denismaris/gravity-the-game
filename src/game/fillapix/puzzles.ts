import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { emblemFor } from './emblems';
import { generateFillaPix } from './generator';
import { EASY_IMAGES, HARD_IMAGES, MEDIUM_IMAGES } from './pixelArt';
import { FillaPixPuzzle } from './types';
import { BAKED_FILLAPIX } from './pool.generated';

function titleCase(id: string): string {
  return id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

/** `fillapix-easy-01` ("Plus", the simplest shape in the library - see
 * `pixelArt.ts`) reveals every clue rather than the easy tier's usual
 * ~55%: a brand-new player's very first Fill-a-Pix should be solvable by
 * directly reading every number, with no ambiguity to reason through, so
 * the *rule* is what's being taught, not the puzzle. */
const FIRST_PUZZLE_REVEAL_ALL = 'fillapix-easy-01';

function poolFor(difficulty: PuzzleDifficulty, images: ReadonlyArray<typeof EASY_IMAGES[number]>): FillaPixPuzzle[] {
  return images.map((image, index) => {
    const id = `fillapix-${difficulty}-${String(index + 1).padStart(2, '0')}`;
    return generateFillaPix(id, titleCase(image.id), difficulty, image, { revealAll: id === FIRST_PUZZLE_REVEAL_ALL });
  });
}

/** Builds the pool from its pictures. Run once, offline, to write
 * `pool.generated.ts`; the app loads that instead (see below), and the pool
 * test checks the two still agree. */
export function buildFillaPixPool(): FillaPixPuzzle[] {
  return [...poolFor('easy', EASY_IMAGES), ...poolFor('medium', MEDIUM_IMAGES), ...poolFor('hard', HARD_IMAGES)];
}

/**
 * The shipped pool, baked. Building it searches each picture for a clue
 * set a player can solve by logic alone - about a tenth of a second on a
 * laptop, several times that on a phone, on every cold start. So it is
 * written out once and loaded here; the pool test regenerates it and fails
 * on any drift, keeping the file an honest cache of `buildFillaPixPool`.
 */
export const FILLAPIX: ReadonlyArray<FillaPixPuzzle> = BAKED_FILLAPIX;

const endlessCache = new Map<string, FillaPixPuzzle>();

/** A board from the curated pool, or an endless one: an emblem drawn for
 * its id (see `emblemFor`), revealed by the same generator as every other
 * board - unique and reasoned out without guessing. */
export function getFillaPixById(id: string): FillaPixPuzzle | undefined {
  const found = FILLAPIX.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'fillapix') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateFillaPix(id, endlessName(endless.index, 'fillapix'), endless.tier, emblemFor(id, endless.tier));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getFillaPixByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<FillaPixPuzzle> {
  return FILLAPIX.filter(puzzle => puzzle.difficulty === difficulty);
}

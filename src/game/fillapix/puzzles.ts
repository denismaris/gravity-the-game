import { PuzzleDifficulty } from '../puzzleDifficulty';
import { generateFillaPix } from './generator';
import { EASY_IMAGES, HARD_IMAGES, MEDIUM_IMAGES } from './pixelArt';
import { FillaPixPuzzle } from './types';

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

export const FILLAPIX: ReadonlyArray<FillaPixPuzzle> = [
  ...poolFor('easy', EASY_IMAGES),
  ...poolFor('medium', MEDIUM_IMAGES),
  ...poolFor('hard', HARD_IMAGES),
];

export function getFillaPixById(id: string): FillaPixPuzzle | undefined {
  return FILLAPIX.find(puzzle => puzzle.id === id);
}

export function getFillaPixByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<FillaPixPuzzle> {
  return FILLAPIX.filter(puzzle => puzzle.difficulty === difficulty);
}

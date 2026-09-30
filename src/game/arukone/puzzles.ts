import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateArukone } from './generator';
import { ArukonePuzzle } from './types';
import { BAKED_ARUKONE } from './pool.generated';

/**
 * The shipped Arukone+ pool.
 *
 * Boards are generated rather than hand-authored, but the *ids* are
 * frozen and each id always produces the same board (see
 * `generateArukone`). That combination is what lets this game reuse the
 * whole existing progression system untouched: `PlayerProgress` keys a
 * best result per puzzle id, achievements spread `ALL_PUZZLE_IDS`, and the
 * batch generator picks by difficulty tier - none of which works if a
 * puzzle id maps to a different board on the next launch.
 */
const NAMES: ReadonlyArray<[string, PuzzleDifficulty, string]> = [
  ['arukone-001', 'easy', 'First Thread'],
  ['arukone-002', 'easy', 'Folded Over'],
  ['arukone-003', 'easy', 'Two Ways Round'],
  ['arukone-004', 'easy', 'Short Work'],
  ['arukone-005', 'medium', 'Crossed Purposes'],
  ['arukone-006', 'medium', 'The Long Way'],
  ['arukone-007', 'medium', 'Mirror Writing'],
  ['arukone-008', 'medium', 'Tight Quarters'],
  ['arukone-009', 'hard', 'Knotwork'],
  ['arukone-010', 'hard', 'Both Halves'],
  ['arukone-011', 'hard', 'Hall of Mirrors'],
  // Appended only - ids are positional in spirit and frozen in fact, so
  // a new board always goes on the end rather than into the middle.
  ['arukone-012', 'easy', 'Loose Ends'],
  ['arukone-013', 'medium', 'Double Back'],
  ['arukone-014', 'medium', 'Over and Under'],
  ['arukone-015', 'hard', 'Every Strand'],
];

/**
 * A board's shape, folded over the eight ways it can be turned and
 * reflected - two ids share one exactly when they generate the same
 * puzzle wearing a different orientation.
 */
function canonicalShape(puzzle: ArukonePuzzle): string {
  let grid: string[][] = Array.from({ length: puzzle.size }, () => Array<string>(puzzle.size).fill('.'));
  for (const cell of puzzle.obstacles ?? []) grid[cell.row][cell.col] = 'X';
  for (const pair of puzzle.pairs) {
    grid[pair.a.row][pair.a.col] = 'P';
    grid[pair.b.row][pair.b.col] = 'P';
  }
  const forms: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    forms.push(grid.map(row => row.join('')).join('/'));
    forms.push(grid.map(row => [...row].reverse().join('')).join('/'));
    grid = Array.from({ length: grid[0].length }, (_, r) =>
      Array.from({ length: grid.length }, (__, c) => grid[grid.length - 1 - c][r]),
    );
  }
  return forms.sort()[0];
}

/**
 * Generated in order, each board rejected and re-drawn if the pool has
 * already shipped its shape.
 *
 * Without this the pool shipped `arukone-004` as a half-turn of
 * `arukone-001` - two ids, two names, one puzzle - which no test caught
 * because nothing compared boards to each other. Salting rather than
 * renaming keeps every id exactly where it was.
 */
/** Builds the pool from its names - salted re-draws until every shape is
 * new. Run once, offline, to write \`pool.generated.ts\`; the app loads that
 * instead (see below), and the pool test checks the two still agree. */
export function buildArukonePool(): ArukonePuzzle[] {
  const seen = new Set<string>();
  return NAMES.map(([id, difficulty, name]) => {
    for (let salt = 0; salt < 64; salt += 1) {
      const puzzle = generateArukone(id, difficulty, name, salt);
      const shape = canonicalShape(puzzle);
      if (seen.has(shape)) continue;
      seen.add(shape);
      return puzzle;
    }
    throw new Error(`Arukone ${id}: every salted draw duplicated a board already in the pool.`);
  });
}

/**
 * The shipped pool, baked. Building it runs the generator with its salted
 * retries for every board - about a tenth of a second on a laptop, several
 * times that on a phone, on every cold start, while the launch animation
 * waits. So it is written out once and loaded here; the pool test
 * regenerates it and fails on any drift, keeping the file an honest cache
 * of \`buildArukonePool\` rather than a second source of truth.
 */
export const ARUKONE: ReadonlyArray<ArukonePuzzle> = BAKED_ARUKONE;

const endlessCache = new Map<string, ArukonePuzzle>();

export function getArukoneById(id: string): ArukonePuzzle | undefined {
  const found = ARUKONE.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'arukone') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  // The id is the seed, so this rebuilds the same board every time.
  const puzzle = generateArukone(id, endless.tier, endlessName(endless.index, 'arukone'));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getArukoneByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<ArukonePuzzle> {
  return ARUKONE.filter(puzzle => puzzle.difficulty === difficulty);
}

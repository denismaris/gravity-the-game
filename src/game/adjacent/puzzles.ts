import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateAdjacent, shapeForDifficulty } from './generator';
import { AdjacentCell, AdjacentPuzzle } from './types';

/**
 * The shipped boards, as data.
 *
 * Every one of these came out of `generateAdjacent` and is reproduced
 * here exactly - `adjacent.test.ts` regenerates every one of them from their
 * own ids and fails if a single tile has drifted, so this is a cache of
 * that function's output rather than a second, hand-maintained source of
 * truth. Editing a row here without editing the generator fails the
 * suite immediately.
 *
 * **Baked rather than generated at module load, and that is the whole
 * point.** Generation is not cheap here the way Lights Out's is: each
 * board is dealt, scored by a 120-playout search, and put through an
 * exhaustive depth-limited check, retried until one passes. Measured, the
 * pool took ~970ms to build in Node against Lights Out's 4ms - a full
 * second of blocked JavaScript on every cold start, before the launch
 * animation could even hand over, and considerably worse on a phone. The
 * search still runs on every one of these boards, just in the test suite
 * where a second costs nothing.
 *
 * Names are a mosaicist's workbench - sorting loose chips, working a tray
 * down to nothing - which is the register this app's own name already
 * lives in: a *tessera* is a fragment of a mosaic, and this is the game
 * that is literally about clearing coloured fragments off a tray.
 */

/** A row per line, a digit per tile, `.` for an empty square - the same
 * shorthand the tests and the tutorial illustrations read, so a board
 * looks the same everywhere it is written down. */
type BoardRows = ReadonlyArray<string>;

const BOARDS: ReadonlyArray<readonly [id: string, name: string, difficulty: PuzzleDifficulty, rows: BoardRows]> = [
  ['adjacent-easy-01', 'First Sorting', 'easy', ['......', '......', '.31...', '.10...', '2301..', '002323']],
  ['adjacent-easy-02', 'Loose Chips', 'easy', ['......', '......', '.....1', '..3..2', '0303.1', '113200']],
  ['adjacent-easy-03', 'Two of a Kind', 'easy', ['......', '......', '......', '..02.0', '0203.0', '313001']],
  ['adjacent-easy-04', 'The Shallow Tray', 'easy', ['......', '......', '..0..2', '.33..2', '.12..3', '020032']],
  ['adjacent-easy-05', 'Offcuts', 'easy', ['......', '......', '1..0..', '3..23.', '0..21.', '101101']],
  ['adjacent-easy-06', 'Swept Up', 'easy', ['......', '......', '11....', '30....', '02..13', '200303']],
  ['adjacent-easy-07', 'Odd Lots', 'easy', ['......', '......', '..2...', '.12..2', '.00.03', '331311']],
  ['adjacent-medium-01', 'Five Glazes', 'medium', ['......', '.00..0', '.03..1', '.10.22', '200102', '144300']],
  ['adjacent-medium-02', 'The Sorting Table', 'medium', ['......', '41..2.', '13..2.', '23..13', '201301', '033004']],
  ['adjacent-medium-03', 'Mixed Batch', 'medium', ['......', '211...', '133...', '202..3', '021144', '001424']],
  ['adjacent-medium-04', 'Close Work', 'medium', ['......', '.03.0.', '.02.0.', '.21.12', '003142', '044241']],
  ['adjacent-medium-05', 'Down to the Tray', 'medium', ['......', '....23', '2...21', '232.31', '400443', '211420']],
  ['adjacent-medium-06', 'Second Firing', 'medium', ['......', '1...2.', '04..3.', '32133.', '003413', '433211']],
  ['adjacent-medium-07', 'The Wide Bench', 'medium', ['......', '2.4...', '0143..', '1143..', '020401', '213334']],
  ['adjacent-hard-01', 'The Full Tray', 'hard', ['..01...', '.043...', '.422204', '1320443', '4120030', '2133231', '4031133']],
  ['adjacent-hard-02', 'Deep Stack', 'hard', ['.0....1', '.1.3.02', '.211.32', '0004422', '4442231', '1323111', '4000330']],
  ['adjacent-hard-03', 'Everything at Once', 'hard', ['1..4...', '4..04..', '2.30141', '4311444', '3043004', '1441010', '2302243']],
  ['adjacent-hard-04', 'The Last Firing', 'hard', ['.2..1..', '.3..3.3', '04412.0', '0112001', '4241410', '1222200', '3011412']],
  ['adjacent-hard-05', 'Kiln Load', 'hard', ['4..2...', '00.2.0.', '12.2.22', '4022113', '3431242', '1312403', '0401120']],
  ['adjacent-hard-06', 'Nothing Left Over', 'hard', ['01.....', '24....3', '30.0313', '1024013', '4302121', '0444233', '0143330']],
];

export function parseAdjacentRows(rows: BoardRows): ReadonlyArray<ReadonlyArray<AdjacentCell>> {
  return rows.map(row => row.split('').map(ch => (ch === '.' ? null : Number(ch))));
}

export const ADJACENT: ReadonlyArray<AdjacentPuzzle> = BOARDS.map(([id, name, difficulty, rows]) => {
  const shape = shapeForDifficulty(difficulty);
  return {
    id,
    name,
    difficulty,
    size: shape.size,
    colors: shape.colors,
    initial: parseAdjacentRows(rows),
    targetScore: shape.targetScore,
  };
});

/**
 * Endless trays, built on demand and kept.
 *
 * The cache matters more here than for the other endless games: a single
 * Adjacent board costs roughly 70ms to deal and verify (a scored search
 * plus an exhaustive depth check, retried until a board passes), which is
 * why the curated pool is baked as literals rather than generated at
 * import. Paying that once, at the moment a player opens the puzzle, is
 * fine; paying it on every render would not be. `puzzleDisplayInfo`
 * deliberately never comes through here - it answers from the id alone -
 * so Home never triggers a deal.
 */
const endlessCache = new Map<string, AdjacentPuzzle>();

export function getAdjacentById(id: string): AdjacentPuzzle | undefined {
  const found = ADJACENT.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'adjacent') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateAdjacent(id, endlessName(endless.index, 'adjacent'), endless.tier);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getAdjacentByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<AdjacentPuzzle> {
  return ADJACENT.filter(puzzle => puzzle.difficulty === difficulty);
}

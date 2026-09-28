import { visibleCount } from './logic';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateTowers } from './generator';
import { TowersPuzzle } from './types';

/** Which sides keep their real, derived clue - the rest ship as `0`
 * (unclued). Stripping whole sides (rather than individual clues) keeps
 * this authoring helper simple; difficulty comes from *which* sides are
 * dropped, not a per-cell mask. */
interface ClueSides {
  readonly top: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

const ALL_SIDES: ClueSides = { top: true, bottom: true, left: true, right: true };

/**
 * Builds a puzzle from a real, hand-verified Latin square, *deriving* every
 * kept clue from it via `visibleCount` (never hand-counted) - the grid
 * itself is discarded immediately after; only the derived clues ship.
 * Uniqueness for whichever clue subset is kept is verified by the real
 * solver in the test suite, not assumed here.
 */
function fromGrid(
  id: string,
  name: string,
  difficulty: PuzzleDifficulty,
  grid: ReadonlyArray<ReadonlyArray<number>>,
  sides: ClueSides = ALL_SIDES,
): TowersPuzzle {
  const size = grid.length;
  const col = (c: number): number[] => grid.map(row => row[c]);
  const zeros = new Array(size).fill(0);

  return {
    id,
    name,
    difficulty,
    size,
    topClues: sides.top ? grid[0].map((_v, c) => visibleCount(col(c))) : zeros,
    bottomClues: sides.bottom ? grid[0].map((_v, c) => visibleCount([...col(c)].reverse())) : zeros,
    leftClues: sides.left ? grid.map(row => visibleCount(row)) : zeros,
    rightClues: sides.right ? grid.map(row => visibleCount([...row].reverse())) : zeros,
  };
}

// Five hand-built 4x4 Latin squares (a cyclic base, then row/column/value
// permutations of it, so puzzles don't all look cyclic) and five 5x5 ones,
// each independently verified as a valid Latin square by hand before use.

const GRID_4_A = [
  [1, 2, 3, 4],
  [2, 3, 4, 1],
  [3, 4, 1, 2],
  [4, 1, 2, 3],
];
const GRID_4_B = [
  [2, 1, 4, 3],
  [4, 3, 2, 1],
  [1, 4, 3, 2],
  [3, 2, 1, 4],
];
const GRID_4_C = [
  [3, 1, 4, 2],
  [4, 2, 1, 3],
  [1, 3, 2, 4],
  [2, 4, 3, 1],
];
const GRID_4_D = [
  [4, 1, 2, 3],
  [3, 2, 1, 4],
  [2, 4, 3, 1],
  [1, 3, 4, 2],
];
const GRID_4_E = [
  [1, 4, 3, 2],
  [2, 1, 4, 3],
  [3, 2, 1, 4],
  [4, 3, 2, 1],
];

const GRID_5_F = [
  [1, 2, 3, 4, 5],
  [2, 3, 4, 5, 1],
  [3, 4, 5, 1, 2],
  [4, 5, 1, 2, 3],
  [5, 1, 2, 3, 4],
];
const GRID_5_G = [
  [4, 5, 1, 2, 3],
  [1, 2, 3, 4, 5],
  [5, 1, 2, 3, 4],
  [2, 3, 4, 5, 1],
  [3, 4, 5, 1, 2],
];
const GRID_5_H = [
  [3, 4, 5, 1, 2],
  [5, 1, 2, 3, 4],
  [2, 3, 4, 5, 1],
  [4, 5, 1, 2, 3],
  [1, 2, 3, 4, 5],
];
const GRID_5_I = [
  [3, 5, 2, 4, 1],
  [4, 1, 3, 5, 2],
  [5, 2, 4, 1, 3],
  [1, 3, 5, 2, 4],
  [2, 4, 1, 3, 5],
];
const GRID_5_J = [
  [5, 4, 3, 2, 1],
  [4, 3, 2, 1, 5],
  [3, 2, 1, 5, 4],
  [2, 1, 5, 4, 3],
  [1, 5, 4, 3, 2],
];

// Difficulty follows this game's own real complexity signal (see
// `PuzzleDifficulty`'s comment in `types.ts` and `ClueSides`'s own comment
// above): the four fully-clued 4x4s are easy, the fully-clued 4x4 plus the
// three fully-clued 5x5s are medium, and the two reduced-clue 5x5s (the
// only puzzles that actually drop a side) are hard.
// Four more, found by searching random Latin squares and keeping only
// those whose derived clues have exactly one solution (checked with the
// real solver, same as everything above). Appended rather than
// interleaved: ids are frozen, and a board slotted into the middle would
// hand an existing id a different puzzle.
const GRID_5_K = [
  [2, 4, 1, 3, 5],
  [3, 5, 2, 4, 1],
  [1, 3, 5, 2, 4],
  [4, 1, 3, 5, 2],
  [5, 2, 4, 1, 3],
];
const GRID_5_L = [
  [5, 3, 2, 1, 4],
  [2, 4, 3, 5, 1],
  [4, 5, 1, 3, 2],
  [1, 2, 5, 4, 3],
  [3, 1, 4, 2, 5],
];
const GRID_5_M = [
  [1, 4, 5, 3, 2],
  [3, 2, 1, 4, 5],
  [5, 3, 2, 1, 4],
  [2, 1, 4, 5, 3],
  [4, 5, 3, 2, 1],
];
/** The pool's first 6x6 - the one genuinely new thing at the hard end,
 * where difficulty had been carried entirely by dropping a clue side. */
const GRID_6_A = [
  [5, 6, 1, 4, 3, 2],
  [6, 1, 2, 5, 4, 3],
  [4, 5, 6, 3, 2, 1],
  [1, 2, 3, 6, 5, 4],
  [3, 4, 5, 2, 1, 6],
  [2, 3, 4, 1, 6, 5],
];

export const TOWERS: ReadonlyArray<TowersPuzzle> = [
  fromGrid('towers-001', 'Skyline', 'easy', GRID_4_A),
  fromGrid('towers-002', 'Downtown', 'easy', GRID_4_B),
  fromGrid('towers-003', 'North Face', 'easy', GRID_4_C),
  fromGrid('towers-004', 'Rear View', 'easy', GRID_4_D),
  fromGrid('towers-005', 'High Rise', 'medium', GRID_4_E),
  fromGrid('towers-006', 'Grid Five', 'medium', GRID_5_F),
  fromGrid('towers-007', 'Avenue Five', 'medium', GRID_5_G),
  fromGrid('towers-008', 'Blueprint', 'medium', GRID_5_H),
  // Three sides rather than two. Difficulty here comes only from size and
  // how many clue sides are dropped, and 001-008 already carry all four -
  // so the two-sided pair was the whole hard end of the ramp on its own,
  // and a long way from the puzzle before it. Keeping one side dropped
  // leaves them the hardest boards in the set without the cliff.
  fromGrid('towers-009', 'Corner Office', 'hard', GRID_5_I, { top: true, bottom: false, left: true, right: true }),
  fromGrid('towers-010', 'Penthouse', 'hard', GRID_5_J, { top: true, bottom: false, left: true, right: true }),
  fromGrid('towers-011', 'Five Storeys', 'medium', GRID_5_K),
  fromGrid('towers-012', 'The Embankment', 'medium', GRID_5_L),
  fromGrid('towers-013', 'Long Shadow', 'hard', GRID_5_M, { top: true, bottom: false, left: true, right: true }),
  fromGrid('towers-014', 'The Whole Block', 'hard', GRID_6_A, { top: true, bottom: false, left: true, right: true }),
];

const endlessCache = new Map<string, TowersPuzzle>();

export function getTowersById(id: string): TowersPuzzle | undefined {
  const found = TOWERS.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'towers') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateTowers(id, endless.tier, endlessName(endless.index));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getTowersByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<TowersPuzzle> {
  return TOWERS.filter(puzzle => puzzle.difficulty === difficulty);
}

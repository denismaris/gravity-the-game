import { visibleCount } from './logic';
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
  grid: ReadonlyArray<ReadonlyArray<number>>,
  sides: ClueSides = ALL_SIDES,
): TowersPuzzle {
  const size = grid.length;
  const col = (c: number): number[] => grid.map(row => row[c]);
  const zeros = new Array(size).fill(0);

  return {
    id,
    name,
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

export const TOWERS: ReadonlyArray<TowersPuzzle> = [
  fromGrid('towers-001', 'Skyline', GRID_4_A),
  fromGrid('towers-002', 'Downtown', GRID_4_B),
  fromGrid('towers-003', 'North Face', GRID_4_C),
  fromGrid('towers-004', 'Rear View', GRID_4_D),
  fromGrid('towers-005', 'High Rise', GRID_4_E),
  fromGrid('towers-006', 'Grid Five', GRID_5_F),
  fromGrid('towers-007', 'Avenue Five', GRID_5_G),
  fromGrid('towers-008', 'Blueprint', GRID_5_H),
  fromGrid('towers-009', 'Corner Office', GRID_5_I, { top: true, bottom: false, left: true, right: false }),
  fromGrid('towers-010', 'Penthouse', GRID_5_J, { top: true, bottom: false, left: true, right: false }),
];

export function getTowersById(id: string): TowersPuzzle | undefined {
  return TOWERS.find(puzzle => puzzle.id === id);
}

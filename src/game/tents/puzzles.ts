import { PuzzleDifficulty } from '../puzzleDifficulty';
import { TentsTreesCell, TentsTreesPuzzle } from './types';

/**
 * Parses a puzzle from a pair of ASCII grids: `treeRows` (`T` = tree, `.` =
 * empty) and `tentRows` (`t` = a tent in the placement this puzzle was
 * authored from, `.` = empty). The tent grid exists only so `rowCounts`/
 * `colCounts` can be *derived* from a real, hand-verified placement rather
 * than hand-counted (an easy place to introduce an off-by-one) - it is
 * discarded immediately after parsing and never stored on the puzzle. A
 * puzzle's actual solvability and uniqueness are verified by the real
 * solver in the test suite, not by this parser.
 */
function fromGrids(
  id: string,
  name: string,
  difficulty: PuzzleDifficulty,
  treeRows: ReadonlyArray<string>,
  tentRows: ReadonlyArray<string>,
): TentsTreesPuzzle {
  const rows = treeRows.length;
  const cols = treeRows[0].length;

  const trees: TentsTreesCell[] = [];
  treeRows.forEach((line, r) => {
    if (line.length !== cols) {
      throw new Error(`${id}: tree row ${r} has length ${line.length}, expected ${cols}.`);
    }
    for (let c = 0; c < cols; c += 1) {
      const ch = line[c];
      if (ch === 'T') trees.push({ row: r, col: c });
      else if (ch !== '.') throw new Error(`${id}: unrecognized tree-grid character "${ch}" at (${r}, ${c}).`);
    }
  });

  if (tentRows.length !== rows) {
    throw new Error(`${id}: tent grid must have ${rows} rows, has ${tentRows.length}.`);
  }
  const rowCounts: number[] = [];
  const colCounts: number[] = new Array(cols).fill(0);
  tentRows.forEach((line, r) => {
    if (line.length !== cols) {
      throw new Error(`${id}: tent row ${r} has length ${line.length}, expected ${cols}.`);
    }
    let count = 0;
    for (let c = 0; c < cols; c += 1) {
      const ch = line[c];
      if (ch === 't') {
        count += 1;
        colCounts[c] += 1;
      } else if (ch !== '.') {
        throw new Error(`${id}: unrecognized tent-grid character "${ch}" at (${r}, ${c}).`);
      }
    }
    rowCounts.push(count);
  });

  return { id, name, difficulty, rows, cols, trees, rowCounts, colCounts };
}

// Difficulty follows this game's own real complexity signal, grid size (see
// `PuzzleDifficulty`'s comment in `types.ts`): the three 5x5s are easy, the
// three 6x6s plus the first 7x7 are medium, the second 7x7 plus both 8x8s
// are hard - matching the size ramp already baked into this array's order.
export const TENTS_TREES: ReadonlyArray<TentsTreesPuzzle> = [
  fromGrids(
    'tents-001',
    'First Grove',
    'easy',
    ['.T...', '.....', '..T..', '.....', 'T....'],
    ['.....', '.t...', '.....', 't.t..', '.....'],
  ),
  fromGrids(
    'tents-002',
    'Twin Rows',
    'easy',
    ['.....', '.T.T.', '.....', '.T.T.', '.....'],
    ['.t.t.', '.....', '.....', '.....', '.t.t.'],
  ),
  fromGrids(
    'tents-003',
    'Scattered Grove',
    'easy',
    ['..T..', '.....', 'T...T', '.....', '..T..'],
    ['.....', 't.t..', '.....', '....t', '.t...'],
  ),
  fromGrids(
    'tents-004',
    'Four Corners',
    'medium',
    ['T....T', '......', '..T...', '......', '......', 'T....T'],
    ['......', 't....t', '......', '..t...', 't....t', '......'],
  ),
  fromGrids(
    'tents-005',
    'Inner Ring',
    'medium',
    ['......', '.T..T.', '......', '......', '.T..T.', '......'],
    ['.t..t.', '......', '......', '......', '......', '.t..t.'],
  ),
  fromGrids(
    'tents-006',
    'Twin Columns',
    'medium',
    ['......', 'T.T.T.', '......', '......', '.T.T.T', '......'],
    ['t.t.t.', '......', '......', '......', '......', '.t.t.t'],
  ),
  fromGrids(
    'tents-007',
    'Wide Grove',
    'medium',
    ['T.....T', '.......', '.......', '...T...', '.......', '.......', 'T.....T'],
    ['.......', 't.....t', '...t...', '.......', '.......', 't.....t', '.......'],
  ),
  fromGrids(
    'tents-008',
    'Checkered Grove',
    'hard',
    ['.......', '.T...T.', '.......', '...T...', '.......', '.T...T.', '.......'],
    ['.t...t.', '.......', '...t...', '.......', '.......', '.......', '.t...t.'],
  ),
  fromGrids(
    'tents-009',
    'Deep Woods',
    'hard',
    ['T......T', '........', '........', '...T....', '....T...', '........', '........', 'T......T'],
    ['........', 't......t', '...t....', '........', '........', '....t...', 't......t', '........'],
  ),
  fromGrids(
    'tents-010',
    'Old Forest',
    'hard',
    ['T......T', '........', '..T..T..', '........', '........', '..T..T..', '........', 'T......T'],
    ['........', 't......t', '........', '..t..t..', '........', '........', 't.t..t.t', '........'],
  ),
];

export function getTentsTreesById(id: string): TentsTreesPuzzle | undefined {
  return TENTS_TREES.find(puzzle => puzzle.id === id);
}

export function getTentsTreesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<TentsTreesPuzzle> {
  return TENTS_TREES.filter(puzzle => puzzle.difficulty === difficulty);
}

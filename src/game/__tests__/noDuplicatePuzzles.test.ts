import { LEVELS } from '../levels';
import { MIRROR_MAZES } from '../mirror';
import { TENTS_TREES } from '../tents';
import { TOWERS } from '../towers';
import { BINAIRO } from '../binairo';
import { ARUKONE } from '../arukone';
import { FILLAPIX } from '../fillapix';
import { LIGHTS_OUT } from '../lightsout';
import { BLOOM, tileEnds } from '../bloom';
import { ADJACENT } from '../adjacent';

/**
 * No game may ship the same puzzle twice.
 *
 * "The same" deliberately means *up to symmetry and padding*, not merely
 * byte-identical, because that is how duplicates actually reach a pool
 * here. Two of them were shipped and neither was a copy-paste: a Mirror
 * Maze board turned a quarter turn, and an Arukone+ board turned a half
 * turn. Read as literal arrays they look like different puzzles. Played,
 * they are the same puzzle, and a player who meets both has been handed
 * the same problem twice - which is exactly the "the levels repeat"
 * complaint this test exists to make impossible.
 *
 * Padding is folded in too: a smaller board centred inside a larger grid
 * with blank rows around it is the same puzzle wearing a bigger frame,
 * and that trick has caught this pool before.
 *
 * Each game canonicalises to a character grid holding whatever actually
 * defines its board. Getting that set right is the whole test: include
 * too little and unrelated puzzles collide, too much and a genuine
 * duplicate slips through wearing a different name.
 */

type Grid = string[][];

function blank(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () => Array<string>(cols).fill('.'));
}

/** Drops all-blank border rows and columns, so a board padded out to a
 * larger grid compares equal to the board it was padded from. */
function trim(grid: Grid): Grid {
  let top = 0;
  let bottom = grid.length - 1;
  let left = 0;
  let right = grid[0].length - 1;
  const rowBlank = (r: number): boolean => grid[r].every(cell => cell === '.');
  const colBlank = (c: number): boolean => grid.every(row => row[c] === '.');
  while (top < bottom && rowBlank(top)) top += 1;
  while (bottom > top && rowBlank(bottom)) bottom -= 1;
  while (left < right && colBlank(left)) left += 1;
  while (right > left && colBlank(right)) right -= 1;
  return grid.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
}

function rotate(grid: Grid): Grid {
  const rows = grid.length;
  const cols = grid[0].length;
  return Array.from({ length: cols }, (_, r) => Array.from({ length: rows }, (__, c) => grid[rows - 1 - c][r]));
}

function flip(grid: Grid): Grid {
  return grid.map(row => [...row].reverse());
}

/** The lexicographically smallest of a board's eight dihedral forms -
 * two boards share one exactly when they are the same board turned or
 * reflected. */
function canonical(grid: Grid): string {
  const forms: string[] = [];
  let current = trim(grid);
  for (let i = 0; i < 4; i += 1) {
    forms.push(current.map(row => row.join('')).join('/'));
    forms.push(flip(current).map(row => row.join('')).join('/'));
    current = rotate(current);
  }
  return forms.sort()[0];
}

/**
 * Groups that are allowed to be the same board, and why.
 *
 * Only one thing earns a place here: a *first-exposure* level teaching
 * that a rule works in every direction. Gravity's opening three levels
 * are one board rotated on purpose - level-003's own note is "gravity
 * can point 'up' too - all four directions exist" - and the anchor
 * tutorial repeats the trick for the same reason. To a player meeting
 * the rule for the first time those read as three discoveries, not one
 * puzzle three times.
 *
 * Everything else that collided was padding and has been replaced: three
 * levels whose names literally ended in ", Mirrored", and one pair
 * presented as two different puzzles with two different explanations
 * that were the same board turned. The list is deliberately explicit
 * rather than a blanket "tutorial levels are exempt" rule - a tag would
 * let the next mirrored board in silently.
 */
const ALLOWED_TEACHING_REPEATS: ReadonlyArray<ReadonlyArray<string>> = [
  // "A direction is a direction" - levels 1-3, the opening minute.
  ['level-001', 'level-002', 'level-003'],
  // "And two of them in sequence still works whichever two" - levels 4-5.
  ['level-004', 'level-005'],
  // The same lesson again for anchors, the first time that rule appears.
  ['level-021', 'level-031', 'level-032'],
];

function isAllowed(ids: ReadonlyArray<string>): boolean {
  const key = [...ids].sort().join(',');
  return ALLOWED_TEACHING_REPEATS.some(group => [...group].sort().join(',') === key);
}

function expectNoDuplicates(game: string, entries: ReadonlyArray<readonly [string, Grid]>): void {
  const byShape = new Map<string, string[]>();
  for (const [id, grid] of entries) {
    const key = canonical(grid);
    byShape.set(key, [...(byShape.get(key) ?? []), id]);
  }
  const duplicates = [...byShape.values()].filter(ids => ids.length > 1 && !isAllowed(ids));
  expect({ game, duplicates }).toEqual({ game, duplicates: [] });
}

describe('no game ships the same puzzle twice', () => {
  test('Gravity - every mechanic on the board, not just the pieces', () => {
    // Each mechanic gets its own character. Leaving any of them out
    // makes this test lie: a first pass compared only pieces, targets,
    // obstacles and anchors, and duly reported level-001 as a duplicate
    // of a *hazard* level whose hazard it could not see. Portals are
    // marked as an unordered pair - which end is which does not change
    // the puzzle - and a gravity zone stamps every cell it covers with
    // its own pull direction, since the same rectangle pulling a
    // different way is a different board.
    expectNoDuplicates(
      'gravity',
      LEVELS.map(level => {
        const grid = blank(level.rows, level.cols);
        if (level.zone) {
          const mark = { up: 'u', down: 'd', left: 'l', right: 'r' }[level.zone.direction] ?? 'z';
          for (let r = level.zone.minRow; r <= level.zone.maxRow; r += 1) {
            for (let c = level.zone.minCol; c <= level.zone.maxCol; c += 1) grid[r][c] = mark;
          }
        }
        for (const o of level.obstacles ?? []) grid[o.row][o.col] = 'X';
        for (const h of level.hazards ?? []) grid[h.row][h.col] = 'H';
        for (const [a, b] of level.portals ?? []) {
          grid[a.row][a.col] = 'P';
          grid[b.row][b.col] = 'P';
        }
        for (const a of level.anchors ?? []) grid[a.row][a.col] = 'A';
        for (const t of level.targets) grid[t.row][t.col] = 'T';
        for (const o of level.objects) grid[o.row][o.col] = 'O';
        return [level.id, grid] as const;
      }),
    );
  });

  test('Mirror Maze - source, target, gems and obstacles', () => {
    expectNoDuplicates(
      'mirror',
      MIRROR_MAZES.map(puzzle => {
        const grid = blank(puzzle.rows, puzzle.cols);
        for (const o of puzzle.obstacles ?? []) grid[o.row][o.col] = 'X';
        for (const gem of puzzle.gems ?? []) grid[gem.row][gem.col] = 'G';
        grid[puzzle.source.row][puzzle.source.col] = 'S';
        grid[puzzle.target.row][puzzle.target.col] = 'E';
        // The beam's direction is part of the puzzle, so it has to be
        // part of the shape - and it has to *rotate with it*. Marking
        // the first cell the beam enters turns a direction into
        // geometry, which the dihedral fold then handles for free.
        const step = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[puzzle.sourceDirection] ?? [0, 0];
        const er = puzzle.source.row + step[0];
        const ec = puzzle.source.col + step[1];
        if (er >= 0 && er < puzzle.rows && ec >= 0 && ec < puzzle.cols && grid[er][ec] === '.') grid[er][ec] = '>';
        return [puzzle.id, grid] as const;
      }),
    );
  });

  test('Tents and Trees - tree placement', () => {
    expectNoDuplicates(
      'tents',
      TENTS_TREES.map(puzzle => {
        const grid = blank(puzzle.rows, puzzle.cols);
        for (const tree of puzzle.trees) grid[tree.row][tree.col] = 'T';
        return [puzzle.id, grid] as const;
      }),
    );
  });

  test('Arukone+ - terminals and obstacles', () => {
    expectNoDuplicates(
      'arukone',
      ARUKONE.map(puzzle => {
        const grid = blank(puzzle.size, puzzle.size);
        for (const o of puzzle.obstacles ?? []) grid[o.row][o.col] = 'X';
        // Terminals are marked without their number: a board relabelled
        // 1<->2 is the same board to solve, and should still collide.
        for (const pair of puzzle.pairs) {
          grid[pair.a.row][pair.a.col] = 'P';
          grid[pair.b.row][pair.b.col] = 'P';
        }
        return [puzzle.id, grid] as const;
      }),
    );
  });

  test('Binairo - the givens', () => {
    expectNoDuplicates(
      'binairo',
      BINAIRO.map(puzzle => [
        puzzle.id,
        puzzle.givens.map(row => row.map(v => (v === null ? '.' : String(v)))) as Grid,
      ] as const),
    );
  });

  test('Fill-a-Pix - the hidden picture', () => {
    expectNoDuplicates(
      'fillapix',
      FILLAPIX.map(puzzle => [
        puzzle.id,
        puzzle.solution.map(row => row.map(filled => (filled ? '#' : '.'))) as Grid,
      ] as const),
    );
  });

  test('Lights Out - the lit board', () => {
    expectNoDuplicates(
      'lightsout',
      LIGHTS_OUT.map(puzzle => [
        puzzle.id,
        puzzle.initial.map(row => row.map(lit => (lit ? '#' : '.'))) as Grid,
      ] as const),
    );
  });

  test('Adjacent - the dealt tray', () => {
    expectNoDuplicates(
      'adjacent',
      ADJACENT.map(puzzle => [
        puzzle.id,
        puzzle.initial.map(row => row.map(c => (c === null ? '.' : String(c)))) as Grid,
      ] as const),
    );
  });

  test('Bloom - the solved line picture', () => {
    // A tile's facing turns with the board, so the cells alone would not
    // rotate correctly. Drawn instead at double resolution: each cell
    // centre carries its kind, and each edge midpoint a line crosses is
    // marked - a picture that rotates and mirrors exactly as the board
    // does. (A knot's corner pairing is not encoded, which can only ever
    // report a duplicate too eagerly, never miss one.)
    /* eslint-disable no-bitwise -- tile ends are a 4-bit mask */
    expectNoDuplicates(
      'bloom',
      BLOOM.map(puzzle => {
        const size = puzzle.rows * 2 + 1;
        const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
        for (let r = 0; r < puzzle.rows; r += 1) {
          for (let c = 0; c < puzzle.cols; c += 1) {
            const kind = puzzle.kinds[r][c];
            if (kind === 'empty') continue;
            grid[2 * r + 1][2 * c + 1] = kind === 'knot' ? 'k' : 'a';
            const ends = tileEnds(kind, puzzle.solution[r][c]);
            if (ends & 1) grid[2 * r][2 * c + 1] = '#';
            if (ends & 2) grid[2 * r + 1][2 * c + 2] = '#';
            if (ends & 4) grid[2 * r + 2][2 * c + 1] = '#';
            if (ends & 8) grid[2 * r + 1][2 * c] = '#';
          }
        }
        return [puzzle.id, grid as Grid] as const;
      }),
    );
    /* eslint-enable no-bitwise */
  });

  test('Skyscrapers - the four clue edges', () => {
    // No grid to compare: a Skyscrapers puzzle *is* its clues. Rotating
    // the board cycles the four edges and reverses two of them, so the
    // canonical form is the smallest of those eight readings.
    const byClues = new Map<string, string[]>();
    for (const puzzle of TOWERS) {
      const forms: string[] = [];
      let [top, right, bottom, left] = [puzzle.topClues, puzzle.rightClues, puzzle.bottomClues, puzzle.leftClues];
      for (let i = 0; i < 4; i += 1) {
        forms.push([top, right, bottom, left].map(edge => edge.join('')).join('|'));
        forms.push(
          [[...top].reverse(), [...left].reverse(), [...bottom].reverse(), [...right].reverse()]
            .map(edge => edge.join(''))
            .join('|'),
        );
        [top, right, bottom, left] = [[...left].reverse(), top, [...right].reverse(), bottom];
      }
      const key = forms.sort()[0];
      byClues.set(key, [...(byClues.get(key) ?? []), puzzle.id]);
    }
    const duplicates = [...byClues.values()].filter(ids => ids.length > 1);
    expect({ game: 'towers', duplicates }).toEqual({ game: 'towers', duplicates: [] });
  });
});

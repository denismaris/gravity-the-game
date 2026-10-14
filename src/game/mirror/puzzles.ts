import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateMirrorMaze, MirrorRules } from './generator';
import { Direction, MirrorMazeCell, MirrorMazePuzzle } from './types';

const DIRECTION_BY_LETTER: Readonly<Record<string, Direction>> = {
  U: 'up',
  D: 'down',
  L: 'left',
  R: 'right',
};

/**
 * Parses a puzzle from ASCII art, matching this codebase's established
 * authoring convention (Gravity/Trajectory/Sudoku all do this). `.` = a
 * plain eligible cell, `#` = a fixed obstacle, `G` = a gem, `T` = the
 * target, and exactly one of `U`/`D`/`L`/`R` = the source cell, itself
 * naming the direction the beam starts moving. Later boards add `F` a ruby
 * filter, `r` a ruby gem and `S` a splitter. Mirrors are never part of
 * this grid - they're the player's own placements (`MirrorMazeState`), not
 * puzzle data, so there is nothing to encode for them here. A puzzle's
 * *solvability* is verified by the real solver in the test suite, not by
 * this parser.
 */
function fromGrid(id: string, name: string, difficulty: PuzzleDifficulty, rows: ReadonlyArray<string>): MirrorMazePuzzle {
  const height = rows.length;
  const width = rows[0].length;

  let source: MirrorMazeCell | null = null;
  let sourceDirection: Direction | null = null;
  let target: MirrorMazeCell | null = null;
  const gems: MirrorMazeCell[] = [];
  const obstacles: MirrorMazeCell[] = [];
  const rubyGems: number[] = [];
  const filters: MirrorMazeCell[] = [];
  const splitters: MirrorMazeCell[] = [];

  rows.forEach((line, row) => {
    if (line.length !== width) {
      throw new Error(`${id}: row ${row} has length ${line.length}, expected ${width}.`);
    }
    for (let col = 0; col < width; col += 1) {
      const ch = line[col];
      if (ch === '.') continue;
      if (ch === '#') {
        obstacles.push({ row, col });
        continue;
      }
      if (ch === 'G') {
        gems.push({ row, col });
        continue;
      }
      if (ch === 'r') {
        rubyGems.push(gems.length);
        gems.push({ row, col });
        continue;
      }
      if (ch === 'F') {
        filters.push({ row, col });
        continue;
      }
      if (ch === 'S') {
        splitters.push({ row, col });
        continue;
      }
      if (ch === 'T') {
        target = { row, col };
        continue;
      }
      const direction = DIRECTION_BY_LETTER[ch];
      if (direction) {
        source = { row, col };
        sourceDirection = direction;
        continue;
      }
      throw new Error(`${id}: unrecognized character "${ch}" at (${row}, ${col}).`);
    }
  });

  if (!source || !sourceDirection) throw new Error(`${id}: no source (U/D/L/R) found.`);
  if (!target) throw new Error(`${id}: no target (T) found.`);

  return {
    id,
    name,
    difficulty,
    rows: height,
    cols: width,
    source,
    sourceDirection,
    target,
    gems,
    obstacles,
    ...(rubyGems.length ? { rubyGems } : {}),
    ...(filters.length ? { filters } : {}),
    ...(splitters.length ? { splitters } : {}),
  };
}

/**
 * Difficulty used to follow grid size alone - 4x4 easy, 5x5 medium, 6x6
 * hard, a clean 4/4/4 split. Size turned out to be a poor proxy: the 6x6s
 * carry two or three gems on a mostly empty board and are solved in three
 * or four mirrors, which is why the top tier here read as easy.
 *
 * The real signal is how many mirrors a solution actually needs - every
 * one of them is a turn the beam has to be routed through, and the solver
 * only ever decides on cells the beam genuinely reaches, so that count is
 * load-bearing rather than incidental. The boards from `mirror-013` on
 * were found by searching random layouts with the real solver
 * (`solveMirrorMaze`) and keeping only those needing six or more; they run
 * to eleven and thirteen.
 *
 * The original twelve are all still here, at their honest tiers rather
 * than deleted: puzzle ids are keys into every player's saved best (see
 * `PlayerProgress.levels`), so re-pointing an existing id at different
 * content would silently invalidate a result somebody already earned.
 * What changed is only which tier each one answers to.
 */
export const MIRROR_MAZES: ReadonlyArray<MirrorMazePuzzle> = [
  // The on-ramp: 4x4s that teach placing and turning.
  fromGrid('mirror-001', 'First Light', 'easy', ['.D..', '...T', '....', '....']),
  fromGrid('mirror-002', 'Turn Twice', 'easy', ['D..T', '....', '....', '....']),
  fromGrid('mirror-003', 'First Gem', 'easy', ['..D.', '..G.', '...T', '....']),
  fromGrid('mirror-004', 'Doubling Back', 'easy', ['....', 'T...', '.G..', 'R...']),
  // Bigger, but still a handful of mirrors each - easy, not medium.
  fromGrid('mirror-005', 'Side Step', 'easy', ['....', 'RG..', '.#G.', 'T...']),
  // Replaced a board that was only 005 turned a quarter turn - same
  // puzzle, second name. This one needs four mirrors rather than one,
  // and its two gems sit together in the far corner, so the beam has to
  // be walked down and back rather than nudged once.
  fromGrid('mirror-006', 'Sweep the Floor', 'easy', ['..T..', '.....', '.....', '....L', 'GG...']),
  fromGrid('mirror-007', 'Two Gems', 'easy', ['D..T.', 'G....', '..G..', '.....', '.....']),
  fromGrid('mirror-008', 'Obstacle Course', 'easy', ['T...', '...G', '.G#.', '.U..']),
  // The old top tier, at its real weight.
  fromGrid('mirror-009', 'Turnstile', 'medium', ['.....', 'G....', '...G.', 'R..T#', '.....']),
  fromGrid('mirror-010', 'Gauntlet', 'medium', ['.....', '....L', 'T#...', 'G...G', '.....']),
  fromGrid('mirror-011', 'Crossroads', 'medium', ['..#G.', '....T', '.G...', '....G', 'U....']),
  fromGrid('mirror-012', "Master's Maze", 'medium', ['D..#.', '...G.', '..G..', '.....', '....T']),
  // Found by search: 5x5s needing six to ten mirrors.
  fromGrid('mirror-013', 'Switchback', 'medium', ['R...G', '.....', 'G..#.', '.T...', '.G...']),
  fromGrid('mirror-014', "Cat's Cradle", 'medium', ['.....', 'R.T..', '.G...', 'G#...', '...G.']),
  fromGrid('mirror-015', 'The Detour', 'medium', ['..G..', '...T.', '.....', 'R.G#.', '.G...']),
  fromGrid('mirror-016', 'Back and Forth', 'medium', ['R....', '..G#.', 'T....', '..G.G', '.....']),
  fromGrid('mirror-017', 'Winding Road', 'medium', ['R.#..', '.....', '..G.T', '...G.', '.G...']),
  // 6x6s needing seven to thirteen - the tier that was missing.
  fromGrid('mirror-018', 'Lantern Run', 'hard', ['.....G', 'G##...', 'G...#.', '.T...L', '......', 'G.....']),
  fromGrid('mirror-019', 'Switchyard', 'hard', ['...G..', '...T..', '.#....', '#.....', 'R.G.G.', '.G....']),
  fromGrid('mirror-020', 'The Long Haul', 'hard', ['R.....', 'G..G#.', 'T.....', '....#.', '..G..G', '......']),
  fromGrid('mirror-021', 'Labyrinth', 'hard', ['R.#...', '#.....', '..G..G', '....GT', '......', '.G....']),
  fromGrid('mirror-022', 'Five Points', 'hard', ['D.....', 'G.##..', '.G....', '..G.G.', '...G..', '....T.']),
  fromGrid('mirror-023', 'Full Circuit', 'hard', ['......', 'R..T..', '..G..G', '#.....', 'GG#...', '...G..']),  // Later boards: a ruby filter, and gems only a ruby beam lights.
fromGrid('mirror-r01', 'Ruby Light', 'medium', ['..T.#', '....#', '...G.', '..G..', '.rFU.']),
  fromGrid('mirror-r02', 'Rose Window', 'medium', ['R....', '#....', 'T..r.', '.F#..', '..r..']),
  fromGrid('mirror-r03', 'Stained Beam', 'hard', ['.....r', '...#r.', '.....L', 'F.#...', '.....#', 'G..T..']),
  // A splitter, sending the beam two ways at once.
  fromGrid('mirror-s01', 'The Prism', 'hard', ['T..#G.', 'S....G', 'R...#.', '......', '.G....', '....G.']),
  fromGrid('mirror-s02', 'Forked Light', 'hard', ['.T....', 'G....L', '#.SG..', '......', '.#....', '.....G']),
  fromGrid('mirror-s03', 'Two Ways Home', 'hard', ['D.G.r.', '...F..', 'GG#...', '......', '......', 'T...S.']),
];

export function getMirrorMazesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<MirrorMazePuzzle> {
  return MIRROR_MAZES.filter(puzzle => puzzle.difficulty === difficulty);
}

const endlessCache = new Map<string, MirrorMazePuzzle>();

/** What an endless board brings, from its id: medium often a ruby filter;
 * hard a splitter or a filter. */
function endlessRules(id: string, tier: PuzzleDifficulty): MirrorRules {
  /* eslint-disable no-bitwise -- FNV-1a */
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const roll = (h >>> 0) % 100;
  /* eslint-enable no-bitwise */
  if (tier === 'medium' && roll < 35) return { rubyGems: 1 };
  if (tier === 'hard' && roll < 30) return { splitter: true };
  if (tier === 'hard' && roll < 50) return { rubyGems: 2 };
  return {};
}

export function getMirrorMazeById(id: string): MirrorMazePuzzle | undefined {
  const found = MIRROR_MAZES.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'mirror') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateMirrorMaze(id, endlessName(endless.index, 'mirror'), endless.tier, endlessRules(id, endless.tier));
  endlessCache.set(id, puzzle);
  return puzzle;
}

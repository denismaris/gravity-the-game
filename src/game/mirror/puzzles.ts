import { PuzzleDifficulty } from '../puzzleDifficulty';
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
 * naming the direction the beam starts moving. Mirrors are never part of
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
  fromGrid('mirror-005', 'Side Step', 'easy', ['..D..', '..G..', '....T', '.....', '.....']),
  // Replaced a board that was only 005 turned a quarter turn - same
  // puzzle, second name. This one needs four mirrors rather than one,
  // and its two gems sit together in the far corner, so the beam has to
  // be walked down and back rather than nudged once.
  fromGrid('mirror-006', 'Sweep the Floor', 'easy', ['..T..', '.....', '.....', '....L', 'GG...']),
  fromGrid('mirror-007', 'Two Gems', 'easy', ['D..T.', 'G....', '..G..', '.....', '.....']),
  fromGrid('mirror-008', 'Obstacle Course', 'easy', ['#....', '.....', 'T....', '..G..', '..U..']),
  // The old top tier, at its real weight.
  fromGrid('mirror-009', 'Six by Six', 'medium', ['...D.T', '...G..', '....G.', '......', '......', '......']),
  fromGrid('mirror-010', 'Gauntlet', 'medium', ['#.....', '......', 'T.....', '.G....', '.G....', 'R.....']),
  fromGrid('mirror-011', 'Crossroads', 'medium', ['.....D', 'T....G', '...G..', '......', '......', '......']),
  fromGrid('mirror-012', "Master's Maze", 'medium', ['#.....', '......', '......', '....GT', '...G..', '....GL']),
  // Found by search: 5x5s needing six to ten mirrors.
  fromGrid('mirror-013', 'Switchback', 'medium', ['R...G', '.....', 'G..#.', '.T...', '.G...']),
  fromGrid('mirror-014', "Cat's Cradle", 'medium', ['.....', 'R.T..', '.G...', 'G#...', '...G.']),
  fromGrid('mirror-015', 'The Detour', 'medium', ['..G..', '...T.', '.....', 'R.G#.', '.G...']),
  fromGrid('mirror-016', 'Back and Forth', 'medium', ['R....', '..G#.', 'T....', '..G.G', '.....']),
  fromGrid('mirror-017', 'Winding Road', 'medium', ['R.#..', '.....', '..G.T', '...G.', '.G...']),
  // 6x6s needing seven to thirteen - the tier that was missing.
  fromGrid('mirror-018', 'Lantern Run', 'hard', ['R....G', '......', '....#.', 'GT#...', '......', '.GG...']),
  fromGrid('mirror-019', 'Switchyard', 'hard', ['...G..', '...T..', '.#....', '#.....', 'R.G.G.', '.G....']),
  fromGrid('mirror-020', 'The Long Haul', 'hard', ['R.....', 'G..G#.', 'T.....', '....#.', '..G..G', '......']),
  fromGrid('mirror-021', 'Labyrinth', 'hard', ['R.#...', '#.....', '..G..G', '....GT', '......', '.G....']),
  fromGrid('mirror-022', 'Five Points', 'hard', ['D.....', 'G.##..', '.G....', '..G.G.', '...G..', '....T.']),
  fromGrid('mirror-023', 'Full Circuit', 'hard', ['......', 'R..T..', '..G..G', '#.....', 'GG#...', '...G..']),
];

export function getMirrorMazesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<MirrorMazePuzzle> {
  return MIRROR_MAZES.filter(puzzle => puzzle.difficulty === difficulty);
}

export function getMirrorMazeById(id: string): MirrorMazePuzzle | undefined {
  return MIRROR_MAZES.find(puzzle => puzzle.id === id);
}

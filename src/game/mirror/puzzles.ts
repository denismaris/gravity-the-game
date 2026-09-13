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
function fromGrid(id: string, name: string, rows: ReadonlyArray<string>): MirrorMazePuzzle {
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
    rows: height,
    cols: width,
    source,
    sourceDirection,
    target,
    gems,
    obstacles,
  };
}

export const MIRROR_MAZES: ReadonlyArray<MirrorMazePuzzle> = [
  fromGrid('mirror-001', 'First Light', ['.D..', '...T', '....', '....']),
  fromGrid('mirror-002', 'Turn Twice', ['D..T', '....', '....', '....']),
  fromGrid('mirror-003', 'First Gem', ['..D.', '..G.', '...T', '....']),
  fromGrid('mirror-004', 'Doubling Back', ['....', 'T...', '.G..', 'R...']),
  fromGrid('mirror-005', 'Side Step', ['..D..', '..G..', '....T', '.....', '.....']),
  fromGrid('mirror-006', 'Long Way Round', ['..T..', '.....', 'RG...', '.....', '.....']),
  fromGrid('mirror-007', 'Two Gems', ['D..T.', 'G....', '..G..', '.....', '.....']),
  fromGrid('mirror-008', 'Obstacle Course', ['#....', '.....', 'T....', '..G..', '..U..']),
  fromGrid('mirror-009', 'Six by Six', ['...D.T', '...G..', '....G.', '......', '......', '......']),
  fromGrid('mirror-010', 'Gauntlet', ['#.....', '......', 'T.....', '.G....', '.G....', 'R.....']),
  fromGrid('mirror-011', 'Crossroads', ['.....D', 'T....G', '...G..', '......', '......', '......']),
  fromGrid('mirror-012', "Master's Maze", ['#.....', '......', '......', '....GT', '...G..', '....GL']),
];

export function getMirrorMazeById(id: string): MirrorMazePuzzle | undefined {
  return MIRROR_MAZES.find(puzzle => puzzle.id === id);
}

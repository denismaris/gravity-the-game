import { TrajectoryCell, TrajectoryPuzzle } from './types';

/**
 * Builds a puzzle from a character grid: digits `1`-`9` are endpoint pairs
 * (each digit must appear exactly twice), `.` is an open cell.
 */
function fromGrid(id: string, name: string, art: string[]): TrajectoryPuzzle {
  const rows = art.length;
  const cols = art[0].length;
  const found = new Map<number, TrajectoryCell[]>();

  art.forEach((line, r) => {
    Array.from(line).forEach((ch, c) => {
      if (ch >= '1' && ch <= '9') {
        const color = Number(ch);
        const list = found.get(color) ?? [];
        list.push({ row: r, col: c });
        found.set(color, list);
      }
    });
  });

  const pairs = [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([color, cells]) => {
      if (cells.length !== 2) {
        throw new Error(`Trajectory ${id}: colour ${color} has ${cells.length} endpoints, expected 2.`);
      }
      return { color, a: cells[0], b: cells[1] };
    });

  return { id, name, rows, cols, pairs };
}

/** Hand-authored Trajectory (flow) puzzles, verified solvable in tests. */
export const TRAJECTORIES: ReadonlyArray<TrajectoryPuzzle> = [
  fromGrid('traj-001', 'Transfer', [
    '1...',
    '1...',
    '2...',
    '2...',
  ]),
  fromGrid('traj-002', 'Slingshot', [
    '1....',
    '.....',
    '12...',
    '.....',
    '....2',
  ]),
  fromGrid('traj-003', 'Rendezvous', [
    '1.1..',
    '..2..',
    '.....',
    '.....',
    '....2',
  ]),
  fromGrid('traj-004', 'Junction', [
    '1....',
    '21...',
    '.....',
    '..32.',
    '....3',
  ]),
  fromGrid('traj-005', 'Crossfire', [
    '1....',
    '..21.',
    '.....',
    '...32',
    '....3',
  ]),
  fromGrid('traj-006', 'Interchange', [
    '1.....',
    '..21..',
    '.....2',
    '.....3',
    '..34..',
    '4.....',
  ]),
  fromGrid('traj-007', 'Switchyard', [
    '1....4',
    '......',
    '.2..3.',
    '.1..4.',
    '......',
    '..23..',
  ]),
  fromGrid('traj-008', 'Convergence', [
    '1......',
    '...21..',
    '.....23',
    '.......',
    '.34....',
    '.54....',
    '......5',
  ]),
];

export function getTrajectoryById(id: string): TrajectoryPuzzle | undefined {
  return TRAJECTORIES.find(puzzle => puzzle.id === id);
}

import { RELAX_MAX_COLS, RELAX_MAX_ROWS, RELAX_TIERS, relaxBreakMazes, relaxMazeStats, safeSilhouette } from '../relax';
import { MazeShape, cellKey } from '../shape';

function floorOf(maze: MazeShape): boolean[][] {
  return Array.from({ length: maze.rows }, (_v, row) => Array.from({ length: maze.cols }, (_w, col) => maze.active.has(`${col}:${row}`)));
}

function picture(maze: MazeShape): string {
  return floorOf(maze)
    .map(line => line.map(on => (on ? '#' : '.')).join(''))
    .join('/');
}

const SEEDS = Array.from({ length: 60 }, (_v, i) => 1000 + i * 7919);

describe('relaxBreakMazes', () => {
  test('every maze can be painted by rolling wall to wall from its start', () => {
    for (const seed of SEEDS) {
      for (const maze of relaxBreakMazes(seed)) {
        const stats = relaxMazeStats(floorOf(maze), maze.start);
        expect(stats.connected).toBe(true);
        expect(stats.finishable).toBe(true);
        expect(stats.trapFree).toBe(true);
      }
    }
  });

  test('each break climbs its tiers, and every maze fits the arena', () => {
    for (const seed of SEEDS) {
      relaxBreakMazes(seed).forEach((maze, i) => {
        const stats = relaxMazeStats(floorOf(maze), maze.start);
        expect(stats.cells).toBeGreaterThanOrEqual(RELAX_TIERS[i].minCells);
        expect(stats.cells).toBeLessThanOrEqual(RELAX_TIERS[i].maxCells);
        expect(stats.stops).toBeGreaterThanOrEqual(RELAX_TIERS[i].minStops);
        expect(maze.cols).toBeLessThanOrEqual(RELAX_MAX_COLS);
        expect(maze.rows).toBeLessThanOrEqual(RELAX_MAX_ROWS);
      });
    }
  });

  test('is trimmed - no empty edge row or column', () => {
    for (const seed of SEEDS) {
      for (const maze of relaxBreakMazes(seed)) {
        const floor = floorOf(maze);
        expect(floor[0].some(Boolean)).toBe(true);
        expect(floor[maze.rows - 1].some(Boolean)).toBe(true);
        expect(floor.some(line => line[0])).toBe(true);
        expect(floor.some(line => line[maze.cols - 1])).toBe(true);
      }
    }
  });

  test('is reproducible from its seed', () => {
    expect(relaxBreakMazes(42).map(picture)).toEqual(relaxBreakMazes(42).map(picture));
  });

  // The complaint this replaced: every break opened on the same maze.
  test('different breaks get different mazes', () => {
    const openers = new Set(SEEDS.map(seed => picture(relaxBreakMazes(seed)[0])));
    // A repeat is possible, just rare - and even then the start square
    // and the paint colour usually differ.
    expect(openers.size).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });
});

describe('relaxMazeStats', () => {
  test('a maze finishable from its start can still trap the ball', () => {
    // Found by search: every square paints from the top-left, but some
    // resting square can never roll back to it - a player who wanders
    // there is stuck with the maze unfinished.
    const trapped = ['##.##', '##.##', '.####', '...##'].map(line => [...line].map(ch => ch === '#'));
    const stats = relaxMazeStats(trapped, { col: 0, row: 0 });
    expect(stats.finishable).toBe(true);
    expect(stats.trapFree).toBe(false);
  });

  test('a ring never traps', () => {
    const ring = ['####', '#..#', '####'].map(line => [...line].map(ch => ch === '#'));
    expect(relaxMazeStats(ring, { col: 0, row: 0 }).trapFree).toBe(true);
  });

  test('a maze that needs a mid-corridor turn is not finishable', () => {
    // A plus sign: from the top arm's end the ball rolls straight through
    // the centre to the bottom, and never into the side arms.
    const plus = ['..#..', '..#..', '#####', '..#..', '..#..'].map(line => [...line].map(ch => ch === '#'));
    const stats = relaxMazeStats(plus, { col: 2, row: 0 });
    expect(stats.connected).toBe(true);
    expect(stats.finishable).toBe(false);
  });
});

describe('relaxBreakMazes shape', () => {
  test('mazes fill their box and have ways round', () => {
    for (const seed of SEEDS) {
      for (const maze of relaxBreakMazes(seed)) {
        const stats = relaxMazeStats(floorOf(maze), maze.start);
        expect(stats.density).toBeGreaterThanOrEqual(0.55);
        expect(stats.loops).toBeGreaterThanOrEqual(2);
        expect(maze.cols).toBeGreaterThanOrEqual(5);
        expect(maze.rows).toBeGreaterThanOrEqual(6);
      }
    }
  });

  test('a break deals quickly enough to build on the spot', () => {
    const started = Date.now();
    for (let i = 0; i < 20; i += 1) relaxBreakMazes(90000 + i);
    expect((Date.now() - started) / 20).toBeLessThan(150);
  });
});

describe('what a break may show', () => {
  test('no maze has a long arm sticking out, or a tall thin outline', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const maze of relaxBreakMazes(seed * 104729)) {
        const floor = Array.from({ length: maze.rows }, (_v, r) => Array.from({ length: maze.cols }, (_w, c) => maze.active.has(cellKey(c, r))));
        const stats = relaxMazeStats(floor, maze.start);
        expect(stats.longestSpur).toBeLessThanOrEqual(2);
        expect(safeSilhouette(stats)).toBe(true);
      }
    }
  });
});

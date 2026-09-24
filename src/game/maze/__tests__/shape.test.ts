import { generateMazeShape, isFullyConnected } from '../shape';

// A small deterministic PRNG (mulberry32) so this test is reproducible
// rather than depending on `Math.random`. Bitwise ops are the algorithm
// itself, not a style choice.
/* eslint-disable no-bitwise */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

describe('generateMazeShape', () => {
  it('is always fully connected from its own start cell', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const maze = generateMazeShape(7, 7, 0.55 + rng() * 0.25, rng);
      expect(isFullyConnected(maze)).toBe(true);
    }
  });

  it('carves roughly the requested cell count', () => {
    const rng = mulberry32(42);
    const maze = generateMazeShape(6, 6, 0.6, rng);
    expect(maze.active.size).toBe(Math.round(36 * 0.6));
  });

  it('never produces a cycle (spanning tree: edges = cells - 1)', () => {
    const rng = mulberry32(7);
    const maze = generateMazeShape(8, 5, 0.7, rng);
    expect(maze.openEdges.size).toBe(maze.active.size - 1);
  });
});

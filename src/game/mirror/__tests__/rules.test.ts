import { emptyMirrorMazeState, getMirrorMazeById, getMirrorMazesByDifficulty, isMirrorMazeSolved, MirrorMazePuzzle, solveMirrorMaze, traceAll } from '..';

const fixture = (extra: Partial<MirrorMazePuzzle>): MirrorMazePuzzle => ({
  id: 't', difficulty: 'easy', rows: 4, cols: 4, source: { row: 1, col: 0 }, sourceDirection: 'right', target: { row: 1, col: 3 }, gems: [], obstacles: [], ...extra,
});

describe('Mirror Maze: ruby light and splitters', () => {
  test('a ruby gem lights only after the filter', () => {
    const before = fixture({ filters: [{ row: 1, col: 2 }], gems: [{ row: 1, col: 1 }], rubyGems: [0] });
    expect(isMirrorMazeSolved(before, emptyMirrorMazeState(before))).toBe(false);
    const after = fixture({ filters: [{ row: 1, col: 1 }], gems: [{ row: 1, col: 2 }], rubyGems: [0] });
    expect(isMirrorMazeSolved(after, emptyMirrorMazeState(after))).toBe(true);
    expect(traceAll(after, emptyMirrorMazeState(after)).pieces.some(p => p.ruby)).toBe(true);
  });

  test('a splitter sends light both ways, and either half lights gems', () => {
    const p = fixture({ target: { row: 0, col: 2 }, splitters: [{ row: 1, col: 2 }], gems: [{ row: 3, col: 2 }] });
    const t = traceAll(p, emptyMirrorMazeState(p));
    expect(t.reached).toBe(true);
    expect(t.lit.has('3:2')).toBe(true);
    expect(isMirrorMazeSolved(p, emptyMirrorMazeState(p))).toBe(true);
  });

  test('the new boards are dealt and solvable, and endless ones sometimes bring them', () => {
    for (const id of ['mirror-r01', 'mirror-r02', 'mirror-r03', 'mirror-s01', 'mirror-s02', 'mirror-s03']) {
      const p = getMirrorMazeById(id)!;
      const [answer] = solveMirrorMaze(p, 1);
      expect(answer && isMirrorMazeSolved(p, answer)).toBe(true);
    }
    expect(getMirrorMazesByDifficulty('hard').map(p => p.id)).toContain('mirror-s01');
    const endless = [0, 1, 2, 3, 4, 5, 6, 7].map(i => getMirrorMazeById(`mirror-e-hard-${i}`)!);
    expect(endless.some(p => p.splitters?.length || p.filters?.length)).toBe(true);
  });
});

import { applyGravity, findShortestSolution } from '..';
import { createGameStateFromLevel, getLevelById, LevelDefinition } from '../../levels';

const base: LevelDefinition = { id: 't', order: 0, name: 't', rows: 1, cols: 5, objects: [{ row: 0, col: 0 }], targets: [{ row: 0, col: 4 }], obstacles: [], difficulty: 'easy' };

describe('Gravity: soft sand', () => {
  test('a ball that rolls onto sand stops there, and rolls off on the next tilt', () => {
    let s = createGameStateFromLevel({ ...base, sand: [{ row: 0, col: 2 }] });
    s = applyGravity(s, 'right');
    expect(s.movables[0].col).toBe(2);
    s = applyGravity(s, 'right');
    expect(s.movables[0].col).toBe(4);
  });

  test('every sand level is solved at its recorded depth, and cannot be solved without its sand', () => {
    for (let n = 231; n <= 236; n += 1) {
      const level = getLevelById(`level-${n}`)!;
      expect(level.sand!.length).toBeGreaterThanOrEqual(2);
      expect(findShortestSolution(createGameStateFromLevel(level), 14)?.length).toBe(level.metadata?.minMoves);
      expect(findShortestSolution(createGameStateFromLevel({ ...level, sand: [] }), 14)).toBeNull();
    }
  });
});

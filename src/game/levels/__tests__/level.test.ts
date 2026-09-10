import { assertValidLevel, createGameStateFromLevel } from '../level';
import { LevelDefinition } from '../level';
import { applyGravity } from '../../engine/gravity';
import { isPuzzleSolved } from '../../engine/completion';

const base: LevelDefinition = {
  id: 'test-level',
  order: 999,
  name: 'Test',
  rows: 6,
  cols: 6,
  objects: [{ row: 0, col: 2 }],
  targets: [{ row: 3, col: 2 }],
  obstacles: [],
  anchors: [{ row: 4, col: 2 }],
  difficulty: 'easy',
};

describe('createGameStateFromLevel with anchors', () => {
  test('anchors become anchored movables with stable ids', () => {
    const state = createGameStateFromLevel(base);

    const normal = state.movables.filter(m => !m.anchored);
    const anchored = state.movables.filter(m => m.anchored);

    expect(normal).toEqual([{ id: 'test-level-object-0', row: 0, col: 2 }]);
    expect(anchored).toEqual([{ id: 'test-level-anchor-0', row: 4, col: 2, anchored: true }]);
  });

  test('a level with no `anchors` field produces no anchored movables', () => {
    const noAnchors: LevelDefinition = { ...base, anchors: undefined };
    const state = createGameStateFromLevel(noAnchors);
    expect(state.movables.every(m => !m.anchored)).toBe(true);
    expect(state.movables).toHaveLength(1);
  });

  test('the resulting state plays: the object stops on the anchor and solves', () => {
    const state = createGameStateFromLevel(base);
    const after = applyGravity(state, 'down');
    expect(isPuzzleSolved(after)).toBe(true);
    expect(after.movables.find(m => m.id === 'test-level-object-0')).toMatchObject({ row: 3, col: 2 });
    expect(after.movables.find(m => m.id === 'test-level-anchor-0')).toMatchObject({ row: 4, col: 2 });
  });
});

describe('assertValidLevel - anchor rules', () => {
  test('accepts a well-formed level with anchors', () => {
    expect(() => assertValidLevel(base)).not.toThrow();
  });

  test('rejects an anchor out of bounds', () => {
    expect(() => assertValidLevel({ ...base, anchors: [{ row: 9, col: 0 }] })).toThrow(/anchor at/);
  });

  test('rejects two anchors on the same cell', () => {
    expect(() =>
      assertValidLevel({ ...base, anchors: [{ row: 4, col: 2 }, { row: 4, col: 2 }] }),
    ).toThrow(/two anchored objects overlap/);
  });

  test('rejects an anchor on a target (it could never be covered)', () => {
    expect(() => assertValidLevel({ ...base, anchors: [{ row: 3, col: 2 }] })).toThrow(
      /sits on a target/,
    );
  });

  test('rejects an anchor on a normal object start cell', () => {
    expect(() => assertValidLevel({ ...base, anchors: [{ row: 0, col: 2 }] })).toThrow(
      /overlaps a normal object/,
    );
  });

  test('rejects an anchor on an obstacle', () => {
    expect(() =>
      assertValidLevel({ ...base, obstacles: [{ row: 1, col: 1 }], anchors: [{ row: 1, col: 1 }] }),
    ).toThrow(/overlaps an obstacle/);
  });

  test('anchors are not counted against the object/target parity check', () => {
    // 1 object, 1 target, 3 anchors - still valid.
    expect(() =>
      assertValidLevel({
        ...base,
        anchors: [{ row: 4, col: 2 }, { row: 5, col: 0 }, { row: 5, col: 5 }],
      }),
    ).not.toThrow();
  });
});

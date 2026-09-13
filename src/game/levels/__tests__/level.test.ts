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

describe('createGameStateFromLevel with hazards', () => {
  const withHazard: LevelDefinition = { ...base, anchors: undefined, hazards: [{ row: 2, col: 2 }] };

  test('hazards become Hazard cells on the static grid', () => {
    const state = createGameStateFromLevel(withHazard);
    expect(state.staticGrid[2][2]).toBe('hazard');
  });

  test('a level with no `hazards` field has no hazard cells', () => {
    const state = createGameStateFromLevel(base);
    expect(state.staticGrid.flat()).not.toContain('hazard');
  });

  test('the resulting state plays: the object is destroyed on the hazard and the puzzle fails', () => {
    const state = createGameStateFromLevel(withHazard);
    const after = applyGravity(state, 'down');
    expect(after.movables.find(m => m.id === 'test-level-object-0')).toEqual({
      id: 'test-level-object-0',
      row: 2,
      col: 2,
      destroyed: true,
    });
    expect(isPuzzleSolved(after)).toBe(false);
  });
});

describe('assertValidLevel - hazard rules', () => {
  const withHazard: LevelDefinition = { ...base, anchors: undefined, hazards: [{ row: 2, col: 2 }] };

  test('accepts a well-formed level with a hazard', () => {
    expect(() => assertValidLevel(withHazard)).not.toThrow();
  });

  test('rejects a hazard out of bounds', () => {
    expect(() => assertValidLevel({ ...base, hazards: [{ row: 9, col: 0 }] })).toThrow(/hazard at/);
  });

  test('rejects two hazards on the same cell', () => {
    expect(() =>
      assertValidLevel({ ...base, hazards: [{ row: 2, col: 2 }, { row: 2, col: 2 }] }),
    ).toThrow(/two hazards overlap/);
  });

  test('rejects a hazard on a normal object start cell (it would start destroyed)', () => {
    expect(() => assertValidLevel({ ...base, hazards: [{ row: 0, col: 2 }] })).toThrow(
      /start destroyed/,
    );
  });

  test('rejects a hazard on a target (it could never be safely covered)', () => {
    expect(() => assertValidLevel({ ...base, hazards: [{ row: 3, col: 2 }] })).toThrow(
      /could never be safely covered/,
    );
  });

  test('rejects a hazard on an obstacle', () => {
    expect(() =>
      assertValidLevel({ ...base, obstacles: [{ row: 1, col: 1 }], hazards: [{ row: 1, col: 1 }] }),
    ).toThrow(/hazard overlaps an obstacle/);
  });

  test('rejects a hazard on an anchored object', () => {
    expect(() => assertValidLevel({ ...base, hazards: [{ row: 4, col: 2 }] })).toThrow(
      /hazard overlaps an anchored object/,
    );
  });
});

describe('portals', () => {
  const portalBase: LevelDefinition = {
    id: 'portal-level',
    order: 999,
    name: 'Portal Test',
    rows: 6,
    cols: 6,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 5, col: 5 }],
    obstacles: [],
    difficulty: 'easy',
    portals: [[{ row: 0, col: 3 }, { row: 5, col: 0 }]],
  };

  test('a well-formed portal level validates and builds portal geometry', () => {
    expect(() => assertValidLevel(portalBase)).not.toThrow();
    const state = createGameStateFromLevel(portalBase);
    expect(state.portals).toEqual([[{ row: 0, col: 3 }, { row: 5, col: 0 }]]);
  });

  test('a level with no `portals` field has an empty portal list', () => {
    const noPortals: LevelDefinition = { ...portalBase, portals: undefined };
    expect(createGameStateFromLevel(noPortals).portals).toEqual([]);
  });

  test('rejects a portal endpoint out of bounds', () => {
    expect(() =>
      assertValidLevel({ ...portalBase, portals: [[{ row: 0, col: 0 }, { row: 9, col: 9 }]] }),
    ).toThrow(/portal endpoint at/);
  });

  test('rejects a portal that links a cell to itself', () => {
    expect(() =>
      assertValidLevel({ ...portalBase, portals: [[{ row: 1, col: 1 }, { row: 1, col: 1 }]] }),
    ).toThrow(/links a cell .* to itself/);
  });

  test('rejects a portal endpoint on an obstacle / target / anchor', () => {
    expect(() =>
      assertValidLevel({
        ...portalBase,
        obstacles: [{ row: 2, col: 2 }],
        portals: [[{ row: 2, col: 2 }, { row: 4, col: 4 }]],
      }),
    ).toThrow(/portal endpoint overlaps an obstacle/);

    expect(() =>
      assertValidLevel({ ...portalBase, portals: [[{ row: 5, col: 5 }, { row: 4, col: 4 }]] }),
    ).toThrow(/portal endpoint overlaps a target/);

    expect(() =>
      assertValidLevel({
        ...portalBase,
        anchors: [{ row: 3, col: 3 }],
        portals: [[{ row: 3, col: 3 }, { row: 4, col: 4 }]],
      }),
    ).toThrow(/portal endpoint overlaps an anchored object/);

    expect(() =>
      assertValidLevel({
        ...portalBase,
        hazards: [{ row: 3, col: 3 }],
        portals: [[{ row: 3, col: 3 }, { row: 4, col: 4 }]],
      }),
    ).toThrow(/portal endpoint overlaps a hazard/);
  });

  test('rejects a cell used by two portal endpoints', () => {
    expect(() =>
      assertValidLevel({
        ...portalBase,
        portals: [
          [{ row: 1, col: 1 }, { row: 2, col: 2 }],
          [{ row: 2, col: 2 }, { row: 3, col: 3 }],
        ],
      }),
    ).toThrow(/more than one portal endpoint/);
  });

  test('the built state actually teleports an object through applyGravity', () => {
    const state = createGameStateFromLevel(portalBase);
    // Right from (0,0): enter (0,3), emerge at (5,0), slide right to (5,5).
    const after = applyGravity(state, 'right');
    expect(after.movables[0]).toMatchObject({ row: 5, col: 5 });
    expect(isPuzzleSolved(after)).toBe(true);
  });
});

describe('gravity zone', () => {
  const zoneBase: LevelDefinition = {
    id: 'zone-level',
    order: 999,
    name: 'Zone Test',
    rows: 7,
    cols: 7,
    objects: [{ row: 0, col: 0 }],
    targets: [{ row: 4, col: 6 }],
    obstacles: [],
    difficulty: 'easy',
    zone: { minRow: 4, maxRow: 6, minCol: 0, maxCol: 6, direction: 'right' },
  };

  test('a well-formed zone validates and is copied onto the state', () => {
    expect(() => assertValidLevel(zoneBase)).not.toThrow();
    const state = createGameStateFromLevel(zoneBase);
    expect(state.zone).toEqual({ minRow: 4, maxRow: 6, minCol: 0, maxCol: 6, direction: 'right' });
    // and it plays: "down" deflects the object right to the target.
    const after = applyGravity(state, 'down');
    expect(after.movables[0]).toMatchObject({ row: 4, col: 6 });
    expect(isPuzzleSolved(after)).toBe(true);
  });

  test('a level with no `zone` field has zone null', () => {
    const noZone: LevelDefinition = { ...zoneBase, zone: undefined };
    expect(createGameStateFromLevel(noZone).zone).toBeNull();
  });

  test('rejects inverted zone bounds', () => {
    expect(() =>
      assertValidLevel({ ...zoneBase, zone: { minRow: 5, maxRow: 2, minCol: 0, maxCol: 4, direction: 'up' } }),
    ).toThrow(/bounds are inverted/);
  });

  test('rejects a zone that extends outside the board', () => {
    expect(() =>
      assertValidLevel({ ...zoneBase, zone: { minRow: 0, maxRow: 9, minCol: 0, maxCol: 4, direction: 'up' } }),
    ).toThrow(/outside the 7x7 board/);
  });

  test('the zone may freely overlap obstacles, targets and object starts', () => {
    expect(() =>
      assertValidLevel({
        ...zoneBase,
        obstacles: [{ row: 5, col: 2 }],
        targets: [{ row: 5, col: 5 }],
        objects: [{ row: 5, col: 0 }],
        zone: { minRow: 3, maxRow: 6, minCol: 0, maxCol: 6, direction: 'left' },
      }),
    ).not.toThrow();
  });
});

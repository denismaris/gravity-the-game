import { applyGravity, GameState } from '../../engine';
import { portalRoute, teleportTiming } from '../useAnimatedMovables';

/** One piece on an empty 6x6 board with a portal pair. */
function board(piece: { row: number; col: number }, portals: GameState['portals']): GameState {
  return {
    rows: 6,
    cols: 6,
    staticGrid: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 0)) as unknown as GameState['staticGrid'],
    movables: [{ id: 'p', row: piece.row, col: piece.col, anchored: false, destroyed: false }] as unknown as GameState['movables'],
    portals,
    zone: null,
  };
}

describe('portalRoute', () => {
  test('finds the portal a piece went through, from where it started and stopped', () => {
    const portals: GameState['portals'] = [[{ row: 0, col: 3 }, { row: 4, col: 1 }]];
    const before = board({ row: 0, col: 0 }, portals);
    const after = applyGravity(before, 'right');
    const end = after.movables[0];
    expect(portalRoute(before.movables[0], end, portals)).toEqual({ enter: { row: 0, col: 3 }, exit: { row: 4, col: 1 } });
  });

  test('a plain slide, or one stopped short of a portal, has no route', () => {
    const portals: GameState['portals'] = [[{ row: 0, col: 3 }, { row: 0, col: 1 }]];
    expect(portalRoute({ row: 2, col: 0 }, { row: 2, col: 5 }, portals)).toBeNull();
    // Stopped in front of the entry, on the exit's own line.
    expect(portalRoute({ row: 0, col: 0 }, { row: 0, col: 2 }, [[{ row: 0, col: 4 }, { row: 0, col: 1 }]])).toBeNull();
  });

  test('a teleport takes long enough to see: sink, absence and rise on top of the runs', () => {
    const timing = teleportTiming({ enter: { row: 0, col: 3 }, exit: { row: 4, col: 1 } }, { row: 0, col: 0 }, { row: 4, col: 5 });
    expect(timing.total).toBe(timing.approach + timing.sink + timing.gone + timing.rise + timing.onward);
    expect(timing.sink + timing.gone + timing.rise).toBeGreaterThanOrEqual(600);
  });
});

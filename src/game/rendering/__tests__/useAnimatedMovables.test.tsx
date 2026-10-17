import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { applyGravity, GameState, MovableObject, StaticCellType } from '../../engine';
import { SlidePlan, useSlidePlan } from '../useAnimatedMovables';

let plan!: SlidePlan;
function Probe({ movables, instant = false }: { movables: ReadonlyArray<MovableObject>; instant?: boolean }): null {
  plan = useSlidePlan(movables, instant);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a move plans a slide from where each moving piece was, then settles', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 0, col: 2 }, { id: 'b', row: 4, col: 0 }]} />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'a', row: 4, col: 2 }, { id: 'b', row: 4, col: 0 }]} />));
  expect(plan.isAnimating).toBe(true);
  expect(plan.from.get('a')).toMatchObject({ row: 0, col: 2 });
  expect(plan.from.has('b')).toBe(false);
  act(() => jest.advanceTimersByTime(plan.duration));
  expect(plan.isAnimating).toBe(false);
  act(() => renderer.unmount());
});

test('a different board swapped in, with new pieces, does not slide or throw', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 0, col: 2 }]} />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'b', row: 2, col: 0 }]} />));
  expect(plan.isAnimating).toBe(false);
  expect(plan.from.size).toBe(0);
  act(() => renderer.unmount());
});

test('an instant change (undo, restart) snaps without a slide', () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Probe movables={[{ id: 'a', row: 4, col: 2 }]} instant />);
  });
  act(() => renderer.update(<Probe movables={[{ id: 'a', row: 0, col: 2 }]} instant />));
  expect(plan.isAnimating).toBe(false);
  expect(plan.from.size).toBe(0);
  act(() => renderer.unmount());
});

describe('a slide a zone bends into a portal', () => {
  // Falling from the top-left, the ball meets a zone along row 2 that
  // pushes it right, rolls into the portal at (2, 3), and comes out at
  // (4, 0) on the floor.
  const board = (row: number, col: number): GameState => ({
    rows: 5,
    cols: 5,
    staticGrid: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => StaticCellType.Empty)),
    movables: [{ id: 'a', row, col }],
    portals: [[{ row: 2, col: 3 }, { row: 4, col: 0 }]],
    zone: { minRow: 2, maxRow: 2, minCol: 0, maxCol: 4, direction: 'right' },
  });

  function BoardProbe({ state }: { state: GameState }): null {
    plan = useSlidePlan(state.movables, false, state.portals, state);
    return null;
  }

  test('follows the way it really went: down, round the corner, in, and out', () => {
    const before = board(0, 0);
    const after = applyGravity(before, 'down');
    expect(after.movables[0]).toMatchObject({ row: 4, col: 0 });

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<BoardProbe state={before} />);
    });
    act(() => renderer.update(<BoardProbe state={after} />));
    const teleport = plan.teleports.get('a');
    expect(teleport?.route.enter).toEqual({ row: 2, col: 3 });
    expect(teleport?.route.exit).toEqual({ row: 4, col: 0 });
    expect(teleport?.route.before).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
    ]);
    act(() => renderer.unmount());
  });
});

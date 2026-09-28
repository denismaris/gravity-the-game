import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TentsBoardView } from '../TentsBoardView';
import { emptyTentsTreesState, TENTS_TREES } from '../../game/tents';

/**
 * Regression test for the static/dynamic split: `StaticTentsChrome` and
 * `StaticTentsTrees` are memoized specifically because their own output
 * must not depend on the animation clock (`Date.now()`) at all - only a
 * tree's firefly may. If the split were done wrong (some clock-dependent
 * term left inside either static component), this would show up as the
 * board's own JSON output differing between two renders that are
 * identical in every real prop and differ only in `Date.now()` - exactly
 * the bug this split exists to prevent from creeping back in.
 *
 * `requestAnimationFrame` is mocked to a no-op (never actually invokes its
 * callback) rather than a real frame pump - this test only needs one
 * synchronous render per mocked time, not to advance the clock, and a
 * live RAF loop left running under `act()` in this environment never
 * naturally stops (see `useAnimationClock.test.tsx`, which mocks it for
 * the same reason).
 */
describe('TentsBoardView static/dynamic split', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('the board renders identically at two different clock times, once fireflies are excluded', () => {
    const puzzle = TENTS_TREES[0];
    const state = emptyTentsTreesState(puzzle);

    // Only the chrome and trees groups (the two static layers) - the root
    // `<Group>`'s remaining children are firefly `Circle`s, which are
    // *supposed* to differ between the two times below (that's the one
    // thing this split deliberately leaves dynamic).
    const staticLayers = (nowMs: number): unknown => {
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<TentsBoardView puzzle={puzzle} state={state} cellSize={32} solved={false} />);
      });
      const root = renderer.toJSON() as { children: unknown[] };
      const layers = root.children.slice(0, 2);
      act(() => {
        renderer.unmount();
      });
      dateSpy.mockRestore();
      return layers;
    };

    // Two times far enough apart to land in different points of the
    // firefly's 8s cycle and the lantern's breathing curve - if anything
    // in the static layers depended on time, these two would differ too.
    const first = staticLayers(0);
    const second = staticLayers(4000);

    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });
});

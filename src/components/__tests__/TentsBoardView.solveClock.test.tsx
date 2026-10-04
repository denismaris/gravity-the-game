import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TentsBoardView } from '../TentsBoardView';
import { TENTS_TREES, emptyTentsTreesState } from '../../game/tents';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Regression test for a finish animation that could never be seen.
 *
 * The board's clock was requested as `useAnimationClock(!solved && ...)`,
 * so it was switched **off** at the precise instant the board became
 * solved - which is when the lantern wave needs a frame per step to
 * advance. The wave was written, was correct, and rendered exactly one
 * frame in every game ever finished.
 *
 * Same shape as the Binairo error-timing bug that already has its own
 * test here: a board's "is anything animating" test has to already know
 * about the thing it is supposed to drive, or it deadlocks against it.
 *
 * `useAnimationClock` is spied on (the real implementation still runs
 * underneath) purely to observe *whether the board asks for frames* at
 * each moment. Spied on its defining module rather than the
 * `game/rendering` barrel, for the reason that test records: Babel
 * compiles the barrel's re-export to a non-configurable getter, which
 * `jest.spyOn` cannot redefine, but the getter reads the defining
 * module's export fresh on every call.
 */
describe('TentsBoardView - the solve wave gets a clock to run on', () => {
  let clockSpy: jest.SpyInstance;

  beforeEach(() => {
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Whether the most recent render asked for an active clock. */
  function askedForFrames(): boolean {
    const calls = clockSpy.mock.calls;
    return calls.length > 0 && calls[calls.length - 1][0] === true;
  }

  test('asks for frames while solved, not only while unsolved', () => {
    const puzzle = TENTS_TREES[0];
    const state = emptyTentsTreesState(puzzle);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TentsBoardView puzzle={puzzle} state={state} cellSize={40} solved={false} />,
      );
    });
    // Unsolved and untouched: no idle ambience, so no frames.
    expect(askedForFrames()).toBe(false);

    clockSpy.mockClear();
    act(() => {
      renderer.update(<TentsBoardView puzzle={puzzle} state={state} cellSize={40} solved />);
    });

    // The moment it is solved, the wave starts - so the board must still
    // be asking for frames. This is the assertion that failed before.
    expect(askedForFrames()).toBe(true);

    act(() => renderer.unmount());
  });

  test('stops asking once the wave has had time to finish', () => {
    const puzzle = TENTS_TREES[0];
    const state = emptyTentsTreesState(puzzle);
    const realNow = Date.now;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <TentsBoardView puzzle={puzzle} state={state} cellSize={40} solved />,
      );
    });
    expect(askedForFrames()).toBe(true);

    // Well past any plausible wave length: a solved, settled board has
    // nothing left to draw and must let the clock stop, or it re-renders
    // for the rest of the session behind the completion card.
    jest.spyOn(Date, 'now').mockReturnValue(realNow() + 10_000);
    clockSpy.mockClear();
    act(() => {
      renderer.update(<TentsBoardView puzzle={puzzle} state={state} cellSize={40} solved />);
    });
    expect(askedForFrames()).toBe(false);

    act(() => renderer.unmount());
  });
});

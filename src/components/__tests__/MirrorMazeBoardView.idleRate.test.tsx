import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { emptyMirrorMazeState, getMirrorMazeById, traceBeam } from '../../game/mirror';
import { IDLE_MOTION_FPS } from '../../game/rendering';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Regression test: the board ran its idle shimmer at the full 60fps for
 * the whole time a puzzle was unsolved. `revealing` was read as
 * `revealProgress < 1`, and `revealProgress` sits at 0 until the solve -
 * so ordinary play counted as "the beam is revealing" and asked for the
 * reveal's frame rate. Measured on a mounted screen, that was ~3x the idle
 * renders of every other board.
 *
 * Spied on the defining module rather than the barrel - see
 * `TentsBoardView.solveClock.test.tsx` for why.
 */
describe('MirrorMazeBoardView - idle clock rate', () => {
  let clockSpy: jest.SpyInstance;

  beforeEach(() => {
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function lastClockCall(): [boolean, number | undefined] {
    const calls = clockSpy.mock.calls;
    return calls[calls.length - 1] as [boolean, number | undefined];
  }

  test('an unsolved board asks for the idle rate, not the reveal rate', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const state = emptyMirrorMazeState(puzzle);
    const path = traceBeam(puzzle, state);
    act(() => {
      ReactTestRenderer.create(
        <MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={path} revealProgress={0} solved={false} />,
      );
    });
    expect(lastClockCall()).toEqual([true, IDLE_MOTION_FPS]);
  });

  test('a solved board mid-reveal still gets the full rate', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const state = emptyMirrorMazeState(puzzle);
    const path = traceBeam(puzzle, state);
    act(() => {
      ReactTestRenderer.create(
        <MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={path} revealProgress={0.3} solved />,
      );
    });
    expect(lastClockCall()).toEqual([true, 60]);
  });
});

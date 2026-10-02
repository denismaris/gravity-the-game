import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { emptyMirrorMazeState, getMirrorMazeById, traceBeam } from '../../game/mirror';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * The board's motion - the beam's breathing, the gems' shimmer and burst,
 * a mirror turning - runs on the UI thread. It used to run a JavaScript
 * clock that re-rendered the whole board twelve times a second (sixty
 * while anything moved), which is what made turning a mirror feel heavy on
 * a phone. Nothing here may ask for that clock again.
 *
 * Spied on the defining module rather than the barrel - see
 * `TentsBoardView.solveClock.test.tsx` for why.
 */
describe('MirrorMazeBoardView - no JavaScript clock', () => {
  let clockSpy: jest.SpyInstance;

  beforeEach(() => {
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('an unsolved board, and one mid-reveal, never ask for a clock', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const state = emptyMirrorMazeState(puzzle);
    const path = traceBeam(puzzle, state);
    for (const [solved, progress] of [[false, 0], [true, 0.3]] as const) {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={path} revealProgress={progress} solved={solved} />);
      });
      act(() => renderer.unmount());
    }
    expect(clockSpy).not.toHaveBeenCalled();
  });
});

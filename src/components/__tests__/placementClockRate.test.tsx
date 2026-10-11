import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { SkiaEntrance } from '../SkiaEntrance';
import { emptyMirrorMazeState, getMirrorMazeById, isEligible as mirrorEligible, setMirror, traceBeam } from '../../game/mirror';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Regression test for placements that played at 12fps and read as lag.
 *
 * Both boards run a throttled idle clock (`IDLE_MOTION_FPS`) for their
 * ambient decoration. A tent's pitch-in (150ms) and a mirror's flip
 * (260ms) were once drawn from that same clock, so they got two or three
 * frames each; then they pushed the clock to 60fps, re-rendering the
 * board's animated layer every frame. Now they play on the UI thread
 * (`SkiaEntrance`): the placement arrives as its own self-driven element,
 * and the JavaScript clock stays where it was.
 *
 * Spied on the defining module rather than the barrel - see
 * `TentsBoardView.solveClock.test.tsx` for why.
 */
describe('placement animations get full-rate frames', () => {
  let clockSpy: jest.SpyInstance;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Mirror Maze: a flipped mirror turns in on the UI thread, with no clock at all', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const empty = emptyMirrorMazeState(puzzle);
    let target: [number, number] | null = null;
    for (let r = 0; r < puzzle.rows && !target; r += 1) {
      for (let c = 0; c < puzzle.rows && !target; c += 1) if (mirrorEligible(puzzle, r, c)) target = [r, c];
    }
    const flipped = setMirror(empty, puzzle, target![0], target![1], 'fwd');
    const board = (state: typeof empty) => (
      <MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={traceBeam(puzzle, state)} revealProgress={0} solved={false} />
    );

    clockSpy.mockClear();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(board(empty));
    });
    act(() => renderer.update(board(flipped)));
    expect(renderer.root.findAllByType(SkiaEntrance)).toHaveLength(1);
    expect(clockSpy).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
});

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TentsBoardView } from '../TentsBoardView';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { TENTS_TREES, emptyTentsTreesState, isEligible as tentEligible, setMark } from '../../game/tents';
import { emptyMirrorMazeState, getMirrorMazeById, isEligible as mirrorEligible, setMirror, traceBeam } from '../../game/mirror';
import { IDLE_MOTION_FPS } from '../../game/rendering';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Regression test for placements that played at 12fps and read as lag.
 *
 * Both boards run a throttled idle clock (`IDLE_MOTION_FPS`) for their
 * ambient decoration. A tent's pitch-in (150ms) and a mirror's flip
 * (260ms) were drawn from that same clock, so they got two or three
 * frames each. A placement in flight must ask for the full rate, and the
 * board must fall back to idle once it has landed.
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

  function lastRate(): number | undefined {
    const calls = clockSpy.mock.calls;
    return calls[calls.length - 1][1] as number | undefined;
  }

  test('Tents: pitching a tent runs at 60fps, then settles back to idle', () => {
    const puzzle = TENTS_TREES[0];
    const empty = emptyTentsTreesState(puzzle);
    let target: [number, number] | null = null;
    for (let r = 0; r < puzzle.rows && !target; r += 1) {
      for (let c = 0; c < puzzle.cols && !target; c += 1) if (tentEligible(puzzle, r, c)) target = [r, c];
    }
    const pitched = setMark(empty, puzzle, target![0], target![1], 'tent');

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<TentsBoardView puzzle={puzzle} state={empty} cellSize={40} solved={false} />);
    });
    expect(lastRate()).toBe(IDLE_MOTION_FPS);

    act(() => renderer.update(<TentsBoardView puzzle={puzzle} state={pitched} cellSize={40} solved={false} />));
    expect(lastRate()).toBe(60);

    now += 1000;
    act(() => renderer.update(<TentsBoardView puzzle={puzzle} state={pitched} cellSize={40} solved={false} />));
    expect(lastRate()).toBe(IDLE_MOTION_FPS);
    act(() => renderer.unmount());
  });

  test('Mirror Maze: flipping a mirror runs at 60fps, then settles back to idle', () => {
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

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(board(empty));
    });
    expect(lastRate()).toBe(IDLE_MOTION_FPS);

    // The flourish is set from an effect, so the frame after the flip is
    // the one that has to ask for the full rate.
    act(() => renderer.update(board(flipped)));
    expect(lastRate()).toBe(60);

    now += 1000;
    act(() => renderer.update(board(flipped)));
    expect(lastRate()).toBe(IDLE_MOTION_FPS);
    act(() => renderer.unmount());
  });
});

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TentsBoardView } from '../TentsBoardView';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { SkiaEntrance } from '../SkiaEntrance';
import { TENTS_TREES, emptyTentsTreesState, isEligible as tentEligible, setMark } from '../../game/tents';
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

  function lastActive(): boolean | undefined {
    const calls = clockSpy.mock.calls;
    return calls.length ? (calls[calls.length - 1][0] as boolean) : undefined;
  }

  test('Tents: a pitched tent and a pencil mark arrive on the UI thread', () => {
    const puzzle = TENTS_TREES[0];
    const empty = emptyTentsTreesState(puzzle);
    const eligible: Array<[number, number]> = [];
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) if (tentEligible(puzzle, r, c)) eligible.push([r, c]);
    }
    const marked = setMark(empty, puzzle, eligible[0][0], eligible[0][1], 'marked');
    const pitched = setMark(marked, puzzle, eligible[1][0], eligible[1][1], 'tent');
    const board = (state: typeof empty) => <TentsBoardView puzzle={puzzle} state={state} cellSize={40} solved={false} />;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(board(empty));
    });
    // An untouched board asks for no frames at all (no idle ambience).
    expect(lastActive()).toBe(false);

    // A pencil mark sets off nothing else: it fades in by itself, and the
    // clock does not move.
    now += 1000;
    act(() => renderer.update(board(marked)));
    expect(renderer.root.findAllByType(SkiaEntrance)).toHaveLength(1);
    expect(lastActive()).toBe(false);

    // A tent pitches in by itself too (its glow may still take real frames
    // - that is an event of its own - but the pitch is not drawn from them).
    now += 1000;
    act(() => renderer.update(board(pitched)));
    expect(renderer.root.findAllByType(SkiaEntrance)).toHaveLength(1);

    // Long past everything: back to idle, nothing in flight.
    now += 3000;
    act(() => renderer.update(board(pitched)));
    expect(renderer.root.findAllByType(SkiaEntrance)).toHaveLength(0);
    expect(lastActive()).toBe(false);
    act(() => renderer.unmount());
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

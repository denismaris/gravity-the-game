import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BinairoBoardView } from '../BinairoBoardView';
import { BinairoPuzzle, BinairoState } from '../../game/binairo';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Regression test for a real bug reported from a phone: a fresh violation
 * (three identical adjacent tiles, in this fixture) sat with no visible
 * error at all until the player made some *other* move.
 *
 * Root cause was a chicken-and-egg deadlock. The hazard tape's own onset
 * is deliberately delayed (`ERROR_DELAY_MS`) so a violation mid-cycle
 * through a tap doesn't flare and vanish - but resolving that delay needs
 * the animation clock to keep ticking so the component re-renders once
 * the delay has actually elapsed. The clock's own "is anything animating"
 * check only counted a violation once it was *already* past that delay -
 * so a brand-new one left the clock idle for the entire delay window, and
 * only reappeared on whatever unrelated render came next.
 *
 * `useAnimationClock` is spied on (the real implementation still runs
 * underneath) purely to observe whether the board asks for an active
 * clock at each moment - not to run one. A live RAF loop under `act()`
 * never naturally stops in this environment (see `TentsBoardView.test.tsx`'s
 * own note), and this test does not need real frames: the *decision* to
 * request them is what is under test.
 *
 * Spied on its *defining* module (`useAnimationClock.ts`), not the
 * `game/rendering` barrel `BinairoBoardView.tsx` actually imports it
 * from: Babel compiles the barrel's re-export to a getter with no
 * `configurable: true`, which `jest.spyOn` cannot redefine. The getter
 * reads the defining module's own export fresh on every call, though, so
 * spying there is observed through the barrel just the same.
 */
describe('BinairoBoardView - a fresh violation resolves on its own, without another move', () => {
  let clockSpy: jest.SpyInstance;

  beforeEach(() => {
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const puzzle: BinairoPuzzle = {
    id: 'fixture-triple-run',
    difficulty: 'easy',
    size: 4,
    givens: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  };

  const clean: BinairoState = {
    values: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  };

  // Three matching cells at the start of row 0; the rest of the row (and
  // the whole board) is still blank - exactly the "placed three of the
  // same tile and kept going" moment that was reported as showing nothing.
  const tripleRunMidFill: BinairoState = {
    values: [
      [0, 0, 0, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  };

  function lastActive(): boolean {
    const calls = clockSpy.mock.calls;
    return calls[calls.length - 1][0];
  }

  test('the clock goes idle once the board is clean and its own intro wave has finished', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    // Mount while the intro wave (a fixed 700ms flourish on every mount,
    // unrelated to errors) is still playing - the clock is legitimately
    // active here for that reason alone.
    jest.spyOn(Date, 'now').mockReturnValue(0);
    act(() => {
      renderer = ReactTestRenderer.create(<BinairoBoardView puzzle={puzzle} state={clean} size={320} solved={false} />);
    });
    expect(lastActive()).toBe(true);

    // Long past the intro, board still clean, nothing pending: this is
    // the true idle baseline every later assertion in this file is
    // measured against.
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    act(() => {
      renderer.update(<BinairoBoardView puzzle={puzzle} state={clean} size={320} solved={false} />);
    });
    expect(lastActive()).toBe(false);

    act(() => {
      renderer.unmount();
    });
  });

  test('a brand-new violation flips the clock straight back on, before its own onset delay has elapsed', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    jest.spyOn(Date, 'now').mockReturnValue(0);
    act(() => {
      renderer = ReactTestRenderer.create(<BinairoBoardView puzzle={puzzle} state={clean} size={320} solved={false} />);
    });

    // Past the intro, still clean - the idle baseline, confirmed again
    // right before introducing the violation so the next assertion is
    // attributable only to what changes next.
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    act(() => {
      renderer.update(<BinairoBoardView puzzle={puzzle} state={clean} size={320} solved={false} />);
    });
    expect(lastActive()).toBe(false);

    // The triple run appears now (t=5000, its "first seen" moment) - well
    // inside its own `ERROR_DELAY_MS` (450ms) onset delay, so the hazard
    // tape itself has not appeared yet. This is the exact deadlock: the
    // clock has to be the thing that wakes the board up once that delay
    // passes, and it can only do that if it is already running.
    act(() => {
      renderer.update(<BinairoBoardView puzzle={puzzle} state={tripleRunMidFill} size={320} solved={false} />);
    });
    expect(lastActive()).toBe(true);

    act(() => {
      renderer.unmount();
    });
  });
});

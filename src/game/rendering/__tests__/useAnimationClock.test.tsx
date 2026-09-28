import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useAnimationClock } from '../useAnimationClock';

/**
 * The throttle is a performance guarantee, not a detail: two boards drive
 * this clock for the whole time a puzzle is unsolved, so "how often does
 * this re-render" is the single biggest lever on steady render cost in the
 * app. These count renders rather than trusting the arithmetic.
 */
function Probe({ active, fps, onRender }: { active: boolean; fps?: number; onRender: () => void }): React.JSX.Element {
  const elapsed = useAnimationClock(active, fps);
  onRender();
  return <Text>{elapsed}</Text>;
}

/** Drives `count` animation frames at `stepMs` apart, with the clock
 * advanced in step so the hook sees real elapsed time. */
function runFrames(count: number, stepMs: number): void {
  for (let i = 0; i < count; i += 1) {
    act(() => {
      jest.advanceTimersByTime(stepMs);
    });
  }
}

describe('useAnimationClock', () => {
  let rafCallbacks: Array<() => void>;
  let now: number;

  beforeEach(() => {
    jest.useFakeTimers();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    rafCallbacks = [];
    // A frame pump that advances the mocked clock, so throttling is
    // exercised against elapsed time rather than frame count.
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: (t: number) => void) => {
      const id = setTimeout(() => {
        now += 16;
        cb(now);
      }, 16) as unknown as number;
      rafCallbacks.push(() => clearTimeout(id));
      return id;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id?: number | null) => clearTimeout(id as never));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('does not render at all while inactive', () => {
    const onRender = jest.fn();
    act(() => {
      TestRenderer.create(<Probe active={false} onRender={onRender} />);
    });
    const initial = onRender.mock.calls.length;
    runFrames(20, 16);
    expect(onRender.mock.calls.length).toBe(initial);
  });

  /** Renders one probe alone and returns how many times it rendered. The
   * probe must be unmounted before the next measurement: a second live
   * clock would also be pumping the shared fake `Date.now`, double-
   * stepping the one under test. */
  function countRenders(fps?: number): number {
    const onRender = jest.fn();
    now = 1_000_000;
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(<Probe active fps={fps} onRender={onRender} />);
    });
    runFrames(30, 16);
    act(() => {
      tree?.unmount();
    });
    return onRender.mock.calls.length;
  }

  test('a 30fps clock renders substantially less often than an unthrottled one', () => {
    const fastRenders = countRenders();
    const slowRenders = countRenders(30);

    expect(slowRenders).toBeLessThan(fastRenders);
    // Not exactly half, and it should not be asserted as such: against a
    // discrete 16ms frame pump a 16.67ms interval lands every second frame
    // and a 33.3ms one every third, so the real ratio here is 3:2. What
    // matters is that the saving is large, not that it hits a round
    // number the frame grid cannot actually express.
    expect(slowRenders).toBeLessThan(fastRenders * 0.8);
  });
});

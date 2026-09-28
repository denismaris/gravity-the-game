import { useEffect, useRef, useState } from 'react';

/**
 * A monotonically increasing "milliseconds since this clock started" value,
 * ticking once per frame while `active`, frozen at its last value when not.
 *
 * One clock feeds every continuous animation on a screen (an idle pulse, a
 * shimmer, a short flourish counted from its own start time) rather than each
 * effect owning its own `requestAnimationFrame` loop - several concurrent RAF
 * loops on one screen all wake the same display refresh anyway, so sharing a
 * single one is strictly cheaper and keeps every animation phase-locked to
 * the same timebase.
 *
 * Same shape as `useAnimatedMovables`/`useAnimatedBeamReveal`: a RAF loop
 * computing a plain number via `setState`, consumed by declarative Skia JSX.
 * No Reanimated/worklets package is installed in this project.
 *
 * Callers should keep whatever re-renders on this value as small as
 * possible - an idle pulse runs for as long as the player sits on the
 * puzzle, so the per-frame subtree wants to be a handful of shapes, not a
 * whole board (see `MirrorMazeBoardView`'s layer split).
 *
 * `fps` caps how often the value actually changes, and so how often
 * anything re-renders. The frame callback still runs at display rate - the
 * cost being saved is the React render and Skia reconcile downstream of
 * it, which is the expensive part by a wide margin. Two boards drive this
 * clock for the entire time a puzzle is unsolved purely to keep a shimmer
 * and a firefly moving; those are decoration, and decoration does not need
 * a new frame 60 times a second while an untouched board sits there.
 */
export function useAnimationClock(active: boolean, fps = 60): number {
  const [elapsed, setElapsed] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    const startTime = Date.now();
    const minInterval = 1000 / fps;
    let lastPublished = -Infinity;
    const tick = (): void => {
      const now = Date.now();
      // Publishing is what costs; skipping it leaves the previous value in
      // place and React does nothing at all this frame.
      if (now - lastPublished >= minInterval) {
        lastPublished = now;
        setElapsed(now - startTime);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [active, fps]);

  return elapsed;
}

import { useEffect, useRef, useState } from 'react';

const MIN_MS = 320;
const MAX_MS = 1100;

function durationFor(cellCount: number): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, 90 * cellCount));
}

/** Starts fast and eases out, so the light leaps away from the source and
 * settles onto the target rather than arriving at a constant crawl. */
function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export interface AnimatedBeamRevealResult {
  /** How far the ignition has travelled along the beam, 0 (nothing) to 1
   * (source to target). Deliberately a *fraction of the whole path* rather
   * than a count of whole cells: at one cell per frame-step the light
   * visibly jumped square to square, which read as a progress bar filling
   * rather than a beam igniting. The caller interpolates the partial final
   * segment from this (see `MirrorMazeBoardView`'s `partialPathThroughCells`). */
  readonly revealProgress: number;
  readonly isRevealing: boolean;
}

/**
 * Drives the one-time ignition that runs the instant `solved` flips false ->
 * true, over a length-scaled duration - mirroring `useAnimatedMovables`'s
 * exact shape (a `requestAnimationFrame` loop computing a plain interpolated
 * number via `setState`, consumed by declarative Skia JSX). If the hook
 * mounts with `solved` already true, the beam is shown fully lit with no
 * animation.
 *
 * This drives the celebratory pass only - the always-current beam shown
 * during ordinary play (so placing a mirror has visible feedback) is a
 * separate, continuously-rendered layer in `MirrorMazeBoardView`.
 */
export function useAnimatedBeamReveal(
  path: ReadonlyArray<unknown>,
  solved: boolean,
): AnimatedBeamRevealResult {
  const [revealProgress, setRevealProgress] = useState(solved ? 1 : 0);
  const [isRevealing, setIsRevealing] = useState(false);
  const frameRef = useRef<number | null>(null);
  const wasSolvedRef = useRef(solved);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (solved && !wasSolvedRef.current) {
      const duration = durationFor(path.length);
      const startTime = Date.now();
      setIsRevealing(true);

      const tick = (): void => {
        const t = Math.min(1, (Date.now() - startTime) / duration);
        setRevealProgress(easeOutCubic(t));

        if (t < 1) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }
        frameRef.current = null;
        setIsRevealing(false);
      };

      frameRef.current = requestAnimationFrame(tick);
    } else if (!solved) {
      setRevealProgress(0);
      setIsRevealing(false);
    }

    wasSolvedRef.current = solved;

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // Only `solved`'s transition should ever (re)start this - `path` is read
    // fresh via closure at the moment it fires, and re-running on every
    // `path` change during ordinary (unsolved) play would fight the live
    // beam this hook deliberately leaves to the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  return { revealProgress, isRevealing };
}

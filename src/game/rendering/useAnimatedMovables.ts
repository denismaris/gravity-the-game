import { useEffect, useRef, useState } from 'react';
import { MovableObject } from '../engine';

/**
 * Slide duration is scaled slightly by how far the furthest piece travels, so
 * a long slide reads with a touch more physical weight than a one-cell nudge -
 * while both stay fast. The bounds are the important part: never slower than
 * `MIN_SLIDE_MS` (so it can't feel sluggish) and never faster than a duration
 * that would read as a teleport on a short move.
 */
const MIN_SLIDE_MS = 110;
const MAX_SLIDE_MS = 240;

function slideDurationFor(cellsTravelled: number): number {
  return Math.min(MAX_SLIDE_MS, Math.max(MIN_SLIDE_MS, 70 + cellsTravelled * 22));
}

/** How long the "just landed" pulse hint is reported for, after a slide
 * finishes. Purely a hint for the rendering layer - see `justLandedIds`. */
const LANDED_PULSE_MS = 100;

/** Smooth deceleration - starts fast, settles gently, reading as weight
 * rather than a linear/mechanical glide. Never overshoots, so a piece always
 * stops cleanly exactly on its resting cell. */
function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/** Position-wise equality (ignores object identity but checks id + cell). */
function samePositions(
  a: ReadonlyArray<MovableObject>,
  b: ReadonlyArray<MovableObject>,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].row !== b[i].row || a[i].col !== b[i].col) {
      return false;
    }
  }
  return true;
}

export interface AnimatedMovablesResult {
  /** Positions to render right now - equal to `target` once settled, and
   * smoothly interpolated towards it while a transition is in flight. */
  readonly movables: ReadonlyArray<MovableObject>;
  /** True from the render that first sees a new `target` until the slide for
   * it has fully settled. Used to ignore new directional input mid-slide (so
   * rapid taps can't pile up overlapping animations or desync from the
   * logical game state) and to hold back the solved banner until the winning
   * piece has actually landed. */
  readonly isAnimating: boolean;
  /** Ids of objects that just finished sliding, for a brief landing cue.
   * Cleared automatically a short time after the slide completes. */
  readonly justLandedIds: ReadonlySet<string>;
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * Interpolates the engine's authoritative, instantaneous movable positions
 * (`target`) into a short animated slide for rendering purposes only.
 *
 * The engine (`applyGravity`) stays exactly as it is: pure and
 * instantaneous. This hook never changes game rules or timing of when a
 * move "counts" - it only decides what gets *drawn* between one GameState
 * and the next, which keeps the engine/state/rendering separation intact.
 *
 * `instant`, when true, skips the tween and snaps straight to `target`.
 * Used for undo/restart (which must feel immediate, not like "gravity in
 * reverse") and for the first render of a level.
 */
export function useAnimatedMovables(
  target: ReadonlyArray<MovableObject>,
  instant: boolean,
): AnimatedMovablesResult {
  const [displayed, setDisplayed] = useState<ReadonlyArray<MovableObject>>(target);
  const [isAnimating, setIsAnimating] = useState(false);
  const [justLandedIds, setJustLandedIds] = useState<ReadonlySet<string>>(EMPTY_IDS);

  const fromRef = useRef<ReadonlyArray<MovableObject>>(target);
  const frameRef = useRef<number | null>(null);
  const landedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const startById = new Map(from.map(movable => [movable.id, movable]));

    const moved = target.filter(movable => {
      const previous = startById.get(movable.id);
      return !previous || previous.row !== movable.row || previous.col !== movable.col;
    });
    const movedIds = new Set(moved.map(movable => movable.id));

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (instant || moved.length === 0) {
      fromRef.current = target;
      setDisplayed(target);
      setIsAnimating(false);
      return;
    }

    const cellsTravelled = moved.reduce((max, movable) => {
      const start = startById.get(movable.id)!;
      return Math.max(max, Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col));
    }, 0);
    const duration = slideDurationFor(cellsTravelled);
    const startTime = Date.now();
    setIsAnimating(true);

    const tick = (): void => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);

      const next = target.map(movable => {
        const start = startById.get(movable.id) ?? movable;
        return {
          ...movable,
          row: start.row + (movable.row - start.row) * eased,
          col: start.col + (movable.col - start.col) * eased,
        };
      });

      setDisplayed(next);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      fromRef.current = target;
      frameRef.current = null;
      setIsAnimating(false);
      setJustLandedIds(movedIds);

      if (landedTimeoutRef.current) clearTimeout(landedTimeoutRef.current);
      landedTimeoutRef.current = setTimeout(() => setJustLandedIds(EMPTY_IDS), LANDED_PULSE_MS);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // `instant` and `target` are the only real dependencies; `target` is a
    // stable reference from the reducer that only changes when the
    // logical state actually changes (see gameSessionReducer/applyGravity).
  }, [target, instant]);

  // Unmount safety net, independent of the effect above.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (landedTimeoutRef.current) clearTimeout(landedTimeoutRef.current);
    };
  }, []);

  // Report "animating" from the render that first sees a new `target`, before
  // the effect above has had a chance to start the slide. Without this there
  // is a one-frame window where a move is already committed to state but
  // `isAnimating` is still false - long enough for a second queued input to
  // slip through, or for the solved banner to flash in over a piece that
  // hasn't visibly moved yet.
  const pendingSlide = !instant && !samePositions(displayed, target);

  return { movables: displayed, isAnimating: isAnimating || pendingSlide, justLandedIds };
}

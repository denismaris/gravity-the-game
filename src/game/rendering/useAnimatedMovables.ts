import { useEffect, useRef, useState } from 'react';
import { MovableObject } from '../engine';

/**
 * How long a slide takes, by how far the furthest piece travels.
 *
 * Square root, not linear: a piece released under constant acceleration
 * covers distance proportional to the square of time, so the time to fall
 * `n` cells goes as the square root of `n`. Falling eight cells therefore
 * takes about three times as long as falling one, not eight times - which
 * is why a long drop can stay quick without the short one crawling.
 *
 * The previous curve was linear and capped at 240ms, which made a long
 * fall *slower per cell* than a short one - precisely backwards for
 * something meant to be accelerating.
 */
// Raised from 92 / 62 after the slide was reported "not smooth" on a
// phone: a one-square move lasted ~154ms, about nine frames, so a single
// dropped frame was a visible hitch. A touch longer, and the landing below
// has room to read.
const BASE_SLIDE_MS = 130;
const PER_ROOT_CELL_MS = 75;

function slideDurationFor(cellsTravelled: number): number {
  return BASE_SLIDE_MS + PER_ROOT_CELL_MS * Math.sqrt(cellsTravelled);
}

/** How long the "just landed" pulse hint is reported for, after a slide
 * finishes. Purely a hint for the rendering layer - see `justLandedIds`. */
const LANDED_PULSE_MS = 100;

/**
 * A fall: still at the start, fastest at the moment of impact.
 *
 * This is the literal equation of motion under constant acceleration from
 * rest (`s = t^2`), softened very slightly at the end so a piece does not
 * stop dead on a single frame.
 *
 * It replaces an ease-*out* cubic, which was the cause of the pieces
 * reading as teleporting rather than travelling: an ease-out leaves at
 * three times its own average speed and then crawls, so a long slide
 * covered most of its distance in the first few frames and spent the rest
 * of its time almost stationary. The eye reads that as a jump followed by
 * a settle, not as a fall. Gravity pulls, so the pieces have to accelerate
 * - the landing cue (`justLandedIds`) is what sells the stop.
 */
/** Share of the slide spent falling; the rest is the landing. */
const FALL_SHARE = 0.84;
/** How far a piece rebounds off the wall it lands against, in squares. */
const REBOUND_SQUARES = 0.06;

/**
 * The whole slide, 0..1 along the piece's path: it accelerates into the
 * wall (`easeInFall`), then gives a small rebound and settles - a heavy
 * ball landing, rather than one stopping dead at full speed. With the old
 * size-pop landing cue removed, a dead stop at top speed was the jolt that
 * read as "not smooth". The rebound is measured in squares, not as a share
 * of the path, so a long fall and a one-square nudge land with the same
 * weight.
 */
export function landingCurve(t: number, squares: number): number {
  if (t >= 1) return 1;
  if (t < FALL_SHARE) return easeInFall(t / FALL_SHARE);
  const u = (t - FALL_SHARE) / (1 - FALL_SHARE);
  return 1 - (REBOUND_SQUARES / Math.max(1, squares)) * Math.sin(u * Math.PI);
}

function easeInFall(t: number): number {
  const accelerated = t * t;
  // The last sliver blends toward linear, which takes the hard edge off
  // the final frame without flattening the acceleration that precedes it.
  const softening = t * t * t * (1 - t);
  return accelerated + softening * 0.45;
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
      // A piece new to the board (a different board swapped in) has no
      // start; it appears where it is rather than sliding.
      const start = startById.get(movable.id);
      if (!start) return max;
      return Math.max(max, Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col));
    }, 0);
    const duration = slideDurationFor(cellsTravelled);
    const startTime = Date.now();
    setIsAnimating(true);

    const tick = (): void => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const next = target.map(movable => {
        const start = startById.get(movable.id) ?? movable;
        const dr = movable.row - start.row;
        const dc = movable.col - start.col;
        const eased = landingCurve(t, Math.abs(dr) + Math.abs(dc));
        return {
          ...movable,
          row: start.row + dr * eased,
          col: start.col + dc * eased,
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

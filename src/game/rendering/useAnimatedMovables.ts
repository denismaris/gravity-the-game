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

export function slideDurationFor(cellsTravelled: number): number {
  return BASE_SLIDE_MS + PER_ROOT_CELL_MS * Math.sqrt(cellsTravelled);
}

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
 * - the landing rebound is what sells the stop.
 *
 * A worklet, and defined before `landingCurve`, which captures it: the
 * slide runs on the UI thread.
 */
function easeInFall(t: number): number {
  'worklet';
  const accelerated = t * t;
  // The last sliver blends toward linear, which takes the hard edge off
  // the final frame without flattening the acceleration that precedes it.
  const softening = t * t * t * (1 - t);
  return accelerated + softening * 0.45;
}

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
  'worklet';
  if (t >= 1) return 1;
  if (t < FALL_SHARE) return easeInFall(t / FALL_SHARE);
  const u = (t - FALL_SHARE) / (1 - FALL_SHARE);
  return 1 - (REBOUND_SQUARES / Math.max(1, squares)) * Math.sin(u * Math.PI);
}


/**
 * One gravity move, as the board animates it: where each moving piece
 * starts from, how long the slide lasts, and a key that changes with
 * every move. The pieces run the slide themselves, on the UI thread (see
 * `SlidingPiece` in `BoardView`), so a move costs React two renders - its
 * start and its settle - instead of one per frame, which is what made the
 * slide stutter on a phone whenever anything else was busy.
 */
export interface SlidePlan {
  /** Start cell of each piece that moves in this slide, by id. */
  readonly from: ReadonlyMap<string, { readonly row: number; readonly col: number }>;
  readonly key: number;
  readonly duration: number;
  readonly isAnimating: boolean;
}

const STILL: SlidePlan = { from: new Map(), key: 0, duration: 0, isAnimating: false };

export function useSlidePlan(target: ReadonlyArray<MovableObject>, instant: boolean): SlidePlan {
  const [plan, setPlan] = useState<SlidePlan>(STILL);
  const fromRef = useRef(target);

  useEffect(() => {
    const previous = new Map(fromRef.current.map(movable => [movable.id, movable]));
    fromRef.current = target;
    // Only a piece already on the board can slide; one new to it (a
    // different board swapped in) simply appears where it is.
    const moved = target.filter(movable => {
      const start = previous.get(movable.id);
      return start !== undefined && (start.row !== movable.row || start.col !== movable.col);
    });
    if (instant || moved.length === 0) {
      setPlan(current => ({ from: new Map(), key: current.key + 1, duration: 0, isAnimating: false }));
      return;
    }
    const from = new Map(moved.map(movable => [movable.id, previous.get(movable.id)!]));
    const travelled = moved.reduce((max, movable) => {
      const start = from.get(movable.id)!;
      return Math.max(max, Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col));
    }, 0);
    const duration = slideDurationFor(travelled);
    setPlan(current => ({ from, key: current.key + 1, duration, isAnimating: true }));
    const settle = setTimeout(() => setPlan(current => ({ ...current, isAnimating: false })), duration);
    return () => clearTimeout(settle);
  }, [target, instant]);

  return plan;
}

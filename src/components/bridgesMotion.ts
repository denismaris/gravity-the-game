/**
 * The arithmetic behind Bridges' motion, as worklets: they run on the UI
 * thread inside Reanimated's derived values, and as plain functions in
 * tests. Nothing here knows about pixels or React.
 */

export function clamp01(t: number): number {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeOutBack(t: number, overshoot = 1.7): number {
  'worklet';
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

export function easeOutCubic(t: number): number {
  'worklet';
  return 1 - (1 - t) ** 3;
}

/**
 * Where a bridge being built (or taken down) currently reaches along its
 * lane, as [from, to] shares 0-1.
 *
 * Built: it spreads from `origin` - 0 for a drag from island `a`, 1 for a
 * drag from `b`, anything between for a tap on the water - toward both
 * shores, arriving at both at the same moment. Taken down: it draws in
 * from both shores toward the middle.
 */
export function laneSpan(progress: number, origin: number, building: boolean): [number, number] {
  'worklet';
  const p = clamp01(progress);
  if (building) return [origin * (1 - p), origin + (1 - origin) * p];
  return [0.5 * p, 1 - 0.5 * p];
}

/**
 * How far one plank has landed (0-1): planks well inside the span are
 * down; the ones at a moving end are still settling in, eased so each
 * glides into place over two or three planks' worth of travel rather
 * than blinking in on a frame or two - the first version popped each
 * plank over roughly two frames with a bouncy overshoot, which read as
 * flicker. `at` is the plank's centre along the lane (0-1), `pop` how far
 * inside the span (as a share of the lane) a plank must be to be fully
 * down. An end resting on a shore is not moving - planks there are down.
 */
export function plankScale(at: number, from: number, to: number, pop: number): number {
  'worklet';
  if (at < from || at > to) return 0;
  const inside = Math.min(from <= 0.0001 ? 1 : at - from, to >= 0.9999 ? 1 : to - at);
  return easeOutCubic(clamp01(inside / pop));
}

/** How long a bridge takes to build, by how many squares it spans - a long
 * bridge takes longer, but not proportionally longer, so a short one
 * never drags and a long one never whips across. */
export function buildDurationMs(squares: number): number {
  'worklet';
  return Math.round(Math.min(620, 320 + 60 * Math.max(1, squares)));
}

export const REMOVE_DURATION_MS = 280;

/** The build's own curve: quick off the mark, easing into the far shore. */
export function buildEase(t: number): number {
  'worklet';
  return easeOutCubic(clamp01(t));
}

/** When (0-1 of the build) the build has reached `share` of its length -
 * the inverse of `buildEase`, for timing a plank's click to its landing. */
export function buildTimeAt(share: number): number {
  return 1 - Math.cbrt(1 - clamp01(share));
}

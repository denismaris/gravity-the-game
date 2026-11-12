/**
 * The launch sequence's timing, with no React in it, so the choreography
 * can be reasoned about and tested on its own. The per-frame functions are
 * worklets: the sequence plays on the UI thread, because the JS thread is
 * busy building Home underneath it.
 *
 * The app's mark builds itself from the icon's own layers (see
 * `LaunchSequence`): the ground rises, the four glazed tiles fly in and
 * land, the gold gem seats, the wordmark sets beneath, and the whole mark
 * hands off to Home. A *tessera* is a fragment of a mosaic, so a mosaic
 * coming together is the thing the name means.
 */

/** Worklets capture what they call when defined, so this one, used by
 * nearly everything below, comes first. */
export function clamp01(value: number): number {
  'worklet';
  // NaN is the only value that has no sensible clamp, and it is the one a
  // divide-by-zero would produce. Infinities clamp like any other
  // out-of-range number.
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** The loading bar's ochre, the icon's own. */
export const OCHRE = '#D9A441';

/**
 * Act boundaries, in milliseconds from the first frame.
 *
 * A launch animation is a toll charged on every single cold start, so it
 * is paced to feel unhurried without ever being something to sit through,
 * and it can always be skipped by tapping. Tightened from almost three
 * seconds to under two (2026-10-29), then to under one and a half
 * (2026-11-07): the player still found the opening too long.
 */
export const ACTS = {
  /** The ground rising into place. */
  tileIn: { start: 0, end: 260 },
  /** The four tiles flying in and landing, staggered, the gem last. */
  assemble: { start: 100, end: 720 },
  /** The wordmark setting, letter by letter, under the mark. */
  wordmark: { start: 520, end: 1000 },
  /** The mark lifting away and Home arriving behind it. */
  handoff: { start: 1040, end: 1440 },
} as const;

export const TOTAL_MS = ACTS.handoff.end;

/** Ease-out cubic, for arrivals. */
export function easeOut(t: number): number {
  'worklet';
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

/** Ease-in-out, for the tile and the handoff where both ends matter. */
export function easeInOut(t: number): number {
  'worklet';
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

/** Linear 0..1 across an act, before easing. */
export function actProgress(elapsed: number, act: { start: number; end: number }): number {
  'worklet';
  return clamp01((elapsed - act.start) / (act.end - act.start));
}

/** The wordmark's letters set one after another, left to right. */
export function letterProgress(elapsed: number, index: number, count: number): number {
  'worklet';
  const { start, end } = ACTS.wordmark;
  const span = end - start;
  const per = span * 0.55;
  const release = start + (count > 1 ? (index / (count - 1)) * (span - per) : 0);
  return easeOut((elapsed - release) / per);
}

/** The mark gives once as the gem seats: a press and a recovery. */
export const PRESS = { start: ACTS.assemble.end - 90, end: ACTS.assemble.end + 230 } as const;

export function tilePress(elapsed: number): number {
  'worklet';
  const t = actProgress(elapsed, PRESS);
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) * (1 - t * 0.35);
}

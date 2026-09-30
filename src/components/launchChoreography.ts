/**
 * The launch sequence's timing and geometry, with no React and no Skia in
 * it, so the choreography can be reasoned about and tested on its own.
 *
 * The app's mark builds itself: a tessera arrives, eighteen pieces of
 * tilework fly in and lock into the star-and-cross, the wordmark sets
 * beneath it, and then the whole tile hands off to Home. It is the same
 * star-and-cross the app icon draws, which is the one piece of theatre
 * this app has actually earned - a *tessera* is a fragment of a mosaic,
 * so a mosaic coming together is the thing the name means.
 *
 * The tile itself is `theme.colors.brandTile` - this app's own violet ink,
 * the same colour the wordmark sets in right underneath it a moment
 * later - not the separate magenta `tools/make_icon.py` paints the home-
 * screen icon in. Those two were the same colour in an earlier version of
 * this file, on the reasoning that the sequence is "the icon assembling
 * itself". In practice this animation is watched from *inside* the app,
 * with the app's own violet everywhere around it (this same screen's
 * wordmark, every other screen's ink), so a brighter, separately-tuned
 * magenta read as off-theme rather than as a deliberate icon choice -
 * correctly: that choice only makes sense sitting on a home screen next
 * to other apps' icons, not as a colour inside this one. `CHALK`/`OCHRE`
 * still match the icon, since the pieces themselves are the same shapes.
 */

export const CHALK = '#F2EDDF';
export const OCHRE = '#D9A441';

/**
 * Act boundaries, in milliseconds from the first frame.
 *
 * The whole thing runs well under two seconds. A launch animation is a toll
 * charged on every single cold start, and the second viewing is already one
 * too many if it outstays its welcome - so it is paced to feel unhurried
 * without ever being something to sit through, and it can always be skipped
 * by tapping.
 */
export const ACTS = {
  /** The tile itself scaling up out of nothing. */
  tileIn: { start: 0, end: 420 },
  /** Eighteen pieces flying in and locking into place, staggered. */
  assemble: { start: 260, end: 1180 },
  /** The wordmark setting, letter by letter, under the tile. */
  wordmark: { start: 1020, end: 1560 },
  /** The tile lifting away and Home arriving behind it. */
  handoff: { start: 1620, end: 1980 },
} as const;

export const TOTAL_MS = ACTS.handoff.end;

/**
 * The glow: a bright diagonal sweep across the assembled tile, the instant
 * the last piece lands - "the star is fully done and built", echoing the
 * same light-sweep every completion card in this app plays once its own
 * contents have settled (`useCardEntrance`'s `sheen`). It fits in the gap
 * between assembly finishing and the handoff starting, computed from
 * those two rather than a third hand-tuned pair of numbers, so retuning
 * either act carries this along with it instead of quietly leaving the
 * sweep overlapping the fade or arriving before the tile is even done.
 */
export const SHEEN = {
  start: ACTS.assemble.end,
  end: Math.min(ACTS.assemble.end + 420, ACTS.handoff.start - 20),
} as const;

/** How long a piece takes to travel in, once its own stagger has elapsed. */
const PIECE_FLIGHT_MS = 520;

export type PieceKind = 'core' | 'point' | 'cardinal' | 'diagonal';

export interface LaunchPiece {
  readonly kind: PieceKind;
  /** Polygon in unit coordinates relative to the tile's centre, where 1 is
   * half the tile's side. Rendered by scaling these by the real half-side. */
  readonly points: ReadonlyArray<readonly [number, number]>;
  readonly color: string;
  /** Direction the piece flies in from, as a unit vector - or `[0, 0]` for
   * a piece that grows in place instead of travelling (the centre pieces,
   * which have no "outside" to come from). */
  readonly from: readonly [number, number];
  /** Degrees the piece is rotated by at the start of its flight, about its
   * own centre. */
  readonly spin: number;
  /** Scale the piece starts its flight at, about its own centre. */
  readonly startScale: number;
  /** 0..1 position in the stagger. */
  readonly order: number;
}

const STAR_OUTER = 0.60;
const STAR_INNER = STAR_OUTER * 0.42;
const HEART = 0.175;
const SATELLITE = 0.80;

/**
 * The core octagon and the eight point triangles are nine *separate*
 * pieces specifically so they can fly in on their own independent
 * timing - but nine separately anti-aliased shapes that only exactly
 * abut, with no fill in common, each get their own edge fringe blended
 * against the tile colour behind them, and where two such fringes meet
 * that shows as a faint seam - visible once assembled, at any size, not
 * an animation-only artifact.
 *
 * Every point's own base sits at radius `STAR_INNER`, matching the core's
 * own vertices at the same angles - so the fix is to enlarge only the
 * core (drawn first, so a slightly bigger one sits *behind* the points
 * unchanged) rather than nudging both shapes' shared radius out
 * together. Scaling both by the same factor - the first thing tried here
 * - relocates the exact-touch boundary to a new radius without ever
 * creating overlapping fill, and visibly did not close the seam; only
 * one shape actually reaching past where the other one starts does.
 */
const CORE_SEAM_OVERLAP = 1.06;

function polar(angleDeg: number, radius: number): readonly [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

function starPolygon(cx: number, cy: number, outer: number, points = 8): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let k = 0; k < points * 2; k += 1) {
    const r = k % 2 === 0 ? outer : outer * 0.42;
    const [x, y] = polar(k * (180 / points) - 90, r);
    out.push([cx + x, cy + y]);
  }
  return out;
}

function diamond(cx: number, cy: number, r: number): Array<readonly [number, number]> {
  return [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
}

/**
 * The eighteen pieces, in the order they arrive.
 *
 * The core lands first and the star grows outward from it, because the
 * reverse - points arriving around an empty middle - reads as a shape
 * waiting to be completed rather than one being built. The accents come
 * last so the final beat is the ochre appearing, which is the only warm
 * colour in the mark.
 */
export function launchPieces(): ReadonlyArray<LaunchPiece> {
  const pieces: LaunchPiece[] = [];

  // The octagonal core, its radius nudged out a hair past where the
  // points' own bases sit - see `CORE_SEAM_OVERLAP`'s own comment.
  const core: Array<readonly [number, number]> = [];
  for (let k = 0; k < 8; k += 1) core.push(polar(k * 45 - 90 + 22.5, STAR_INNER * CORE_SEAM_OVERLAP));
  // It grows in place rather than flying in: it is the first thing on an
  // empty tile, and it has no edge of the tile to arrive from.
  pieces.push({ kind: 'core', points: core, color: CHALK, from: [0, 0], spin: -45, startScale: 0.2, order: 0 });

  // Eight star points, sweeping round.
  for (let k = 0; k < 8; k += 1) {
    const tip = polar(k * 45 - 90, STAR_OUTER);
    const left = polar(k * 45 - 90 - 22.5, STAR_INNER);
    const right = polar(k * 45 - 90 + 22.5, STAR_INNER);
    const dir = polar(k * 45 - 90, 1);
    pieces.push({
      kind: 'point',
      points: [tip, right, left],
      color: CHALK,
      from: dir,
      spin: k % 2 === 0 ? 22 : -22,
      startScale: 0.6,
      order: 0.08 + (k / 8) * 0.52,
    });
  }

  // Four ochre diamonds on the cardinals - the 'cross' of star-and-cross.
  for (let k = 0; k < 4; k += 1) {
    const [x, y] = polar(k * 90 - 90, SATELLITE);
    pieces.push({
      kind: 'cardinal',
      points: diamond(x, y, 0.135),
      color: OCHRE,
      from: polar(k * 90 - 90, 1),
      spin: 45,
      startScale: 0.6,
      order: 0.66 + (k / 4) * 0.16,
    });
  }

  // Four small chalk stars on the diagonals - the neighbours' corners,
  // brought inboard because this composition is centred rather than
  // full-bleed like the icon.
  for (let k = 0; k < 4; k += 1) {
    const [x, y] = polar(k * 90 - 45, SATELLITE);
    pieces.push({
      kind: 'diagonal',
      points: starPolygon(x, y, 0.115),
      color: CHALK,
      from: polar(k * 90 - 45, 1),
      spin: -30,
      startScale: 0.6,
      order: 0.84 + (k / 4) * 0.16,
    });
  }

  // The heart, last: the one beat of warm colour at the very centre. It
  // pops in place - flying in from any side would drag it across the
  // finished star on its way to the middle.
  pieces.push({ kind: 'cardinal', points: diamond(0, 0, HEART), color: OCHRE, from: [0, 0], spin: 90, startScale: 0, order: 1 });

  return pieces;
}

/**
 * How far out a piece starts, in the same unit coordinates as its points.
 *
 * Short on purpose: every piece travels a straight line inward to its own
 * spot and is drawn clipped to the tile, so it slides in from under the
 * tile's edge. An earlier version flew pieces in from 2.4 half-sides out,
 * far past the tile, where chalk on the sand-cream paper is all but
 * invisible - pieces seemed to materialise mid-air at the tile's edge.
 */
const PIECE_TRAVEL = 0.5;

function centroid(points: ReadonlyArray<readonly [number, number]>): readonly [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

/**
 * The piece's polygon at `progress` (0..1, see `pieceProgress`), in tile
 * unit coordinates.
 *
 * Spin and scale are applied about the piece's *own* centre, then the whole
 * piece is offset along `from`. Doing them about the tile's centre instead -
 * as an earlier version did - swings each piece round in an arc (a
 * satellite at radius 0.8 turning 45° travels sideways by more than half a
 * tile) and pulls it inward while it also flies outward-in, so nothing
 * moved in a straight line and the pieces seemed to slide past their
 * spots before correcting.
 */
export function piecePointsAt(piece: LaunchPiece, progress: number): Array<readonly [number, number]> {
  const p = clamp01(progress);
  const [cx, cy] = centroid(piece.points);
  const spin = ((1 - p) * piece.spin * Math.PI) / 180;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const scale = piece.startScale + (1 - piece.startScale) * p;
  const travel = (1 - p) * PIECE_TRAVEL;
  const ox = cx + piece.from[0] * travel;
  const oy = cy + piece.from[1] * travel;
  return piece.points.map(([px, py]) => {
    const lx = (px - cx) * scale;
    const ly = (py - cy) * scale;
    return [ox + lx * cos - ly * sin, oy + lx * sin + ly * cos] as const;
  });
}

/** 0..1 opacity through a piece's flight - fully opaque well before it
 * lands, so the settle is read as motion, not as a fade finishing. */
export function pieceOpacity(progress: number): number {
  return clamp01(progress * 2.5);
}

/** Cubic ease-out - the deceleration every piece lands on. */
export function easeOut(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

/** Ease-in-out, for the tile and the handoff where both ends matter. */
export function easeInOut(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

export function clamp01(value: number): number {
  // NaN is the only value that has no sensible clamp, and it is the one a
  // divide-by-zero would produce. Infinities clamp like any other
  // out-of-range number - an earlier version rejected those too and turned
  // a fully-elapsed animation into a not-yet-started one.
  if (Number.isNaN(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Linear 0..1 across an act, before easing. */
export function actProgress(elapsed: number, act: { start: number; end: number }): number {
  return clamp01((elapsed - act.start) / (act.end - act.start));
}

/**
 * How far along its own flight a piece is at `elapsed`, eased.
 *
 * Each piece's stagger is spread across the assemble act, leaving
 * `PIECE_FLIGHT_MS` for the last one to land - so the act's end is when the
 * *final* piece settles, not when the last one is released.
 */
export function pieceProgress(elapsed: number, piece: LaunchPiece): number {
  const { start, end } = ACTS.assemble;
  const release = start + piece.order * (end - start - PIECE_FLIGHT_MS);
  return easeOut((elapsed - release) / PIECE_FLIGHT_MS);
}

/** The wordmark's letters set one after another, left to right. */
export function letterProgress(elapsed: number, index: number, count: number): number {
  const { start, end } = ACTS.wordmark;
  const span = end - start;
  const per = span * 0.55;
  const release = start + (count > 1 ? (index / (count - 1)) * (span - per) : 0);
  return easeOut((elapsed - release) / per);
}

/** Linear interpolation through a short list of `(input, output)` stops -
 * exactly RN `Animated.Value.interpolate`'s own shape, since that is the
 * envelope every completion card's sheen already uses (fade in fast, hold,
 * fade out); this file has no `Animated.Value` to call that method on, so
 * the same four numbers are reproduced by hand instead of inventing a
 * differently-shaped curve. */
function interpolate(t: number, stops: ReadonlyArray<readonly [number, number]>): number {
  const c = clamp01(t);
  for (let i = 1; i < stops.length; i += 1) {
    const [x0, y0] = stops[i - 1];
    const [x1, y1] = stops[i];
    if (c <= x1) return x0 === x1 ? y1 : y0 + ((c - x0) / (x1 - x0)) * (y1 - y0);
  }
  return stops[stops.length - 1][1];
}

/** 0 at rest, 1 at the sweep's brightest - fades in over the first 15% of
 * `SHEEN`, holds at full through the middle, fades out over the last 15%.
 * The same envelope shape `useCardEntrance`'s own `sheen` animates a card
 * with. */
export function sheenOpacity(elapsed: number): number {
  const t = actProgress(elapsed, SHEEN);
  return interpolate(t, [
    [0, 0],
    [0.15, 1],
    [0.85, 1],
    [1, 0],
  ]);
}

/** 0..1 raw progress across the sweep, linear - the caller supplies its own
 * travel distance, since that depends on the tile's own on-screen size. */
export function sheenTravel(elapsed: number): number {
  return actProgress(elapsed, SHEEN);
}

/** The angle every completion card's own sheen sweeps at (`useCardEntrance`'s
 * `{ rotate: '18deg' }`), nudged a few degrees steeper - this band travels a
 * much shorter distance (the tile, not a full card), so a touch more tilt
 * keeps it reading as a diagonal streak rather than a near-horizontal bar. */
const SHEEN_ANGLE_DEG = 24;

/**
 * The four corners of the light band at travel fraction `t` (0..1, see
 * `sheenTravel`), in the same tile-local unit square `[-1, 1]` every other
 * piece of geometry in this file is expressed in - the caller scales by
 * its own `half`.
 *
 * A straight rectangle in a frame rotated by `SHEEN_ANGLE_DEG`, not a true
 * parallelogram some other tilt would need: each corner is
 * `centre ± d * halfThickness ± n * halfSpan` independently, which is
 * exactly what keeps opposite edges parallel. The two extents are not
 * interchangeable despite both being "half a side": `halfThickness` runs
 * *along* the travel direction `d` (thin, so the streak sweeps past a
 * point quickly rather than lingering), `halfSpan` runs *across* it, along
 * `n` (long, so the streak spans the tile's full height at every moment
 * of the sweep rather than only brushing past a corner of it). Getting
 * the two swapped is an easy mistake worth naming: it still draws *a*
 * band, just one lying broadside across the direction of travel instead
 * of sweeping through it - plausible enough on a glance that only the
 * geometry tests below (specifically, that the band is provably clear of
 * the tile at both ends of its travel) caught it here before it was ever
 * rendered.
 */
export function sheenBandPoints(t: number): ReadonlyArray<readonly [number, number]> {
  const angle = (SHEEN_ANGLE_DEG * Math.PI) / 180;
  const d: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
  const n: readonly [number, number] = [-Math.sin(angle), Math.cos(angle)];

  // The centre travels from well clear of one corner to well clear of the
  // opposite one - 1.7 covers the unit square's own half-diagonal (~1.41)
  // with room to spare so the band is never seen popping into existence
  // mid-tile.
  const travelRange = 1.7;
  const offset = -travelRange + clamp01(t) * 2 * travelRange;
  const centre: readonly [number, number] = [d[0] * offset, d[1] * offset];

  const halfThickness = 0.22;
  // Comfortably exceeds the unit square's own half-diagonal, so the band
  // covers the tile's full height at every point along the sweep, however
  // it happens to be rotated relative to the square.
  const halfSpan = 1.8;

  const corner = (alongSign: 1 | -1, acrossSign: 1 | -1): readonly [number, number] => [
    centre[0] + d[0] * halfThickness * alongSign + n[0] * halfSpan * acrossSign,
    centre[1] + d[1] * halfThickness * alongSign + n[1] * halfSpan * acrossSign,
  ];
  return [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
}

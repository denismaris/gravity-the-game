import { MazeShape, cellKey, hasOpenEdge } from './shape';

/**
 * A rolling ball's whole path, worked out the moment it's swiped.
 *
 * The break's ball used to be stepped by JavaScript every frame, and the
 * whole screen re-rendered to draw it there - which is what made it feel
 * laggy on a phone. But a roll is deterministic: from where the ball is and
 * which way it's sent, the path to the wall (or to the junction a queued
 * turn takes) is known up front. So it's planned here, once, as a polyline,
 * and the screen hands that to the native animation driver to glide along
 * - and to Core Haptics to rumble along - with JavaScript only waking to
 * paint a square as the ball enters it.
 *
 * Units are squares: the centre of square (c, r) is (c + 0.5, r + 0.5).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Heading {
  readonly dc: number;
  readonly dr: number;
}

export interface RollPlan {
  /** Corners of the path: the start, any turn, and the end. */
  readonly points: ReadonlyArray<Point>;
  /** Distance along the path at each point. */
  readonly distances: ReadonlyArray<number>;
  readonly length: number;
  /** Each square entered, and how far along the path the ball enters it. */
  readonly entries: ReadonlyArray<{ readonly key: string; readonly at: number }>;
  /** Whether the roll ends against a wall (a thud) rather than nowhere. */
  readonly hitsWall: boolean;
  readonly end: Point;
  /** The heading the ball is travelling in when the roll ends. */
  readonly heading: Heading;
}

/**
 * Plans a roll from `from` heading `heading`, taking `queued` - a turn
 * swiped mid-roll - at the centre of the first square ahead that opens
 * that way. `radius` (in squares) is how far short of a wall the ball's
 * centre stops, so its edge, not its middle, meets the wall.
 */
export function planRoll(maze: MazeShape, from: Point, heading: Heading, queued: Heading | null, radius: number): RollPlan {
  let col = Math.floor(from.x);
  let row = Math.floor(from.y);
  // One square wide: the ball sits in the groove across its travel.
  let x = heading.dc !== 0 ? from.x : col + 0.5;
  let y = heading.dc !== 0 ? row + 0.5 : from.y;
  let { dc, dr } = heading;
  let turn = queued;

  const points: Point[] = [{ x, y }];
  const distances: number[] = [0];
  const entries: Array<{ key: string; at: number }> = [];
  let travelled = 0;
  let hitsWall = false;

  const moveTo = (nx: number, ny: number) => {
    travelled += Math.abs(nx - x) + Math.abs(ny - y);
    x = nx;
    y = ny;
  };
  const corner = () => {
    if (distances[distances.length - 1] !== travelled) {
      points.push({ x, y });
      distances.push(travelled);
    }
  };

  for (let guard = 0; guard < 128; guard += 1) {
    const cx = col + 0.5;
    const cy = row + 0.5;
    const dir = dc !== 0 ? dc : dr;
    const toCenter = ((dc !== 0 ? cx : cy) - (dc !== 0 ? x : y)) * dir;

    if (turn && toCenter >= -1e-9 && hasOpenEdge(maze, { col, row }, turn.dc, turn.dr)) {
      moveTo(cx, cy);
      corner();
      ({ dc, dr } = turn);
      turn = null;
      continue;
    }

    if (!hasOpenEdge(maze, { col, row }, dc, dr)) {
      const edge = dc !== 0 ? (dc > 0 ? col + 1 : col) : dr > 0 ? row + 1 : row;
      const stop = edge - dir * radius;
      const current = dc !== 0 ? x : y;
      // Never back up: a ball already past the stop line just stays put.
      const target = (stop - current) * dir > 0 ? stop : current;
      if (dc !== 0) moveTo(target, y);
      else moveTo(x, target);
      hitsWall = travelled > 0;
      corner();
      break;
    }

    const edge = dc !== 0 ? (dc > 0 ? col + 1 : col) : dr > 0 ? row + 1 : row;
    if (dc !== 0) moveTo(edge, y);
    else moveTo(x, edge);
    col += dc;
    row += dr;
    entries.push({ key: cellKey(col, row), at: travelled });
  }

  return { points, distances, length: travelled, entries, hitsWall, end: { x, y }, heading: { dc, dr } };
}

/** Where along `plan` the ball is after travelling `distance`. */
export function pointAt(plan: RollPlan, distance: number): Point {
  const { points, distances } = plan;
  if (distance <= 0) return points[0];
  for (let i = 1; i < points.length; i += 1) {
    if (distance <= distances[i]) {
      const span = distances[i] - distances[i - 1];
      const t = span > 0 ? (distance - distances[i - 1]) / span : 1;
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
    }
  }
  return points[points.length - 1];
}

/**
 * How a roll moves in time: from rest it accelerates evenly over
 * `rampSquares`, then holds `speed` (squares per second) into the wall -
 * a ball that gathers pace and lands with weight, rather than one that
 * starts at full speed or eases to a polite stop. Already moving (a
 * redirect mid-roll), it holds speed from the first frame.
 */
export interface RollTiming {
  readonly durationMs: number;
  /** Milliseconds from the start at which `distance` is reached. */
  timeAt(distance: number): number;
  /** Share of `length` covered at share `u` of the duration - the easing
   * handed to the animation driver. */
  easing(u: number): number;
}

export function rollTiming(length: number, speed: number, rampSquares: number, fromRest: boolean): RollTiming {
  const ramp = fromRest ? Math.min(rampSquares, length) : 0;
  // Constant acceleration over the ramp reaching `speed`: a = v^2 / 2s.
  const accel = ramp > 0 ? (speed * speed) / (2 * rampSquares) : Infinity;
  const rampTime = ramp > 0 ? Math.sqrt((2 * ramp) / accel) : 0;
  const rampEndSpeed = ramp > 0 ? accel * rampTime : speed;
  const duration = rampTime + (length - ramp) / rampEndSpeed;

  const timeAt = (distance: number): number => {
    const d = Math.max(0, Math.min(length, distance));
    const seconds = d <= ramp ? Math.sqrt((2 * d) / accel) : rampTime + (d - ramp) / rampEndSpeed;
    return seconds * 1000;
  };
  const distanceAt = (seconds: number): number => {
    const s = Math.max(0, Math.min(duration, seconds));
    return s <= rampTime ? 0.5 * accel * s * s : ramp + (s - rampTime) * rampEndSpeed;
  };
  return {
    durationMs: duration * 1000,
    timeAt,
    easing: u => (length > 0 ? distanceAt(u * duration) / length : 1),
  };
}

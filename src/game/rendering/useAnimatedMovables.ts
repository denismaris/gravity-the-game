import { useEffect, useRef, useState } from 'react';
import { ALL_DIRECTIONS, applyGravity, GameState, MovableObject, PortalPair, traceGravity } from '../engine';

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
// Shortened again, with the fall below now leaving at speed: the time a
// slide takes is less of what made it feel slow than how long it took to
// get going.
const BASE_SLIDE_MS = 105;
const PER_ROOT_CELL_MS = 68;

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
/** The share of a slide's average speed a piece already has as it leaves.
 * Declared before the worklet that captures it. */
const LAUNCH = 0.45;

function easeInFall(t: number): number {
  'worklet';
  // Thrown, not dropped: the piece leaves with a real speed (`LAUNCH`)
  // and still gathers pace into the wall. Starting from rest (plain t^2)
  // meant the first fifth of every slide barely moved, which on a phone
  // read as the game hesitating after the swipe.
  return LAUNCH * t + (1 - LAUNCH) * t * t;
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


type Cell = { readonly row: number; readonly col: number };

/** A slide that went through a portal: the endpoint it sank into and the
 * one it rose from. */
export interface PortalRoute {
  readonly enter: Cell;
  readonly exit: Cell;
  /** The cells walked to the portal (start first, `enter` last) and on
   * from it (`exit` first) - when the engine reported them. Without them
   * both runs are straight lines. */
  readonly before?: ReadonlyArray<Cell>;
  readonly after?: ReadonlyArray<Cell>;
}

/** The parts of a teleport, in milliseconds: the run to the portal, the
 * sink into it, a beat of absence, the rise out of the other end, and the
 * run on from there. Slow enough to see the ball leave and arrive - a
 * straight slide across the board read as the ball skidding, not jumping. */
export const TELEPORT = { sink: 230, gone: 150, rise: 260 } as const;

export interface TeleportTiming {
  readonly approach: number;
  readonly sink: number;
  readonly gone: number;
  readonly rise: number;
  readonly onward: number;
  readonly total: number;
}

export function teleportTiming(route: PortalRoute, start: Cell, end: Cell): TeleportTiming {
  const before = route.before ? route.before.length - 1 : Math.abs(route.enter.row - start.row) + Math.abs(route.enter.col - start.col);
  const after = route.after ? route.after.length - 1 : Math.abs(end.row - route.exit.row) + Math.abs(end.col - route.exit.col);
  // The run in has no landing (it ends in the portal), so it is a little
  // quicker than a slide of the same length.
  const approach = Math.round(slideDurationFor(before) * 0.85);
  const onward = after > 0 ? Math.round(slideDurationFor(after)) : 0;
  return { approach, ...TELEPORT, onward, total: approach + TELEPORT.sink + TELEPORT.gone + TELEPORT.rise + onward };
}

/**
 * Which portal a piece went through between `start` and `end`, worked out
 * from the cells alone (the engine records only where a piece ends up). A
 * portal is entered by sliding straight at it and left in the same
 * direction, so the piece's path is `start` -> in line with `enter`, then
 * `exit` -> in line with `end`, the same way. Null for a plain slide (or a
 * path a gravity zone bent, which slides as before).
 */
export function portalRoute(start: Cell, end: Cell, portals: ReadonlyArray<PortalPair>): PortalRoute | null {
  for (const [a, b] of portals) {
    for (const [enter, exit] of [
      [a, b],
      [b, a],
    ]) {
      const dRow = Math.sign(enter.row - start.row);
      const dCol = Math.sign(enter.col - start.col);
      // In line along one axis, and not already on the portal.
      if ((dRow !== 0) === (dCol !== 0)) continue;
      if (dRow === 0 ? enter.row !== start.row : enter.col !== start.col) continue;
      // Stopped short of the portal on its own line: a plain slide.
      const shortOfIt = dRow === 0 ? end.row === start.row && (end.col - start.col) * dCol < (enter.col - start.col) * dCol : end.col === start.col && (end.row - start.row) * dRow < (enter.row - start.row) * dRow;
      if (shortOfIt) continue;
      // Leaves the exit the same way: `end` is `exit` plus k steps, k >= 0.
      const offRow = end.row - exit.row;
      const offCol = end.col - exit.col;
      const k = dRow !== 0 ? offRow / dRow : offCol / dCol;
      const inLine = dRow !== 0 ? offCol === 0 : offRow === 0;
      if (inLine && Number.isInteger(k) && k >= 0) return { enter, exit };
    }
  }
  return null;
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
  /** How long a plain slide takes in this move. */
  readonly duration: number;
  /** Pieces that went through a portal, by id, with their own timing. */
  readonly teleports: ReadonlyMap<string, { readonly route: PortalRoute; readonly timing: TeleportTiming }>;
  /** Pieces a gravity zone turned, by id: every cell they passed, so they
   * slide round the corner instead of cutting across it. */
  readonly bends: ReadonlyMap<string, ReadonlyArray<Cell>>;
  readonly isAnimating: boolean;
}

const NO_TELEPORTS: SlidePlan['teleports'] = new Map();
const NO_BENDS: SlidePlan['bends'] = new Map();
const STILL: SlidePlan = { from: new Map(), key: 0, duration: 0, teleports: NO_TELEPORTS, bends: NO_BENDS, isAnimating: false };

/** `state`, when given, is the whole board: with it the slide follows the
 * way each piece really went (see `tracedRoutes`). */
export function useSlidePlan(target: ReadonlyArray<MovableObject>, instant: boolean, portals: ReadonlyArray<PortalPair> = [], state?: GameState): SlidePlan {
  // Planned during the render that brings the move, not in an effect after
  // it: an effect runs once that render has painted, so for one frame every
  // moving piece stood at its destination before jumping back to slide -
  // the "teleport" seen on a busy phone. Now the first frame of a move
  // already starts each piece where it was.
  const fromRef = useRef(target);
  const boardRef = useRef(state);
  const planRef = useRef<SlidePlan>(STILL);
  if (fromRef.current !== target) {
    planRef.current = planMove(fromRef.current, target, instant, portals, planRef.current.key + 1, boardRef.current);
    fromRef.current = target;
  }
  boardRef.current = state;
  const plan = planRef.current;

  // When the longest piece has landed.
  const [settledKey, setSettledKey] = useState(plan.key);
  useEffect(() => {
    if (!plan.isAnimating) return;
    const longest = Math.max(plan.duration, ...[...plan.teleports.values()].map(t => t.timing.total));
    const settle = setTimeout(() => setSettledKey(plan.key), longest);
    return () => clearTimeout(settle);
  }, [plan]);

  return plan.isAnimating && settledKey === plan.key ? { ...plan, isAnimating: false } : plan;
}

/** The slide from `before` to `after`: which pieces move, from where, and
 * for how long. */
/**
 * The way every piece really went, from the engine: the move is found by
 * trying each direction on the board as it was and keeping the one that
 * lands every piece where it now is. Only worth it where a path can bend
 * or jump - a zone or a portal; null otherwise, or for a change no single
 * move explains (undo, restart).
 */
function tracedRoutes(board: GameState | undefined, after: ReadonlyArray<MovableObject>): ReturnType<typeof traceGravity>['traces'] | null {
  if (!board || (!board.zone && board.portals.length === 0)) return null;
  const at = new Map(after.map(m => [m.id, m]));
  for (const direction of ALL_DIRECTIONS) {
    const next = applyGravity(board, direction).movables;
    if (next.length === after.length && next.every(m => at.get(m.id)?.row === m.row && at.get(m.id)?.col === m.col)) return traceGravity(board, direction).traces;
  }
  return null;
}

/** Whether a walk of cells keeps to one straight line. */
function isStraight(cells: ReadonlyArray<Cell>): boolean {
  return cells.every(c => c.row === cells[0].row) || cells.every(c => c.col === cells[0].col);
}

function planMove(before: ReadonlyArray<MovableObject>, after: ReadonlyArray<MovableObject>, instant: boolean, portals: ReadonlyArray<PortalPair>, key: number, board?: GameState): SlidePlan {
  const previous = new Map(before.map(movable => [movable.id, movable]));
  // Only a piece already on the board can slide; one new to it (a
  // different board swapped in) simply appears where it is.
  const moved = after.filter(movable => {
    const start = previous.get(movable.id);
    return start !== undefined && (start.row !== movable.row || start.col !== movable.col);
  });
  if (instant || moved.length === 0) return { from: new Map(), key, duration: 0, teleports: NO_TELEPORTS, bends: NO_BENDS, isAnimating: false };
  const from = new Map(moved.map(movable => [movable.id, previous.get(movable.id)!]));
  const travelled = moved.reduce((max, movable) => {
    const start = from.get(movable.id)!;
    return Math.max(max, Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col));
  }, 0);
  const teleports = new Map<string, { route: PortalRoute; timing: TeleportTiming }>();
  const bends = new Map<string, ReadonlyArray<Cell>>();
  const traces = tracedRoutes(board, after);
  let longest = travelled;
  for (const movable of moved) {
    const start = from.get(movable.id)!;
    const trace = traces?.get(movable.id);
    if (trace && trace.portal > 0 && trace.enter) {
      // In along the way it went, into the portal, and on from the exit.
      const route: PortalRoute = {
        enter: trace.enter,
        exit: trace.cells[trace.portal],
        before: [...trace.cells.slice(0, trace.portal), trace.enter],
        after: trace.cells.slice(trace.portal),
      };
      teleports.set(movable.id, { route, timing: teleportTiming(route, start, movable) });
    } else if (trace && !isStraight(trace.cells)) {
      bends.set(movable.id, trace.cells);
      longest = Math.max(longest, trace.cells.length - 1);
    } else if (!trace && portals.length > 0) {
      const route = portalRoute(start, movable, portals);
      if (route) teleports.set(movable.id, { route, timing: teleportTiming(route, start, movable) });
    }
  }
  return {
    from,
    key,
    duration: slideDurationFor(longest),
    teleports: teleports.size > 0 ? teleports : NO_TELEPORTS,
    bends: bends.size > 0 ? bends : NO_BENDS,
    isAnimating: true,
  };
}

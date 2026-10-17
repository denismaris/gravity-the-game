import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Circle, Group, RoundedRect } from '@shopify/react-native-skia';
import { Easing, runOnUI, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { GameState, StaticCellType } from '../engine';
import { shade } from './color';
import { BoardLayout, computeBoardLayout, getCellCenter, getCellOrigin } from './layout';
import {
  AnchoredPiece,
  CellBackground,
  DestroyedPieceMark,
  GravityZoneOverlay,
  HazardMarker,
  MovablePiece,
  ObstacleBlock,
  PortalMark,
  TargetMarker,
} from './shapes';
import { useAnimationClock } from './useAnimationClock';
import { useReducedMotion } from './useReducedMotion';
import { landingCurve, SlidePlan, TeleportTiming } from './useAnimatedMovables';
import { theme } from '../../theme';

export interface BoardViewProps {
  /** The current game state to draw. `state.movables` positions may be
   * fractional mid-slide (see `useAnimatedMovables`) - rendering does not
   * require integer coordinates. */
  state: GameState;
  /** Pixel size of the square area available to draw the board in. */
  size: number;
  /** Ids of movables currently resting on a target - rendered in an
   * "on target" color so multi-object puzzles show progress at a glance. */
  onTargetIds?: ReadonlySet<string>;
  /** Ids of movables that just finished sliding - rendered briefly larger
   * as a subtle "settled" cue. */
  pulsingIds?: ReadonlySet<string>;
  /** Every object is home - runs the board's finish flare. */
  solved?: boolean;
  /** When set, pieces slide from `slide.from` on the UI thread (see
   * `useSlidePlan`) and `state.movables` holds where they end up. */
  slide?: SlidePlan;
}

/**
 * The finish: a ring expands off each target in turn.
 *
 * Gravity was the one game in the app with no board celebration at all -
 * a solve simply stopped, and the completion card arrived over a board
 * that had not acknowledged anything. The ring is the shape this game
 * already uses to mean "this is where a piece belongs", so letting each
 * one open outward is the board saying the pieces are home in its own
 * existing vocabulary rather than in a new one.
 *
 * Staggered to land inside `SOLVE_CELEBRATION_MS`, the beat the
 * completion card waits out - at four targets the last opens at 210ms
 * and is gone by 590ms.
 */
const TARGET_FLARE_STAGGER_MS = 70;
const TARGET_FLARE_MS = 380;

const EMPTY_IDS: ReadonlySet<string> = new Set();

interface StaticGridLayerProps {
  staticGrid: GameState['staticGrid'];
  portals: GameState['portals'];
  zone: GameState['zone'];
  layout: BoardLayout;
  cellInset: number;
  cellCornerRadius: number;
  obstacleInset: number;
  obstacleCornerRadius: number;
  targetRadius: number;
  targetStrokeWidth: number;
  portalOuterRadius: number;
  portalInnerRadius: number;
  portalStrokeWidth: number;
  hazardSize: number;
}

/**
 * The non-moving half of the board: cell backgrounds, the gravity-zone
 * overlay, obstacles, targets, portal endpoints. Split out and memoized
 * because `applyGravity` never touches `state.staticGrid`, `state.portals`
 * or `state.zone` (it only replaces `movables`), so this whole layer is
 * identical across every frame of a gravity slide animation - recomputing
 * dozens of shapes ~60 times a second for content that never changes would
 * be pure waste. The zone tint is drawn on top of the cell backgrounds but
 * under obstacles/targets so those stay legible.
 */
/**
 * Soft sand: a low patch a little paler than the cell, with a scatter of
 * grains - flat, so it reads as ground a ball can roll onto, unlike the
 * raised block of an obstacle.
 */
function SandPatch({ x, y, size }: { x: number; y: number; size: number }): React.JSX.Element {
  const inset = size * 0.1;
  const grains = [
    [0.3, 0.32, 0.035],
    [0.62, 0.28, 0.03],
    [0.46, 0.5, 0.04],
    [0.28, 0.66, 0.03],
    [0.7, 0.62, 0.035],
    [0.52, 0.76, 0.028],
  ];
  return (
    <Group>
      <RoundedRect x={x + inset} y={y + inset} width={size - inset * 2} height={size - inset * 2} r={size * 0.2} color={theme.colors.gravitySand} />
      {grains.map(([gx, gy, gr], i) => (
        <Circle key={i} cx={x + size * gx} cy={y + size * gy} r={size * gr} color={shade(theme.colors.gravitySand, 0.78)} />
      ))}
    </Group>
  );
}

const StaticGridLayer = React.memo(function StaticGridLayerImpl({
  staticGrid,
  portals,
  zone,
  layout,
  cellInset,
  cellCornerRadius,
  obstacleInset,
  obstacleCornerRadius,
  targetRadius,
  targetStrokeWidth,
  portalOuterRadius,
  portalInnerRadius,
  portalStrokeWidth,
  hazardSize,
}: StaticGridLayerProps) {
  return (
    <Group>
      {staticGrid.map((row, rowIndex) =>
        row.map((_cellType, colIndex) => {
          const origin = getCellOrigin(layout, rowIndex, colIndex);
          return (
            <CellBackground
              key={`bg-${rowIndex}-${colIndex}`}
              x={origin.x + cellInset}
              y={origin.y + cellInset}
              size={layout.cellSize - cellInset * 2}
              fill={theme.colors.surface}
              stroke={theme.colors.border}
              cornerRadius={cellCornerRadius}
            />
          );
        }),
      )}

      {zone && (
        <GravityZoneOverlay
          x={getCellOrigin(layout, zone.minRow, zone.minCol).x}
          y={getCellOrigin(layout, zone.minRow, zone.minCol).y}
          width={(zone.maxCol - zone.minCol + 1) * layout.cellSize}
          height={(zone.maxRow - zone.minRow + 1) * layout.cellSize}
          rows={zone.maxRow - zone.minRow + 1}
          cols={zone.maxCol - zone.minCol + 1}
          cellSize={layout.cellSize}
          cornerRadius={cellCornerRadius}
          direction={zone.direction}
          fill={theme.colors.zoneFill}
          border={theme.colors.zoneBorder}
          arrow={theme.colors.zoneArrow}
        />
      )}

      {staticGrid.map((row, rowIndex) =>
        row.map((cellType, colIndex) => {
          if (cellType === StaticCellType.Empty) return null;
          const origin = getCellOrigin(layout, rowIndex, colIndex);
          const center = getCellCenter(layout, rowIndex, colIndex);
          return (
            <Group key={`cell-${rowIndex}-${colIndex}`}>
              {cellType === StaticCellType.Obstacle && (
                <ObstacleBlock
                  x={origin.x + obstacleInset}
                  y={origin.y + obstacleInset}
                  size={layout.cellSize - obstacleInset * 2}
                  color={theme.colors.textSecondary}
                  cornerRadius={obstacleCornerRadius}
                />
              )}
              {cellType === StaticCellType.Target && (
                <TargetMarker
                  cx={center.x}
                  cy={center.y}
                  radius={targetRadius}
                  color={theme.colors.accent}
                  strokeWidth={targetStrokeWidth}
                />
              )}
              {cellType === StaticCellType.Hazard && (
                <HazardMarker
                  cx={center.x}
                  cy={center.y}
                  size={hazardSize}
                  color={theme.colors.danger}
                  markColor={theme.colors.surface}
                />
              )}
              {cellType === StaticCellType.Sand && <SandPatch x={origin.x} y={origin.y} size={layout.cellSize} />}

            </Group>
          );
        }),
      )}

      {portals.map(([a, b], pairIndex) =>
        [a, b].map((endpoint, endIndex) => {
          const center = getCellCenter(layout, endpoint.row, endpoint.col);
          return (
            <PortalMark
              key={`portal-${pairIndex}-${endIndex}`}
              cx={center.x}
              cy={center.y}
              outerRadius={portalOuterRadius}
              innerRadius={portalInnerRadius}
              strokeWidth={portalStrokeWidth}
              color={PORTAL_COLORS[pairIndex % PORTAL_COLORS.length]()}
            />
          );
        }),
      )}
    </Group>
  );
});

/** A route as points with the distance walked to each one - what a piece
 * follows when its slide bends (a zone's corner, a portal's run in). */
interface Route {
  readonly points: ReadonlyArray<{ x: number; y: number }>;
  readonly lengths: ReadonlyArray<number>;
}

function routeThrough(points: ReadonlyArray<{ x: number; y: number }>): Route {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, lengths };
}

/** The point `f` (0..1) of the way along a route. */
function pointAlong(route: Route, f: number): { x: number; y: number } {
  'worklet';
  const { points, lengths } = route;
  const total = lengths[lengths.length - 1];
  if (total <= 0 || f <= 0) return points[0];
  if (f >= 1) return points[points.length - 1];
  const d = f * total;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i += 1;
  const span = lengths[i] - lengths[i - 1];
  const u = span > 0 ? (d - lengths[i - 1]) / span : 1;
  return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * u, y: points[i - 1].y + (points[i].y - points[i - 1].y) * u };
}

interface SlidingPieceProps {
  /** The way it went, when a zone bent it: followed instead of the straight
   * line from `from` to `to`. */
  route?: Route;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  squares: number;
  slideKey: number;
  duration: number;
  radius: number;
  /** Lands on a target: turns from blue to green as it lands, with a ring. */
  landsOnTarget: boolean;
  ringColor: string;
}

/** Share of a slide spent falling, before the landing (see `landingCurve`). */
const FALL_SHARE = 0.84;

/**
 * A piece that runs its own slide: the progress is a shared value timed on
 * the UI thread and the landing curve a worklet, so the board's React tree
 * renders once when the move starts, not on every frame of it.
 *
 * `started` holds the slide the progress belongs to. Until the new slide
 * has reached the UI thread, the piece is drawn where it starts - without
 * that, the first frame of every move showed the piece at its destination
 * (the previous slide's progress, finished) and then jumped back: the
 * "teleport" players saw.
 *
 * Landing, it squashes a little and settles. A piece landing on a target
 * turns green as it lands and sends a ring out.
 */
function SlidingPiece({ route, fromX, fromY, toX, toY, squares, slideKey, duration, radius, landsOnTarget, ringColor }: SlidingPieceProps) {
  const moving = duration > 0 && (fromX !== toX || fromY !== toY);
  // The squash is against the last wall it met, so it follows the last leg.
  const last = route && route.points.length > 1 ? route.points[route.points.length - 2] : { x: fromX, y: fromY };
  const geometry = {
    fx: fromX,
    fy: fromY,
    tx: toX,
    ty: toY,
    squares,
    moving,
    horizontal: Math.abs(toX - last.x) > Math.abs(toY - last.y),
    lands: landsOnTarget,
    route: route ?? null,
  };
  // The slide lives entirely on the UI thread: where it runs from and to,
  // and how far along it is, are shared values written together, in one
  // step. Drawing from React's props instead let a frame pair a new move's
  // end point with the last move's finished progress - the ball flashed at
  // its destination, then jumped back to slide (worst when a swipe came
  // in while the last slide was still landing).
  const move = useSharedValue(geometry);
  // Mounted mid-move (after a teleport the piece is a new component), it
  // starts at the beginning.
  const progress = useSharedValue(moving ? 0 : 1);
  useLayoutEffect(() => {
    runOnUI((next: typeof geometry, ms: number) => {
      'worklet';
      move.value = next;
      if (!next.moving) {
        progress.value = 1;
        return;
      }
      progress.value = 0;
      progress.value = withTiming(1, { duration: ms, easing: Easing.linear });
    })(geometry, duration);
    // A new slide is a new key; positions alone can repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey]);

  const transform = useDerivedValue(() => {
    const m = move.value;
    const t = progress.value;
    const along = landingCurve(t, m.squares);
    // Landing: a small squash against the wall, then round again. No
    // stretch in flight - on a phone it read as the ball wobbling.
    let k = 0;
    if (m.moving && t > FALL_SHARE && t < 1) k = Math.sin(((t - FALL_SHARE) / (1 - FALL_SHARE)) * Math.PI);
    const flat = 1 - 0.12 * k;
    const wide = 1 + 0.07 * k;
    const at = m.route ? pointAlong(m.route, along) : { x: m.fx + (m.tx - m.fx) * along, y: m.fy + (m.ty - m.fy) * along };
    return [
      { translateX: at.x },
      { translateY: at.y },
      { scaleX: m.horizontal ? flat : wide },
      { scaleY: m.horizontal ? wide : flat },
    ];
  });
  // Blue until it lands; green from then if it found its target.
  const greenOpacity = useDerivedValue(() => (move.value.lands ? (!move.value.moving || progress.value >= FALL_SHARE ? 1 : 0) : 0));
  const blueOpacity = useDerivedValue(() => 1 - greenOpacity.value);
  const ringT = useDerivedValue(() => (move.value.lands && move.value.moving && progress.value >= FALL_SHARE ? (progress.value - FALL_SHARE) / (1 - FALL_SHARE) : 0));
  const ringX = useDerivedValue(() => move.value.tx);
  const ringY = useDerivedValue(() => move.value.ty);
  const ringR = useDerivedValue(() => radius * (1.05 + 0.55 * ringT.value));
  const ringOpacity = useDerivedValue(() => (ringT.value > 0 && ringT.value < 1 ? 0.7 * (1 - ringT.value) : 0));

  return (
    <>
      <Circle cx={ringX} cy={ringY} r={ringR} color={ringColor} style="stroke" strokeWidth={2} opacity={ringOpacity} />
      <Group transform={transform}>
        <Group opacity={blueOpacity}>
          <MovablePiece cx={0} cy={0} radius={radius} color={theme.colors.pieceBlue} />
        </Group>
        <Group opacity={greenOpacity}>
          <MovablePiece cx={0} cy={0} radius={radius} color={theme.colors.success} />
        </Group>
      </Group>
    </>
  );
}

type Point = { x: number; y: number };

/** Each linked pair of portals in its own colour, so which two belong
 * together is plain at a glance. Read from the theme when drawn. */
const PORTAL_COLORS: ReadonlyArray<() => string> = [() => theme.colors.secondary, () => theme.colors.accent, () => theme.colors.success];

interface TeleportingPieceProps {
  /** The runs in and on, when they bend: followed instead of straight
   * lines from `from` to `enter` and from `exit` to `to`. */
  approach?: Route;
  onward?: Route;
  from: Point;
  enter: Point;
  exit: Point;
  to: Point;
  squaresAfter: number;
  timing: TeleportTiming;
  slideKey: number;
  radius: number;
  ringRadius: number;
  color: string;
  ringColor: string;
}

/**
 * A piece going through a portal, so it reads as a jump and not a skid:
 * it runs into the portal and sinks into it (shrinking to nothing as a
 * ring opens out of the portal), is gone for a beat, then rises out of the
 * other end (with a ring of its own, and a small overshoot as it arrives)
 * and runs on to where it stops. One shared value on the UI thread drives
 * every part, timed in milliseconds.
 */
function TeleportingPiece({ approach, onward, from, enter, exit, to, squaresAfter, timing, slideKey, radius, ringRadius, color, ringColor }: TeleportingPieceProps) {
  const runIn = approach ?? routeThrough([from, enter]);
  const runOn = onward ?? routeThrough([exit, to]);
  // Starts at 0, not finished: a piece mounted for its teleport must be
  // drawn where it starts from its very first frame.
  const clock = useSharedValue(0);
  useLayoutEffect(() => {
    clock.value = 0;
    clock.value = withTiming(timing.total, { duration: timing.total, easing: Easing.linear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey]);
  const sinkAt = timing.approach;
  const goneAt = sinkAt + timing.sink;
  const riseAt = goneAt + timing.gone;
  const onwardAt = riseAt + timing.rise;

  const transform = useDerivedValue(() => {
    const t = clock.value;
    let x = to.x;
    let y = to.y;
    let scale = 1;
    if (t < sinkAt) {
      const u = sinkAt > 0 ? t / sinkAt : 1;
      // Leaves at speed, like every slide (see `easeInFall`).
      const along = 0.45 * u + 0.55 * u * u;
      const at = pointAlong(runIn, along);
      x = at.x;
      y = at.y;
    } else if (t < goneAt) {
      const u = (t - sinkAt) / timing.sink;
      x = enter.x;
      y = enter.y;
      scale = 1 - u * u * (3 - 2 * u);
    } else if (t < riseAt) {
      x = exit.x;
      y = exit.y;
      scale = 0;
    } else if (t < onwardAt) {
      const u = (t - riseAt) / timing.rise;
      x = exit.x;
      y = exit.y;
      // Out with a small overshoot, then settle.
      const c = 1.6;
      const v = u - 1;
      scale = 1 + (c + 1) * v * v * v + c * v * v;
    } else {
      const u = timing.onward > 0 ? Math.min(1, (t - onwardAt) / timing.onward) : 1;
      const along = landingCurve(u, squaresAfter);
      const at = pointAlong(runOn, along);
      x = at.x;
      y = at.y;
    }
    return [{ translateX: x }, { translateY: y }, { scale: Math.max(0.001, scale) }];
  });

  // A ring opening out of each portal: as the piece sinks in, and as it
  // rises out.
  const ringIn = useDerivedValue(() => Math.min(1, Math.max(0, (clock.value - sinkAt) / (timing.sink + timing.gone))));
  const ringOut = useDerivedValue(() => Math.min(1, Math.max(0, (clock.value - goneAt) / (timing.gone + timing.rise))));
  const ringInR = useDerivedValue(() => ringRadius * (0.6 + 0.9 * ringIn.value));
  const ringInOpacity = useDerivedValue(() => (ringIn.value > 0 && ringIn.value < 1 ? 0.75 * (1 - ringIn.value) : 0));
  const ringOutR = useDerivedValue(() => ringRadius * (0.6 + 0.9 * ringOut.value));
  const ringOutOpacity = useDerivedValue(() => (ringOut.value > 0 && ringOut.value < 1 ? 0.75 * (1 - ringOut.value) : 0));

  return (
    <>
      <Circle cx={enter.x} cy={enter.y} r={ringInR} color={ringColor} style="stroke" strokeWidth={2} opacity={ringInOpacity} />
      <Circle cx={exit.x} cy={exit.y} r={ringOutR} color={ringColor} style="stroke" strokeWidth={2} opacity={ringOutOpacity} />
      <Group transform={transform}>
        <MovablePiece cx={0} cy={0} radius={radius} color={color} />
      </Group>
    </>
  );
}

/**
 * Renders a `GameState` as a grid of Skia shapes.
 *
 * This is the single place that maps game-object types to their visual
 * representation. Everything here is Skia primitives - no React Native
 * Views are used, so the board stays cheap to render regardless of grid
 * size. It contains no game logic: it only reads the state (and small
 * presentation hints) it is given.
 *
 * Two layers are drawn:
 *   1. The static grid (cell backgrounds, gravity-zone overlay, obstacles,
 *      targets, hazards, portal endpoints) - memoized, never re-drawn just
 *      because a piece is mid-slide.
 *   2. The objects, positioned from `state.movables`: normal pieces (filled
 *      circle, blue, or green on target), anchored pieces (a muted, ringed
 *      core that reads as "pinned in place"), and destroyed pieces (a
 *      danger-coloured core with a cut-out X, drawn wherever a hazard
 *      claimed them). Only this layer changes during a slide; anchored and
 *      destroyed pieces never move.
 */
export function BoardView({ state, size, onTargetIds = EMPTY_IDS, pulsingIds = EMPTY_IDS, solved = false, slide }: BoardViewProps) {
  const layout = useMemo(() => computeBoardLayout(state.cols, size), [state.cols, size]);
  const reducedMotion = useReducedMotion();

  const targets = useMemo(() => {
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        if (state.staticGrid[row][col] === StaticCellType.Target) cells.push({ row, col });
      }
    }
    return cells;
  }, [state.staticGrid, state.rows, state.cols]);

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = Date.now();
  if (!solved && solvedAtRef.current !== null) solvedAtRef.current = null;
  const solvedAt = solvedAtRef.current;

  const now = Date.now();
  const flareWindow = targets.length * TARGET_FLARE_STAGGER_MS + TARGET_FLARE_MS;
  const flaring = solvedAt !== null && !reducedMotion && now - solvedAt < flareWindow;
  useAnimationClock(flaring, 60);

  const cellInset = layout.cellSize * 0.05;
  const cellCornerRadius = layout.cellSize * 0.14;
  const obstacleInset = layout.cellSize * 0.12;
  const obstacleCornerRadius = layout.cellSize * 0.12;
  const movableRadius = layout.cellSize * 0.32;
  const targetRadius = layout.cellSize * 0.34;
  const targetStrokeWidth = Math.max(1.5, layout.cellSize * 0.04);
  const pulseRadius = movableRadius * 1.1;
  const anchoredRadius = layout.cellSize * 0.24;
  const anchoredRingRadius = layout.cellSize * 0.36;
  const anchoredStrokeWidth = Math.max(2, layout.cellSize * 0.06);
  const portalOuterRadius = layout.cellSize * 0.34;
  const portalInnerRadius = layout.cellSize * 0.19;
  const portalStrokeWidth = Math.max(2, layout.cellSize * 0.055);
  const hazardSize = layout.cellSize * 0.32;

  return (
    <Group>
      <StaticGridLayer
        staticGrid={state.staticGrid}
        portals={state.portals}
        zone={state.zone}
        layout={layout}
        cellInset={cellInset}
        cellCornerRadius={cellCornerRadius}
        obstacleInset={obstacleInset}
        obstacleCornerRadius={obstacleCornerRadius}
        targetRadius={targetRadius}
        targetStrokeWidth={targetStrokeWidth}
        portalOuterRadius={portalOuterRadius}
        portalInnerRadius={portalInnerRadius}
        portalStrokeWidth={portalStrokeWidth}
        hazardSize={hazardSize}
      />

      {state.movables.map(movable => {
        const center = getCellCenter(layout, movable.row, movable.col);

        if (movable.anchored) {
          return (
            <AnchoredPiece
              key={movable.id}
              cx={center.x}
              cy={center.y}
              radius={anchoredRadius}
              ringRadius={anchoredRingRadius}
              strokeWidth={anchoredStrokeWidth}
              color={theme.colors.textSecondary}
            />
          );
        }

        if (movable.destroyed) {
          // A piece running into a hazard slides there like any other,
          // and only breaks once it arrives - it used to be drawn broken at
          // the hazard from the first frame, so it seemed to jump there.
          const start = slide?.isAnimating ? slide.from.get(movable.id) : undefined;
          if (slide && start) {
            const from = getCellCenter(layout, start.row, start.col);
            return (
              <SlidingPiece
                key={`${movable.id}@${slide.key}`}
                fromX={from.x}
                fromY={from.y}
                toX={center.x}
                toY={center.y}
                squares={Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col)}
                slideKey={slide.key}
                duration={slide.duration}
                radius={movableRadius}
                landsOnTarget={false}
                ringColor={theme.colors.success}
              />
            );
          }
          return (
            <BreakIn key={`${movable.id}-broken`} cx={center.x} cy={center.y} radius={movableRadius}>
              <DestroyedPieceMark cx={center.x} cy={center.y} radius={movableRadius} color={theme.colors.danger} markColor={theme.colors.surface} />
            </BreakIn>
          );
        }

        const onTarget = onTargetIds.has(movable.id);
        const pulsing = pulsingIds.has(movable.id);

        if (slide) {
          const start = slide.from.get(movable.id);
          const from = start ? getCellCenter(layout, start.row, start.col) : center;
          const teleport = slide.teleports.get(movable.id);
          if (teleport && start) {
            const enter = getCellCenter(layout, teleport.route.enter.row, teleport.route.enter.col);
            const exit = getCellCenter(layout, teleport.route.exit.row, teleport.route.exit.col);
            return (
              // A fresh one per teleport, so it always starts where the piece
              // is - never from the last teleport's finished clock.
              <TeleportingPiece
                key={`${movable.id}@${slide.key}`}
                approach={teleport.route.before ? routeThrough(teleport.route.before.map(c => getCellCenter(layout, c.row, c.col))) : undefined}
                onward={teleport.route.after ? routeThrough(teleport.route.after.map(c => getCellCenter(layout, c.row, c.col))) : undefined}
                from={from}
                enter={enter}
                exit={exit}
                to={center}
                squaresAfter={teleport.route.after ? teleport.route.after.length - 1 : Math.abs(movable.row - teleport.route.exit.row) + Math.abs(movable.col - teleport.route.exit.col)}
                timing={teleport.timing}
                slideKey={slide.key}
                radius={movableRadius}
                ringRadius={layout.cellSize * 0.34}
                color={onTarget ? theme.colors.success : theme.colors.pieceBlue}
                ringColor={PORTAL_COLORS[Math.max(0, state.portals.findIndex(([a, b]) => [a, b].some(e => e.row === teleport.route.enter.row && e.col === teleport.route.enter.col))) % PORTAL_COLORS.length]()}
              />
            );
          }
          const bend = slide.bends.get(movable.id);
          return (
            <SlidingPiece
              key={movable.id}
              route={bend ? routeThrough(bend.map(c => getCellCenter(layout, c.row, c.col))) : undefined}
              fromX={from.x}
              fromY={from.y}
              toX={center.x}
              toY={center.y}
              squares={bend ? bend.length - 1 : start ? Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col) : 0}
              slideKey={slide.key}
              duration={slide.duration}
              radius={movableRadius}
              landsOnTarget={onTarget}
              ringColor={theme.colors.success}
            />
          );
        }

        return (
          <MovablePiece
            key={movable.id}
            cx={center.x}
            cy={center.y}
            radius={pulsing ? pulseRadius : movableRadius}
            color={onTarget ? theme.colors.success : theme.colors.pieceBlue}
          />
        );
      })}

      {/* The finish flare - a ring opening off each target in turn. */}
      {flaring &&
        targets.map((cell, index) => {
          const t = (now - solvedAt! - index * TARGET_FLARE_STAGGER_MS) / TARGET_FLARE_MS;
          if (t < 0 || t >= 1) return null;
          const center = getCellCenter(layout, cell.row, cell.col);
          const eased = 1 - (1 - t) ** 3;
          return (
            <Circle
              key={`flare-${cell.row}-${cell.col}`}
              cx={center.x}
              cy={center.y}
              r={targetRadius * (1 + eased * 1.6)}
              color={theme.colors.accent}
              style="stroke"
              strokeWidth={targetStrokeWidth * (1 - eased * 0.55)}
              opacity={1 - eased}
            />
          );
        })}
    </Group>
  );
}

/**
 * A piece breaking on a hazard: it gives a jolt - squashed, then a little
 * too big - and a ring of red spreads from it, once.
 */
function BreakIn({ cx, cy, radius, children }: { cx: number; cy: number; radius: number; children: React.ReactNode }): React.JSX.Element {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) t.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [t, reduced]);
  const transform = useDerivedValue(() => {
    const k = t.value;
    const s = k < 0.3 ? 0.7 + (k / 0.3) * 0.45 : 1.15 - ((k - 0.3) / 0.7) * 0.15;
    return [{ translateX: cx }, { translateY: cy }, { scale: s }, { translateX: -cx }, { translateY: -cy }];
  });
  const ringR = useDerivedValue(() => radius * (1 + 1.2 * t.value));
  const ringO = useDerivedValue(() => (t.value >= 1 ? 0 : 0.6 * (1 - t.value)));
  return (
    <Group>
      <Circle cx={cx} cy={cy} r={ringR} color={theme.colors.danger} style="stroke" strokeWidth={2} opacity={ringO} />
      <Group transform={transform}>{children}</Group>
    </Group>
  );
}

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { GameState, StaticCellType } from '../engine';
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
import { landingCurve, SlidePlan } from './useAnimatedMovables';
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
              color={theme.colors.secondary}
            />
          );
        }),
      )}
    </Group>
  );
});

interface SlidingPieceProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  squares: number;
  slideKey: number;
  duration: number;
  radius: number;
  color: string;
}

/**
 * A piece that runs its own slide: the progress is a shared value timed on
 * the UI thread and the landing curve a worklet, so the board's React tree
 * renders once when the move starts, not on every frame of it.
 */
function SlidingPiece({ fromX, fromY, toX, toY, squares, slideKey, duration, radius, color }: SlidingPieceProps) {
  const progress = useSharedValue(1);
  // Before paint, so the piece never shows a frame at its destination.
  useLayoutEffect(() => {
    if (duration <= 0 || (fromX === toX && fromY === toY)) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration, easing: Easing.linear });
    // A new slide is a new key; positions alone can repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey]);
  const transform = useDerivedValue(() => {
    const along = landingCurve(progress.value, squares);
    return [{ translateX: fromX + (toX - fromX) * along }, { translateY: fromY + (toY - fromY) * along }];
  });
  return (
    <Group transform={transform}>
      <MovablePiece cx={0} cy={0} radius={radius} color={color} />
    </Group>
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
  const obstacleInset = layout.cellSize * 0.2;
  const obstacleCornerRadius = layout.cellSize * 0.06;
  const movableRadius = layout.cellSize * 0.32;
  const targetRadius = layout.cellSize * 0.28;
  const targetStrokeWidth = Math.max(2, layout.cellSize * 0.06);
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
          return (
            <DestroyedPieceMark
              key={movable.id}
              cx={center.x}
              cy={center.y}
              radius={movableRadius}
              color={theme.colors.danger}
              markColor={theme.colors.surface}
            />
          );
        }

        const onTarget = onTargetIds.has(movable.id);
        const pulsing = pulsingIds.has(movable.id);

        if (slide) {
          const start = slide.from.get(movable.id);
          const from = start ? getCellCenter(layout, start.row, start.col) : center;
          return (
            <SlidingPiece
              key={movable.id}
              fromX={from.x}
              fromY={from.y}
              toX={center.x}
              toY={center.y}
              squares={start ? Math.abs(movable.row - start.row) + Math.abs(movable.col - start.col) : 0}
              slideKey={slide.key}
              duration={slide.duration}
              radius={movableRadius}
              color={onTarget ? theme.colors.success : theme.colors.pieceBlue}
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


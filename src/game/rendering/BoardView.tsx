import React, { useMemo } from 'react';
import { Group } from '@shopify/react-native-skia';
import { GameState, StaticCellType } from '../engine';
import { BoardLayout, computeBoardLayout, getCellCenter, getCellOrigin } from './layout';
import { AnchoredPiece, CellBackground, MovablePiece, ObstacleBlock, TargetMarker } from './shapes';
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
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

interface StaticGridLayerProps {
  staticGrid: GameState['staticGrid'];
  layout: BoardLayout;
  cellInset: number;
  cellCornerRadius: number;
  obstacleInset: number;
  obstacleCornerRadius: number;
  targetRadius: number;
  targetStrokeWidth: number;
}

/**
 * The non-moving half of the board: cell backgrounds, obstacles, targets.
 * Split out and memoized because `applyGravity` never touches
 * `state.staticGrid` (it only replaces `movables`), so this whole layer is
 * identical across every frame of a gravity slide animation - recomputing
 * dozens of shapes ~60 times a second for content that never changes would
 * be pure waste.
 */
const StaticGridLayer = React.memo(function StaticGridLayerImpl({
  staticGrid,
  layout,
  cellInset,
  cellCornerRadius,
  obstacleInset,
  obstacleCornerRadius,
  targetRadius,
  targetStrokeWidth,
}: StaticGridLayerProps) {
  return (
    <Group>
      {staticGrid.map((row, rowIndex) =>
        row.map((cellType, colIndex) => {
          const origin = getCellOrigin(layout, rowIndex, colIndex);
          const center = getCellCenter(layout, rowIndex, colIndex);

          return (
            <Group key={`static-${rowIndex}-${colIndex}`}>
              <CellBackground
                x={origin.x + cellInset}
                y={origin.y + cellInset}
                size={layout.cellSize - cellInset * 2}
                fill={theme.colors.surface}
                stroke={theme.colors.border}
                cornerRadius={cellCornerRadius}
              />

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
            </Group>
          );
        }),
      )}
    </Group>
  );
});

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
 *   1. The static grid (cell backgrounds, obstacles, targets) - memoized,
 *      never re-drawn just because a piece is mid-slide.
 *   2. The objects, positioned from `state.movables`: normal pieces (filled
 *      circle, blue, or green on target) and anchored pieces (a muted,
 *      ringed core that reads as "pinned in place"). Only this layer changes
 *      during a slide; anchored pieces never move.
 */
export function BoardView({ state, size, onTargetIds = EMPTY_IDS, pulsingIds = EMPTY_IDS }: BoardViewProps) {
  const layout = useMemo(() => computeBoardLayout(state.cols, size), [state.cols, size]);

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

  return (
    <Group>
      <StaticGridLayer
        staticGrid={state.staticGrid}
        layout={layout}
        cellInset={cellInset}
        cellCornerRadius={cellCornerRadius}
        obstacleInset={obstacleInset}
        obstacleCornerRadius={obstacleCornerRadius}
        targetRadius={targetRadius}
        targetStrokeWidth={targetStrokeWidth}
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

        const onTarget = onTargetIds.has(movable.id);
        const pulsing = pulsingIds.has(movable.id);

        return (
          <MovablePiece
            key={movable.id}
            cx={center.x}
            cy={center.y}
            radius={pulsing ? pulseRadius : movableRadius}
            color={onTarget ? theme.colors.success : theme.colors.primary}
          />
        );
      })}
    </Group>
  );
}


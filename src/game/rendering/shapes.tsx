import React from 'react';
import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import type { Direction } from '../engine';

/**
 * Small, dumb, reusable Skia primitives used to draw a single game object.
 * Each one takes plain pixel geometry + a color - no game or theme
 * knowledge - so they stay easy to reuse and to test in isolation.
 */

export interface CellBackgroundProps {
  x: number;
  y: number;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

/** The neutral square background every cell is drawn on top of. */
export function CellBackground({
  x,
  y,
  size,
  fill,
  stroke,
  strokeWidth = 1,
  cornerRadius = 0,
}: CellBackgroundProps) {
  return (
    <>
      <RoundedRect x={x} y={y} width={size} height={size} r={cornerRadius} color={fill} />
      <RoundedRect
        x={x}
        y={y}
        width={size}
        height={size}
        r={cornerRadius}
        color={stroke}
        style="stroke"
        strokeWidth={strokeWidth}
      />
    </>
  );
}

export interface MovablePieceProps {
  cx: number;
  cy: number;
  radius: number;
  color: string;
}

/** The player-controlled object: a simple filled circle (●). */
export function MovablePiece({ cx, cy, radius, color }: MovablePieceProps) {
  return <Circle cx={cx} cy={cy} r={radius} color={color} />;
}

export interface AnchoredPieceProps {
  cx: number;
  cy: number;
  /** Radius of the solid core. */
  radius: number;
  /** Radius of the outer "bolted down" ring. */
  ringRadius: number;
  strokeWidth: number;
  color: string;
}

/**
 * An anchored object: a piece gravity never moves.
 *
 * Drawn as a solid core (like a normal piece, so it still reads as "an
 * object") wrapped by a heavier concentric ring - the visual language of
 * something bolted or pinned in place. Deliberately a muted colour and a
 * static shape: no glow, no animation. It must not be mistaken for the
 * player's blue movable piece or the hollow target ring.
 */
export function AnchoredPiece({
  cx,
  cy,
  radius,
  ringRadius,
  strokeWidth,
  color,
}: AnchoredPieceProps) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={ringRadius} color={color} style="stroke" strokeWidth={strokeWidth} />
      <Circle cx={cx} cy={cy} r={radius} color={color} />
    </>
  );
}

export interface TargetMarkerProps {
  cx: number;
  cy: number;
  radius: number;
  color: string;
  strokeWidth: number;
}

/** The goal cell: a hollow ring (○) so it never gets confused with the piece. */
export function TargetMarker({ cx, cy, radius, color, strokeWidth }: TargetMarkerProps) {
  return (
    <Circle cx={cx} cy={cy} r={radius} color={color} style="stroke" strokeWidth={strokeWidth} />
  );
}

export interface ObstacleBlockProps {
  x: number;
  y: number;
  size: number;
  color: string;
  cornerRadius?: number;
}

/** A blocking cell: a filled square (■) with a slightly sharper corner than the board. */
export function ObstacleBlock({ x, y, size, color, cornerRadius = 0 }: ObstacleBlockProps) {
  return <RoundedRect x={x} y={y} width={size} height={size} r={cornerRadius} color={color} />;
}

export interface PortalMarkProps {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  strokeWidth: number;
  color: string;
}

/**
 * A portal endpoint: two concentric hollow rings (◎). Distinct from the
 * single thin target ring and the filled anchored piece, and drawn in its
 * own colour so a matched pair reads as "a gateway" without any glow,
 * particles or connecting line.
 */
export function PortalMark({
  cx,
  cy,
  outerRadius,
  innerRadius,
  strokeWidth,
  color,
}: PortalMarkProps) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={outerRadius} color={color} style="stroke" strokeWidth={strokeWidth} />
      <Circle cx={cx} cy={cy} r={innerRadius} color={color} style="stroke" strokeWidth={strokeWidth} />
    </>
  );
}

export interface GravityZoneOverlayProps {
  /** Pixel rect of the whole zone (top-left + size). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grid extent of the zone, so chevrons can be placed one per cell. */
  rows: number;
  cols: number;
  cellSize: number;
  cornerRadius: number;
  /** The direction gravity pulls inside the zone. */
  direction: Direction;
  fill: string;
  border: string;
  arrow: string;
}

/** Unit chevron (apex-forward) as an SVG path, scaled to `s`, pointing `dir`. */
function chevronPath(cx: number, cy: number, s: number, dir: Direction): string {
  // Base points for a "down"-pointing chevron centred on (0,0): a wide V.
  const pts: Array<[number, number]> =
    dir === 'down'
      ? [[-s, -s * 0.5], [0, s * 0.5], [s, -s * 0.5]]
      : dir === 'up'
      ? [[-s, s * 0.5], [0, -s * 0.5], [s, s * 0.5]]
      : dir === 'right'
      ? [[-s * 0.5, -s], [s * 0.5, 0], [-s * 0.5, s]]
      : [[s * 0.5, -s], [-s * 0.5, 0], [s * 0.5, s]];
  const [p0, p1, p2] = pts.map(([px, py]) => [cx + px, cy + py]);
  return `M ${p0[0]} ${p0[1]} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]}`;
}

/**
 * A gravity zone: a faint tinted rectangle with a thin border and a grid of
 * small chevrons all pointing the way gravity pulls inside it. Everything is
 * low-opacity and static - it should read as "this area behaves differently"
 * at a glance without competing with the pieces, obstacles or targets drawn
 * on top of it.
 */
export function GravityZoneOverlay({
  x,
  y,
  width,
  height,
  rows,
  cols,
  cellSize,
  cornerRadius,
  direction,
  fill,
  border,
  arrow,
}: GravityZoneOverlayProps) {
  const chevronSize = cellSize * 0.12;
  const strokeWidth = Math.max(1, cellSize * 0.03);

  const chevrons: React.ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * cellSize + cellSize / 2;
      const cy = y + r * cellSize + cellSize / 2;
      chevrons.push(
        <Path
          key={`zc-${r}-${c}`}
          path={chevronPath(cx, cy, chevronSize, direction)}
          color={arrow}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
        />,
      );
    }
  }

  return (
    <Group>
      <RoundedRect x={x} y={y} width={width} height={height} r={cornerRadius} color={fill} />
      <RoundedRect
        x={x}
        y={y}
        width={width}
        height={height}
        r={cornerRadius}
        color={border}
        style="stroke"
        strokeWidth={Math.max(1, cellSize * 0.04)}
      />
      {chevrons}
    </Group>
  );
}

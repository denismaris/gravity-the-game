import React from 'react';
import { Circle, RoundedRect } from '@shopify/react-native-skia';

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

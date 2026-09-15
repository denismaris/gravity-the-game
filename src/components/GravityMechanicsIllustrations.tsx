import React from 'react';
import { Circle, Group, Path } from '@shopify/react-native-skia';
import { CellBackground, MovablePiece, TargetMarker } from '../game/rendering';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Gravity's own `MechanicsCarousel` illustrations - see
 * `BinairoMechanicsIllustrations.tsx`'s own doc comment for the pattern
 * this follows: every cell/piece/target below is drawn with the real
 * board's own primitives (`CellBackground`/`MovablePiece`/`TargetMarker`
 * from `src/game/rendering`), at rest, so a slide's diagram is the same
 * shapes a player will actually see on the board, not a separately
 * maintained illustration asset.
 */
export function renderGravityIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'swipe':
      return <SwipeIllustration />;
    case 'target':
      return <TargetIllustration />;
    case 'multi':
      return <MultiIllustration />;
    default:
      return <Group />;
  }
}

const CELL = 56;
const CELL_RADIUS = CELL * 0.14;

function illustrationCell(x: number, y: number): React.JSX.Element {
  return <CellBackground x={x} y={y} size={CELL} fill={theme.colors.surface} stroke={theme.colors.border} cornerRadius={CELL_RADIUS} />;
}

/** A rightward shaft plus an open chevron head - the same "direction of
 * travel" language a swipe gesture implies, without needing actual
 * motion to read as motion. */
function arrowPath(cx: number, cy: number, length: number): string {
  const half = length / 2;
  const head = length * 0.3;
  return `M ${cx - half} ${cy} L ${cx + half} ${cy} M ${cx + half - head} ${cy - head * 0.8} L ${cx + half} ${cy} L ${cx + half - head} ${cy + head * 0.8}`;
}

function SwipeIllustration(): React.JSX.Element {
  const gap = 14;
  const totalWidth = CELL * 3 + gap * 2;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - CELL) / 2;
  const cx = (i: number): number => startX + i * (CELL + gap) + CELL / 2;
  const cy = y + CELL / 2;
  const radius = CELL * 0.32;

  return (
    <Group>
      {[0, 1, 2].map(i => (
        <Group key={i}>{illustrationCell(startX + i * (CELL + gap), y)}</Group>
      ))}
      {/* A faded outline marks where the piece started - the solid piece
          two cells over is where the same swipe leaves it. */}
      <Circle cx={cx(0)} cy={cy} r={radius} color={theme.colors.pieceBlue} style="stroke" strokeWidth={2} opacity={0.35} />
      <Path
        path={arrowPath((cx(0) + cx(2)) / 2, y - 16, CELL * 1.7)}
        color={theme.colors.textSecondary}
        style="stroke"
        strokeWidth={2.4}
        strokeCap="round"
        strokeJoin="round"
      />
      <MovablePiece cx={cx(2)} cy={cy} radius={radius} color={theme.colors.pieceBlue} />
    </Group>
  );
}

function TargetIllustration(): React.JSX.Element {
  const size = 84;
  const x = (ILLUSTRATION_WIDTH - size) / 2;
  const y = (ILLUSTRATION_HEIGHT - size) / 2;
  const cx = x + size / 2;
  const cy = y + size / 2;

  return (
    <Group>
      <CellBackground x={x} y={y} size={size} fill={theme.colors.surface} stroke={theme.colors.border} cornerRadius={size * 0.14} />
      <TargetMarker cx={cx} cy={cy} radius={size * 0.34} color={theme.colors.accent} strokeWidth={Math.max(2, size * 0.07)} />
      {/* Success green, the same colour a piece turns the moment it's
          actually resting on its target. */}
      <MovablePiece cx={cx} cy={cy} radius={size * 0.26} color={theme.colors.success} />
    </Group>
  );
}

function MultiIllustration(): React.JSX.Element {
  const gap = 12;
  const totalSize = CELL * 2 + gap;
  const startX = (ILLUSTRATION_WIDTH - totalSize) / 2;
  const startY = (ILLUSTRATION_HEIGHT - totalSize) / 2;
  const originOf = (row: number, col: number): { x: number; y: number } => ({
    x: startX + col * (CELL + gap),
    y: startY + row * (CELL + gap),
  });
  const centerOf = (row: number, col: number): { cx: number; cy: number } => {
    const { x, y } = originOf(row, col);
    return { cx: x + CELL / 2, cy: y + CELL / 2 };
  };

  const topLeft = centerOf(0, 0);
  const topRight = centerOf(0, 1);
  const bottomRight = centerOf(1, 1);

  return (
    <Group>
      {[0, 1].map(row =>
        [0, 1].map(col => {
          const { x, y } = originOf(row, col);
          return <Group key={`${row}-${col}`}>{illustrationCell(x, y)}</Group>;
        }),
      )}
      {/* One piece already resting on its target (solved)... */}
      <TargetMarker cx={topLeft.cx} cy={topLeft.cy} radius={CELL * 0.32} color={theme.colors.accent} strokeWidth={Math.max(2, CELL * 0.07)} />
      <MovablePiece cx={topLeft.cx} cy={topLeft.cy} radius={CELL * 0.26} color={theme.colors.success} />
      {/* ...another target still waiting... */}
      <TargetMarker cx={topRight.cx} cy={topRight.cy} radius={CELL * 0.32} color={theme.colors.accent} strokeWidth={Math.max(2, CELL * 0.06)} />
      {/* ...and another piece still travelling - the same swipe moves both at once. */}
      <MovablePiece cx={bottomRight.cx} cy={bottomRight.cy} radius={CELL * 0.28} color={theme.colors.pieceBlue} />
    </Group>
  );
}

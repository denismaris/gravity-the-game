import React from 'react';
import { Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Skyscrapers' own `MechanicsCarousel` illustrations. Unlike every other
 * game's illustration set, none of these draw a height as a numeral -
 * this app never renders text inside a Skia canvas (every digit anywhere
 * else in the app is plain `Text` layered over its board, not Skia
 * content), and adding a loaded font just for four tutorial diagrams
 * isn't worth the weight. Skyscrapers' own theme makes this easy: a
 * height already *is* a bar's height, so every diagram below draws
 * buildings as bars scaled to their value - the same visual idea the
 * game's name is built on - and a clue's "how many are visible" count as
 * small dots rather than a digit, matching the dot-badge idiom
 * `BinairoMechanicsIllustrations.tsx`'s own twin badge already uses for
 * "a count, not a value".
 */
export function renderTowersIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'fill':
      return <FillIllustration />;
    case 'unique':
      return <UniqueIllustration />;
    case 'visibility':
      return <VisibilityIllustration />;
    default:
      return <Group />;
  }
}

const CELL = 46;
const MAX_BAR = CELL * 0.62;

/** A flat shared grid background, matching the real board's own single
 * continuous panel (`TowersBoard.tsx`'s outer `View`) rather than
 * separately-tiled cells. */
function illustrationGrid(x: number, y: number, cols: number, rows: number, cellSize: number): React.JSX.Element {
  const w = cols * cellSize;
  const h = rows * cellSize;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={w} height={h} r={8} color={theme.colors.surfaceHi} />
      {Array.from({ length: cols - 1 }, (_v, i) => i + 1).map(i => (
        <Path key={`v-${i}`} path={`M ${x + i * cellSize} ${y} L ${x + i * cellSize} ${y + h}`} color={theme.colors.border} style="stroke" strokeWidth={1} />
      ))}
      <RoundedRect x={x} y={y} width={w} height={h} r={8} color={theme.colors.borderStrong} style="stroke" strokeWidth={2} />
    </Group>
  );
}

/** One building: a flat bar rising from the cell's own floor, scaled to
 * `height` out of `maxHeight` - the same "height is the value" idea
 * every slide in this file leans on. */
function buildingBar(cx: number, floorY: number, width: number, height: number, maxHeight: number, color: string): React.JSX.Element {
  const h = Math.max(4, (height / maxHeight) * MAX_BAR);
  return <RoundedRect x={cx - width / 2} y={floorY - h} width={width} height={h} r={Math.min(3, width * 0.2)} color={color} />;
}

/** The same small checkmark `TentsMechanicsIllustrations.tsx`'s own
 * `CountsIllustration` pops in once a line's clue is satisfied. */
function checkmark(cx: number, cy: number, size: number): React.JSX.Element {
  return (
    <Path
      path={`M ${cx - size * 0.32} ${cy} L ${cx - size * 0.08} ${cy + size * 0.28} L ${cx + size * 0.34} ${cy - size * 0.3}`}
      color={theme.colors.success}
      style="stroke"
      strokeWidth={3}
      strokeCap="round"
      strokeJoin="round"
    />
  );
}

function FillIllustration(): React.JSX.Element {
  const rowWidth = CELL * 3;
  const startX = (ILLUSTRATION_WIDTH - rowWidth) / 2;
  const rowY = 20;
  const floorY = rowY + CELL;
  const selectedCx = startX + CELL + CELL / 2;

  const keySize = 30;
  const keyGap = 8;
  const keyRowWidth = keySize * 3 + keyGap * 2;
  const keyStartX = (ILLUSTRATION_WIDTH - keyRowWidth) / 2;
  const keyY = ILLUSTRATION_HEIGHT - keySize - 6;
  const keyCx = (i: number): number => keyStartX + i * (keySize + keyGap) + keySize / 2;

  return (
    <Group>
      {/* A selected cell, tinted the same way the real board tints one -
          already holding the height the keypad below just entered. */}
      <RoundedRect x={startX + CELL} y={rowY} width={CELL} height={CELL} color={theme.colors.surfaceAlt} />
      {illustrationGrid(startX, rowY, 3, 1, CELL)}
      {buildingBar(selectedCx, floorY - 4, CELL * 0.4, 2, 3, theme.colors.towersAccent)}

      {/* The keypad: one key per height, the middle one linked up to the
          selected cell by a short connecting line. */}
      <Path
        path={`M ${keyCx(1)} ${keyY} L ${selectedCx} ${floorY + 6}`}
        color={theme.colors.textTertiary}
        style="stroke"
        strokeWidth={1.4}
        strokeCap="round"
      />
      {[1, 2, 3].map((value, i) => (
        <Group key={value}>
          <RoundedRect x={keyCx(i) - keySize / 2} y={keyY} width={keySize} height={keySize} r={6} color={theme.colors.surface} />
          <RoundedRect x={keyCx(i) - keySize / 2} y={keyY} width={keySize} height={keySize} r={6} color={theme.colors.border} style="stroke" strokeWidth={1} />
          {buildingBar(keyCx(i), keyY + keySize - 6, keySize * 0.32, value, 3, theme.colors.towersAccent)}
        </Group>
      ))}
    </Group>
  );
}

function UniqueIllustration(): React.JSX.Element {
  const rowWidth = CELL * 3;
  const checkGap = 24;
  const checkSize = 22;
  const totalWidth = rowWidth + checkGap + checkSize;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - CELL) / 2;
  const floorY = y + CELL;
  const heights = [2, 1, 3];

  return (
    <Group>
      {illustrationGrid(startX, y, 3, 1, CELL)}
      {heights.map((h, i) => (
        <Group key={i}>{buildingBar(startX + i * CELL + CELL / 2, floorY - 4, CELL * 0.4, h, 3, theme.colors.towersAccent)}</Group>
      ))}
      {checkmark(startX + rowWidth + checkGap + checkSize / 2, y + CELL / 2, checkSize)}
    </Group>
  );
}

function VisibilityIllustration(): React.JSX.Element {
  const rowWidth = CELL * 3;
  const clueWidth = 44;
  const gap = 14;
  const totalWidth = clueWidth + gap + rowWidth;
  const gridStartX = (ILLUSTRATION_WIDTH - totalWidth) / 2 + clueWidth + gap;
  const y = (ILLUSTRATION_HEIGHT - CELL) / 2;
  const floorY = y + CELL;
  const cy = y + CELL / 2;
  // Viewed left-to-right: height 1 is visible, height 3 is visible (taller
  // than anything before it), height 2 is hidden behind the 3 - so this
  // side's clue is 2, matching the two dots drawn beside the arrow.
  const heights = [1, 3, 2];
  const arrowStartX = gridStartX - gap - clueWidth;

  return (
    <Group>
      {/* The clue cluster: an arrow pointing into the row, then one dot
          per tower actually visible from this side - a count, not a
          height, so it borrows the dot-badge idiom rather than another
          bar. */}
      <Path
        path={`M ${arrowStartX} ${cy} L ${arrowStartX + 16} ${cy} M ${arrowStartX + 9} ${cy - 6} L ${arrowStartX + 16} ${cy} L ${arrowStartX + 9} ${cy + 6}`}
        color={theme.colors.textSecondary}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
        strokeJoin="round"
      />
      {[0, 1].map(i => (
        <Group key={i}>
          <RoundedRect x={arrowStartX + 24 + i * 11} y={cy - 3} width={6} height={6} r={3} color={theme.colors.towersAccent} />
        </Group>
      ))}
      {illustrationGrid(gridStartX, y, 3, 1, CELL)}
      {heights.map((h, i) => (
        <Group key={i}>{buildingBar(gridStartX + i * CELL + CELL / 2, floorY - 4, CELL * 0.4, h, 3, theme.colors.towersAccent)}</Group>
      ))}
    </Group>
  );
}

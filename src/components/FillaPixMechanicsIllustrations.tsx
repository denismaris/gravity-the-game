import React from 'react';
import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Fill-a-Pix's own `MechanicsCarousel` illustrations, one per
 * `TutorialSlide.illustration` key (see `FILLAPIX_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`), drawn with the same tile look the real board
 * uses (`FillaPixBoardView`'s paper/accent-wash tiles).
 *
 * A carousel slide renders inside a bare `<Canvas>` (see
 * `MechanicsCarousel.tsx`), and this app bundles no Skia font - the real
 * board's own numerals are a React Native text layer laid over the
 * canvas, which a tutorial illustration has no access to. `renderDigit`
 * below draws a digit as hand-plotted strokes instead (a seven-segment
 * shape, rounded at the joints), the same idea this app's own hand-drawn
 * icons already use in place of a font (the header's "?", the
 * Undo/Restart arrows) - so the "numbers count neighbours" slide can
 * finally show an actual number rather than gesture at one.
 */

const CELL = 40;
const GAP = 5;
const GRID = 3;
const GRID_X = (ILLUSTRATION_WIDTH - GRID * CELL) / 2;
const GRID_Y = (ILLUSTRATION_HEIGHT - GRID * CELL) / 2;

function tileOrigin(row: number, col: number): { x: number; y: number } {
  return { x: GRID_X + col * CELL + GAP, y: GRID_Y + row * CELL + GAP };
}

function Tile({ row, col, filled }: { row: number; col: number; filled: boolean }): React.JSX.Element {
  const { x, y } = tileOrigin(row, col);
  const size = CELL - GAP * 2;
  return (
    <RoundedRect
      x={x}
      y={y}
      width={size}
      height={size}
      r={size * 0.24}
      color={filled ? theme.colors.fillapixAccent : theme.colors.surfaceHi}
      style={filled ? 'fill' : 'stroke'}
      strokeWidth={1}
    />
  );
}

/** Which of a seven-segment digit's 7 strokes are lit, per digit 0-9 -
 * the same layout an LCD clock uses, just drawn with soft rounded caps
 * instead of hard corners so it reads as hand-drawn rather than
 * electronic. */
const DIGIT_SEGMENTS: Record<string, ReadonlyArray<'top' | 'topLeft' | 'topRight' | 'middle' | 'bottomLeft' | 'bottomRight' | 'bottom'>> = {
  '0': ['top', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'bottom'],
  '1': ['topRight', 'bottomRight'],
  '2': ['top', 'topRight', 'middle', 'bottomLeft', 'bottom'],
  '3': ['top', 'topRight', 'middle', 'bottomRight', 'bottom'],
  '4': ['topLeft', 'topRight', 'middle', 'bottomRight'],
  '5': ['top', 'topLeft', 'middle', 'bottomRight', 'bottom'],
  '6': ['top', 'topLeft', 'middle', 'bottomLeft', 'bottomRight', 'bottom'],
  '7': ['top', 'topRight', 'bottomRight'],
  '8': ['top', 'topLeft', 'topRight', 'middle', 'bottomLeft', 'bottomRight', 'bottom'],
  '9': ['top', 'topLeft', 'topRight', 'middle', 'bottomRight', 'bottom'],
};

function renderDigit(digit: string, cx: number, cy: number, w: number, h: number, color: string): React.JSX.Element {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const yMid = cy;
  const y1 = cy + h / 2;
  const segmentPath: Record<string, string> = {
    top: `M ${x0} ${y0} L ${x1} ${y0}`,
    topLeft: `M ${x0} ${y0} L ${x0} ${yMid}`,
    topRight: `M ${x1} ${y0} L ${x1} ${yMid}`,
    middle: `M ${x0} ${yMid} L ${x1} ${yMid}`,
    bottomLeft: `M ${x0} ${yMid} L ${x0} ${y1}`,
    bottomRight: `M ${x1} ${yMid} L ${x1} ${y1}`,
    bottom: `M ${x0} ${y1} L ${x1} ${y1}`,
  };
  const strokeWidth = Math.max(2, w * 0.22);
  return (
    <Group>
      {(DIGIT_SEGMENTS[digit] ?? []).map(segment => (
        <Path key={segment} path={segmentPath[segment]} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
      ))}
    </Group>
  );
}

/** A small plaque behind a digit, matching the real board's own
 * clue-legibility fix (`FillaPixBoardView`'s plaque) - the digit needs to
 * read clearly over a filled, fairly dark tile. */
function ClueTile({ row, col, digit, filled = false }: { row: number; col: number; digit: string; filled?: boolean }): React.JSX.Element {
  const { x, y } = tileOrigin(row, col);
  const size = CELL - GAP * 2;
  return (
    <Group>
      <Tile row={row} col={col} filled={filled} />
      <RoundedRect x={x} y={y} width={size} height={size} r={size * 0.24} color={theme.colors.fillapixAccent} style="stroke" strokeWidth={2} />
      {renderDigit(
        digit,
        x + size / 2,
        y + size / 2,
        size * 0.42,
        size * 0.56,
        filled ? theme.colors.surfaceHi : theme.colors.fillapixAccent,
      )}
    </Group>
  );
}

/**
 * "Paint the hidden picture" - the plus shape (this game's own first,
 * simplest puzzle - see `FIRST_PUZZLE_REVEAL_ALL` in `src/game/fillapix/
 * puzzles.ts`) with every cell filled but one, that one cell rung to
 * invite a tap - "this is the action, and this is what it builds."
 */
function GoalIllustration(): React.JSX.Element {
  const plus = ['..#..', '..#..', '#####', '..#..', '..#..'];
  const size = 5;
  const cell = 22;
  const gap = 3;
  const gridX = (ILLUSTRATION_WIDTH - size * cell) / 2;
  const gridY = (ILLUSTRATION_HEIGHT - size * cell) / 2;
  const missing = { row: 4, col: 2 };
  return (
    <Group>
      {plus.map((rowStr, row) =>
        rowStr.split('').map((ch, col) => {
          const isMissing = row === missing.row && col === missing.col;
          const filled = ch === '#' && !isMissing;
          const x = gridX + col * cell + gap;
          const y = gridY + row * cell + gap;
          const s = cell - gap * 2;
          return (
            <Group key={`${row}-${col}`}>
              <RoundedRect
                x={x}
                y={y}
                width={s}
                height={s}
                r={s * 0.26}
                color={filled ? theme.colors.fillapixAccent : theme.colors.surfaceHi}
                style={filled ? 'fill' : 'stroke'}
                strokeWidth={1}
              />
              {isMissing && <Circle cx={x + s / 2} cy={y + s / 2} r={s * 0.22} color={theme.colors.fillapixAccent} style="stroke" strokeWidth={2} />}
            </Group>
          );
        }),
      )}
    </Group>
  );
}

/**
 * "A number counts its own 3x3" - a real digit, on a *filled* square.
 *
 * The centre clue reads 6: five of its neighbours are filled, and so is
 * the square the number itself sits on. Drawing the clue cell as filled
 * is the entire point of this slide - the previous version drew it as a
 * hole in the middle of the block, which was an accurate picture of the
 * rule the game used to have and is now precisely backwards. The filled
 * neighbours are a deliberate mix of orthogonal and diagonal, so the
 * illustration still proves corners count rather than asserting it.
 */
function ClueIllustration(): React.JSX.Element {
  const filled = new Set(['0:0', '0:1', '0:2', '1:0', '2:2']);
  return (
    <Group>
      {Array.from({ length: GRID }).map((_, row) =>
        Array.from({ length: GRID }).map((__, col) =>
          row === 1 && col === 1 ? null : <Tile key={`${row}-${col}`} row={row} col={col} filled={filled.has(`${row}:${col}`)} />,
        ),
      )}
      <ClueTile row={1} col={1} digit="6" filled />
    </Group>
  );
}

/** "Match every clue to solve it" - the completed picture, the same plus
 * shape the player is about to actually meet as their first puzzle. */
function RevealIllustration(): React.JSX.Element {
  const plus = ['..#..', '..#..', '#####', '..#..', '..#..'];
  const size = 5;
  const cell = 24;
  const gridX = (ILLUSTRATION_WIDTH - size * cell) / 2;
  const gridY = (ILLUSTRATION_HEIGHT - size * cell) / 2;
  const gap = 3;
  return (
    <Group>
      {plus.map((rowStr, row) =>
        rowStr.split('').map((ch, col) => (
          <RoundedRect
            key={`${row}-${col}`}
            x={gridX + col * cell + gap}
            y={gridY + row * cell + gap}
            width={cell - gap * 2}
            height={cell - gap * 2}
            r={(cell - gap * 2) * 0.26}
            color={ch === '#' ? theme.colors.fillapixAccent : theme.colors.surfaceHi}
            style={ch === '#' ? 'fill' : 'stroke'}
            strokeWidth={1}
          />
        )),
      )}
    </Group>
  );
}

export function renderFillaPixIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'goal':
      return <GoalIllustration />;
    case 'clue':
      return <ClueIllustration />;
    case 'reveal':
      return <RevealIllustration />;
    default:
      return <Group />;
  }
}

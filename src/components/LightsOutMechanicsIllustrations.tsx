import React from 'react';
import { Circle, Group, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Lights Out's own `MechanicsCarousel` illustrations, one per
 * `TutorialSlide.illustration` key (see `LIGHTSOUT_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`), drawn with the same night panel and amber
 * lamps the real board uses.
 *
 * The middle slide is the one that matters: "its neighbours toggle too"
 * is the whole game, and it is also the rule a player will otherwise
 * discover by accident and misread as a bug. So that slide doesn't
 * describe the cross - it draws it, with the pressed lamp ringed and its
 * four orthogonal neighbours lit, and the diagonals conspicuously dark.
 */

const CELL = 34;
const GAP = 4;
const GRID = 3;
const GRID_X = (ILLUSTRATION_WIDTH - GRID * CELL) / 2;
const GRID_Y = (ILLUSTRATION_HEIGHT - GRID * CELL) / 2;

function panel(x: number, y: number, w: number, h: number): React.JSX.Element {
  return <RoundedRect x={x} y={y} width={w} height={h} r={10} color={theme.colors.lightsOutPanel} />;
}

function tileOrigin(row: number, col: number): { x: number; y: number } {
  return { x: GRID_X + col * CELL + GAP, y: GRID_Y + row * CELL + GAP };
}

function Lamp({ row, col, lit, ringed }: { row: number; col: number; lit: boolean; ringed?: boolean }): React.JSX.Element {
  const { x, y } = tileOrigin(row, col);
  const size = CELL - GAP * 2;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size * 0.3;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={size} height={size} r={size * 0.22} color={theme.colors.lightsOutPanelCell} />
      <RoundedRect x={x} y={y} width={size} height={size} r={size * 0.22} color={theme.colors.lightsOutPanelEdge} style="stroke" strokeWidth={1} />
      {/* A real radial falloff, matching the board's own lamps - a flat
          translucent amber disc over indigo reads as a brown smudge
          rather than a glow (see `LightsOutBoardView`'s `renderLamp`). */}
      {lit && (
        <Circle cx={cx} cy={cy} r={radius * 1.9}>
          <RadialGradient c={vec(cx, cy)} r={radius * 1.9} colors={['rgba(245, 201, 94, 0.5)', 'rgba(245, 201, 94, 0)']} />
        </Circle>
      )}
      <Circle cx={cx} cy={cy} r={radius} color={lit ? theme.colors.lightsOutLit : theme.colors.lightsOutDim} />
      {lit && <Circle cx={cx} cy={cy} r={radius * 0.42} color={theme.colors.lightsOutLitCore} />}
      {ringed && (
        <RoundedRect x={x - 2} y={y - 2} width={size + 4} height={size + 4} r={size * 0.22 + 2} color={theme.colors.accent} style="stroke" strokeWidth={2} />
      )}
    </Group>
  );
}

function grid(cells: (row: number, col: number) => { lit: boolean; ringed?: boolean }): React.JSX.Element {
  return (
    <Group>
      {panel(GRID_X - 6, GRID_Y - 6, GRID * CELL + 12, GRID * CELL + 12)}
      {Array.from({ length: GRID }).map((_, row) =>
        Array.from({ length: GRID }).map((__, col) => {
          const { lit, ringed } = cells(row, col);
          return <Lamp key={`${row}-${col}`} row={row} col={col} lit={lit} ringed={ringed} />;
        }),
      )}
    </Group>
  );
}

/** "Tap lights to toggle them" - one lamp ringed and lit among dark ones,
 * with a tap mark on it. */
function TapIllustration(): React.JSX.Element {
  const { x, y } = tileOrigin(1, 1);
  const size = CELL - GAP * 2;
  return (
    <Group>
      {grid((row, col) => ({ lit: row === 1 && col === 1, ringed: row === 1 && col === 1 }))}
      {/* A small tap arc under the pressed lamp - the same hand-drawn
          stroke vocabulary this app's own icons use. */}
      <Path
        path={`M ${x + size * 0.2} ${y + size + 10} Q ${x + size / 2} ${y + size + 18} ${x + size * 0.8} ${y + size + 10}`}
        color={theme.colors.accent}
        style="stroke"
        strokeWidth={2}
        strokeCap="round"
      />
    </Group>
  );
}

/** "Its neighbours toggle too" - the cross, drawn. The four diagonals
 * stay dark on purpose: that contrast *is* the rule. */
function CrossIllustration(): React.JSX.Element {
  const isCross = (row: number, col: number): boolean => Math.abs(row - 1) + Math.abs(col - 1) <= 1;
  return grid((row, col) => ({ lit: isCross(row, col), ringed: row === 1 && col === 1 }));
}

/** "Turn all lights off to win" - a board already dark. */
function DarkIllustration(): React.JSX.Element {
  return grid(() => ({ lit: false }));
}

export function renderLightsOutIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'tap':
      return <TapIllustration />;
    case 'cross':
      return <CrossIllustration />;
    case 'dark':
      return <DarkIllustration />;
    default:
      return <Group />;
  }
}

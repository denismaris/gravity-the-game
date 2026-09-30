import React from 'react';
import { Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { Cord, Token } from './ArukoneBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { shade } from '../game/rendering';
import { theme } from '../theme';

/**
 * Arukone+'s own `MechanicsCarousel` illustrations, one per
 * `TutorialSlide.illustration` key (see `ARUKONE_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`), drawn with the board's own `Cord` and `Token`
 * so a slide's path is the same cord the player will actually drag out.
 *
 * No numbers in the tokens: a carousel slide is drawn inside a `<Canvas>`,
 * this app bundles no Skia font, and the real board gets its digits from
 * a React Native text layer that cannot reach in here. The tokens still
 * read as "the two ends of a path", which is the whole job on this slide -
 * and inventing a hand-drawn digit outline just for the tutorial would
 * put a glyph on screen that appears nowhere in the game.
 */

const CELL = 26;
const COLS = 5;
const ROWS = 4;
const GRID_X = (ILLUSTRATION_WIDTH - COLS * CELL) / 2;
const GRID_Y = (ILLUSTRATION_HEIGHT - ROWS * CELL) / 2;

const toneA = (): string => theme.colors.arukoneAccent;
const toneB = (): string => shade(theme.colors.arukoneAccent, 1.46);

function center(row: number, col: number): { x: number; y: number } {
  return { x: GRID_X + col * CELL + CELL / 2, y: GRID_Y + row * CELL + CELL / 2 };
}

function line(cells: ReadonlyArray<readonly [number, number]>): string {
  return cells
    .map(([row, col], i) => {
      const p = center(row, col);
      return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    })
    .join(' ');
}

/** The same ruled paper the real board uses, at slide scale. */
function Grid(): React.JSX.Element {
  const tiles: React.JSX.Element[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      tiles.push(
        <RoundedRect
          key={`t-${row}-${col}`}
          x={GRID_X + col * CELL + 1}
          y={GRID_Y + row * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          r={4}
          color={theme.colors.surfaceHi}
        />,
      );
    }
  }
  return (
    <Group>
      <RoundedRect
        x={GRID_X - 3}
        y={GRID_Y - 3}
        width={COLS * CELL + 6}
        height={ROWS * CELL + 6}
        r={8}
        color={theme.colors.surface}
      />
      {tiles}
    </Group>
  );
}

function Obstacle({ row, col }: { row: number; col: number }): React.JSX.Element {
  return (
    <Group>
      <RoundedRect
        x={GRID_X + col * CELL + 3}
        y={GRID_Y + row * CELL + 3}
        width={CELL - 6}
        height={CELL - 6}
        r={4}
        color={theme.colors.arukoneObstacle}
      />
      <RoundedRect
        x={GRID_X + col * CELL + 3}
        y={GRID_Y + row * CELL + 3}
        width={CELL - 6}
        height={(CELL - 6) * 0.42}
        r={4}
        color={theme.colors.arukoneObstacleEdge}
        opacity={0.55}
      />
    </Group>
  );
}

/** The fold the board is symmetric about, down the middle column. */
function Fold(): React.JSX.Element {
  const x = GRID_X + (COLS * CELL) / 2;
  return (
    <Path
      path={`M ${x} ${GRID_Y - 2} L ${x} ${GRID_Y + ROWS * CELL + 2}`}
      color={theme.colors.arukoneFold}
      style="stroke"
      strokeWidth={1.5}
      strokeCap="round"
    />
  );
}

export function renderArukoneIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'connect':
      return <ConnectIllustration />;
    case 'symmetry':
      return <SymmetryIllustration />;
    case 'crossing':
      return <CrossingIllustration />;
    default:
      return <Group />;
  }
}

/** One pair, one cord between them - the plainest statement of the verb. */
function ConnectIllustration(): React.JSX.Element {
  const run = [
    [0, 1],
    [1, 1],
    [2, 1],
    [2, 2],
    [2, 3],
  ] as const;
  return (
    <Group>
      <Grid />
      <Cord path={line(run)} tone={toneA()} width={CELL * 0.3} faded={false} />
      <Token center={center(0, 1)} radius={CELL * 0.3} tone={toneA()} joined />
      <Token center={center(2, 3)} radius={CELL * 0.3} tone={toneA()} joined />
    </Group>
  );
}

/** The drawn half solid and the mirrored half faded, either side of the
 * fold - the slide has to show the far side arriving on its own, since
 * that is the moment the copy is explaining. */
function SymmetryIllustration(): React.JSX.Element {
  const drawn = [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ] as const;
  // The same run reflected about the middle column (col -> 4 - col).
  const mirrored = drawn.map(([row, col]) => [row, COLS - 1 - col] as const);
  return (
    <Group>
      <Grid />
      <Fold />
      <Obstacle row={3} col={2} />
      <Cord path={line(mirrored)} tone={toneA()} width={CELL * 0.3} faded />
      <Cord path={line(drawn)} tone={toneA()} width={CELL * 0.3} faded={false} />
      <Token center={center(0, 0)} radius={CELL * 0.3} tone={toneA()} joined />
      <Token center={center(2, 1)} radius={CELL * 0.3} tone={toneA()} joined />
      <Token center={center(0, COLS - 1)} radius={CELL * 0.3} tone={toneA()} joined={false} />
      <Token center={center(2, COLS - 1 - 1)} radius={CELL * 0.3} tone={toneA()} joined={false} />
    </Group>
  );
}

/** Two pairs sharing a board and giving each other room - what "without
 * crossing" looks like once it has gone right, rather than a red cross
 * over a mistake. */
function CrossingIllustration(): React.JSX.Element {
  const first = [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 3],
  ] as const;
  const second = [
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 2],
    [3, 3],
  ] as const;
  return (
    <Group>
      <Grid />
      <Cord path={line(first)} tone={toneA()} width={CELL * 0.3} faded={false} />
      <Cord path={line(second)} tone={toneB()} width={CELL * 0.3} faded={false} />
      <Token center={center(0, 0)} radius={CELL * 0.3} tone={toneA()} joined />
      <Token center={center(1, 3)} radius={CELL * 0.3} tone={toneA()} joined />
      <Token center={center(2, 0)} radius={CELL * 0.3} tone={toneB()} joined />
      <Token center={center(3, 3)} radius={CELL * 0.3} tone={toneB()} joined />
    </Group>
  );
}

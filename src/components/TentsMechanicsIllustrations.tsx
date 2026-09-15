import React from 'react';
import { Group, Path, RoundedRect } from '@shopify/react-native-skia';
import {
  CANOPY_COLOR,
  CANOPY_OUTLINE,
  MARK_COLOR,
  TENT_DARK,
  TENT_DOOR_COLOR,
  TENT_LIGHT,
  TRUNK_COLOR,
  canopyPath,
  guyLinePath,
  tentDoorPath,
  tentGeometry,
  tentLeftFacePath,
  tentRightFacePath,
  trunkPath,
} from './TentsBoardView';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Tents and Trees' own `MechanicsCarousel` illustrations, one function
 * per `TutorialSlide.illustration` key (see `TENTS_MECHANICS_SLIDES` in
 * `src/game/tutorials.ts`). Every tree/tent/mark is drawn with the real
 * board's own geometry functions (`tentGeometry`, `canopyPath`, ...) at
 * rest (no animation - a still teaching diagram doesn't need the real
 * board's own pitch-in/shake/glow), so a slide's tent is the same
 * silhouette a player will actually see, not a separately maintained
 * illustration asset that can drift from the real thing.
 */
export function renderTentsIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'cycle':
      return <CycleIllustration />;
    case 'adjacency':
      return <AdjacencyIllustration />;
    case 'touching':
      return <TouchingIllustration />;
    case 'counts':
      return <CountsIllustration />;
    default:
      return <Group />;
  }
}

/** A shared flat grid background (surface + border + hairlines) behind
 * every illustration - matching the real board's own "one shared grid,
 * not individually raised tiles" language (`TentsBoardView.tsx`'s own
 * "Hairline grid" comment), rather than Binairo's separately-tiled look. */
function illustrationGrid(x: number, y: number, cols: number, rows: number, cellSize: number): React.JSX.Element {
  const w = cols * cellSize;
  const h = rows * cellSize;
  return (
    <Group>
      <RoundedRect x={x} y={y} width={w} height={h} r={6} color={theme.colors.surfaceHi} />
      {Array.from({ length: cols - 1 }, (_v, i) => i + 1).map(i => (
        <Path key={`v-${i}`} path={`M ${x + i * cellSize} ${y} L ${x + i * cellSize} ${y + h}`} color={theme.colors.border} style="stroke" strokeWidth={1} />
      ))}
      {Array.from({ length: rows - 1 }, (_v, i) => i + 1).map(i => (
        <Path key={`h-${i}`} path={`M ${x} ${y + i * cellSize} L ${x + w} ${y + i * cellSize}`} color={theme.colors.border} style="stroke" strokeWidth={1} />
      ))}
      <RoundedRect x={x} y={y} width={w} height={h} r={6} color={theme.colors.border} style="stroke" strokeWidth={1} />
    </Group>
  );
}

/** One tree, drawn at rest (no firefly, no shadow-offset animation - see
 * this file's own doc comment for why a still diagram skips those). */
function illustrationTree(cx: number, cy: number, cellSize: number): React.JSX.Element {
  const canopyY = cy - cellSize * 0.1;
  const trunkTopY = canopyY + cellSize * 0.12;
  return (
    <Group>
      <Path path={canopyPath(cx, canopyY, cellSize)} color={CANOPY_COLOR} />
      <Path path={canopyPath(cx, canopyY, cellSize)} color={CANOPY_OUTLINE} style="stroke" strokeWidth={Math.max(1, cellSize * 0.012)} />
      <Path path={trunkPath(cx, trunkTopY, cellSize)} color={TRUNK_COLOR} />
    </Group>
  );
}

/** One tent, drawn at rest - `danger` when `violated`, matching the real
 * board's own collapsed-red treatment for a touching-tents violation. */
function illustrationTent(cx: number, baseY: number, cellSize: number, violated: boolean): React.JSX.Element {
  const g = tentGeometry(cx, baseY, cellSize);
  return (
    <Group>
      <Path path={guyLinePath(cx, baseY, cellSize)} color={violated ? theme.colors.danger : TENT_DARK} style="stroke" strokeWidth={1.5} />
      {violated ? (
        <Path path={`${tentLeftFacePath(g)} ${tentRightFacePath(g)}`} color={theme.colors.danger} />
      ) : (
        <>
          <Path path={tentLeftFacePath(g)} color={TENT_DARK} />
          <Path path={tentRightFacePath(g)} color={TENT_LIGHT} />
          <Path path={tentDoorPath(g)} color={TENT_DOOR_COLOR} />
        </>
      )}
    </Group>
  );
}

/** The "definitely not a tent" pencil mark, matching `TentsBoardView`'s
 * own `MARK_COLOR`/proportions exactly. */
function illustrationMark(cx: number, cy: number, cellSize: number): React.JSX.Element {
  const d = cellSize * 0.16;
  return (
    <Path
      path={`M ${cx - d} ${cy - d} L ${cx + d} ${cy + d} M ${cx + d} ${cy - d} L ${cx - d} ${cy + d}`}
      color={MARK_COLOR}
      style="stroke"
      strokeWidth={Math.max(1, cellSize * 0.045)}
      strokeCap="round"
    />
  );
}

const CYCLE_CELL = 64;
const CYCLE_GAP = 12;

function CycleIllustration(): React.JSX.Element {
  const totalWidth = CYCLE_CELL * 3 + CYCLE_GAP * 2;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - CYCLE_CELL) / 2;
  const cellX = (i: number): number => startX + i * (CYCLE_CELL + CYCLE_GAP);
  return (
    <Group>
      {[0, 1, 2].map(i => (
        <Group key={`cell-${i}`}>{illustrationGrid(cellX(i), y, 1, 1, CYCLE_CELL)}</Group>
      ))}
      {illustrationTent(cellX(1) + CYCLE_CELL / 2, y + CYCLE_CELL * 0.72, CYCLE_CELL, false)}
      {illustrationMark(cellX(2) + CYCLE_CELL / 2, y + CYCLE_CELL / 2, CYCLE_CELL)}
    </Group>
  );
}

const ADJ_CELL = 56;

function AdjacencyIllustration(): React.JSX.Element {
  const totalWidth = ADJ_CELL * 3;
  const totalHeight = ADJ_CELL * 2;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const startY = (ILLUSTRATION_HEIGHT - totalHeight) / 2;
  const colCx = (col: number): number => startX + col * ADJ_CELL + ADJ_CELL / 2;
  const rowCy = (row: number): number => startY + row * ADJ_CELL + ADJ_CELL / 2;
  return (
    <Group>
      {illustrationGrid(startX, startY, 3, 2, ADJ_CELL)}
      {illustrationTent(colCx(1), startY + ADJ_CELL * 0.72, ADJ_CELL, false)}
      {illustrationTree(colCx(1), rowCy(1), ADJ_CELL)}
    </Group>
  );
}

const TOUCH_CELL = 60;

function TouchingIllustration(): React.JSX.Element {
  const totalSize = TOUCH_CELL * 2;
  const startX = (ILLUSTRATION_WIDTH - totalSize) / 2;
  const startY = (ILLUSTRATION_HEIGHT - totalSize) / 2;
  return (
    <Group>
      {illustrationGrid(startX, startY, 2, 2, TOUCH_CELL)}
      {illustrationTent(startX + TOUCH_CELL / 2, startY + TOUCH_CELL * 0.72, TOUCH_CELL, true)}
      {illustrationTent(startX + TOUCH_CELL * 1.5, startY + TOUCH_CELL * 1.72, TOUCH_CELL, true)}
    </Group>
  );
}

const COUNT_CELL = 48;
const COUNT_GAP_TO_CHECK = 26;

function CountsIllustration(): React.JSX.Element {
  const cells: Array<'tent' | 'empty'> = ['tent', 'empty', 'tent', 'empty'];
  const rowWidth = COUNT_CELL * cells.length;
  const checkSize = 20;
  const totalWidth = rowWidth + COUNT_GAP_TO_CHECK + checkSize;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - COUNT_CELL) / 2;
  const checkCx = startX + rowWidth + COUNT_GAP_TO_CHECK + checkSize / 2;
  const checkCy = y + COUNT_CELL / 2;
  return (
    <Group>
      {illustrationGrid(startX, y, cells.length, 1, COUNT_CELL)}
      {cells.map((kind, i) => {
        const cx = startX + i * COUNT_CELL + COUNT_CELL / 2;
        return kind === 'tent' ? <Group key={i}>{illustrationTent(cx, y + COUNT_CELL * 0.72, COUNT_CELL, false)}</Group> : null;
      })}
      {/* The row's own clue is satisfied - a checkmark, the same glyph
          idiom `AnimatedClue` (`TentsBoard.tsx`) pops in with once a real
          row/column count is met. */}
      <Path
        path={`M ${checkCx - checkSize * 0.32} ${checkCy} L ${checkCx - checkSize * 0.08} ${checkCy + checkSize * 0.28} L ${checkCx + checkSize * 0.34} ${checkCy - checkSize * 0.3}`}
        color={theme.colors.success}
        style="stroke"
        strokeWidth={3}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}

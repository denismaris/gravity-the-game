import React from 'react';
import { Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { arrowPath, gemPath, MirrorMazeBoardView, renderMirror } from './MirrorMazeBoardView';
import { emptyMirrorMazeState, MirrorMazePuzzle, traceBeam } from '../game/mirror';
import { CellBackground, TargetMarker } from '../game/rendering';
import { ILLUSTRATION_HEIGHT, ILLUSTRATION_WIDTH } from './MechanicsCarousel';
import { theme } from '../theme';

/**
 * Mirror Maze's own `MechanicsCarousel` illustrations - see
 * `BinairoMechanicsIllustrations.tsx`'s own doc comment for the pattern.
 * Every cell/mirror/gem/beam below is drawn with the real board's own
 * colours and path functions (`mirrorPath`/`gemPath`/`arrowPath`,
 * exported from `MirrorMazeBoardView.tsx`), at rest - no idle shimmer, no
 * flourish spin, no speckle dust, the same "a still diagram doesn't need
 * the real board's own animation" choice `TentsMechanicsIllustrations.tsx`
 * makes for its own trees.
 */
export function renderMirrorMazeIllustration(kind: string): React.JSX.Element {
  switch (kind) {
    case 'place':
      return <PlaceIllustration />;
    case 'reflect':
      return <ReflectIllustration />;
    case 'gems':
      return <GemsIllustration />;
    case 'target':
      return <TargetIllustration />;
    case 'ruby':
      // Wrong way round, then right: the gem only lights after the glass.
      return <SideBySide left={RUBY_WRONG} right={RUBY} />;
    case 'splitter':
      return <RealBoard puzzle={SPLIT} />;
    default:
      return <Group />;
  }
}

/** Tiny boards for the later rules, drawn by the real board, already
 * lit. A beam through a ruby filter to a ruby gem; and a splitter sending
 * the beam up to the target and down through a gem. */
const fixture = (id: string, extra: Partial<MirrorMazePuzzle>): MirrorMazePuzzle => ({
  id,
  difficulty: 'easy',
  rows: 4,
  cols: 4,
  source: { row: 1, col: 0 },
  sourceDirection: 'right',
  target: { row: 1, col: 3 },
  gems: [],
  obstacles: [],
  ...extra,
});
const RUBY = fixture('mirror-illustration-ruby', { filters: [{ row: 1, col: 1 }], gems: [{ row: 1, col: 2 }], rubyGems: [0] });
const RUBY_WRONG = fixture('mirror-illustration-ruby-wrong', { filters: [{ row: 1, col: 2 }], gems: [{ row: 1, col: 1 }], rubyGems: [0] });

/** Two of the little boards side by side, a gap between. */
function SideBySide({ left, right }: { left: MirrorMazePuzzle; right: MirrorMazePuzzle }): React.JSX.Element {
  const size = Math.min(ILLUSTRATION_HEIGHT - 8, (ILLUSTRATION_WIDTH - 24) / 2);
  const gap = ILLUSTRATION_WIDTH - size * 2;
  return (
    <Group>
      {[left, right].map((puzzle, i) => {
        const state = emptyMirrorMazeState(puzzle);
        return (
          <Group key={puzzle.id} transform={[{ translateX: gap / 3 + i * (size + gap / 3) }, { translateY: (ILLUSTRATION_HEIGHT - size) / 2 }]}>
            <MirrorMazeBoardView puzzle={puzzle} state={state} size={size} path={traceBeam(puzzle, state)} revealProgress={0} solved={false} />
          </Group>
        );
      })}
    </Group>
  );
}
const SPLIT = fixture('mirror-illustration-split', { target: { row: 0, col: 2 }, splitters: [{ row: 1, col: 2 }], gems: [{ row: 3, col: 2 }] });

function RealBoard({ puzzle }: { puzzle: MirrorMazePuzzle }): React.JSX.Element {
  const size = ILLUSTRATION_HEIGHT - 8;
  const state = emptyMirrorMazeState(puzzle);
  return (
    <Group transform={[{ translateX: (ILLUSTRATION_WIDTH - size) / 2 }, { translateY: 4 }]}>
      <MirrorMazeBoardView puzzle={puzzle} state={state} size={size} path={traceBeam(puzzle, state)} revealProgress={0} solved={false} />
    </Group>
  );
}

const CELL = 52;

/** The dark ink panel every illustration sits on - matching the real
 * board's own single shared panel (`MirrorMazeBoardView`'s
 * `StaticMazeLayer`) rather than Binairo's separately-tiled look. */
function panel(x: number, y: number, width: number, height: number): React.JSX.Element {
  return <RoundedRect x={x} y={y} width={width} height={height} r={10} color={theme.colors.mirrorPanel} />;
}

function panelCell(x: number, y: number, flashed: boolean = false): React.JSX.Element {
  const inset = CELL * 0.06;
  return (
    <CellBackground
      x={x + inset}
      y={y + inset}
      size={CELL - inset * 2}
      fill={flashed ? theme.colors.accent : theme.colors.mirrorPanelCell}
      stroke={theme.colors.mirrorPanelEdge}
      cornerRadius={CELL * 0.14}
    />
  );
}

function PlaceIllustration(): React.JSX.Element {
  const gap = 12;
  const totalWidth = CELL * 3 + gap * 2;
  const panelPad = 10;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - CELL) / 2;
  const cellX = (i: number): number => startX + i * (CELL + gap);
  const halfLength = (CELL - CELL * 0.24 * 2) / 2;
  const strokeWidth = Math.max(2.5, CELL * 0.09);

  return (
    <Group>
      {panel(startX - panelPad, y - panelPad, totalWidth + panelPad * 2, CELL + panelPad * 2)}
      {[0, 1, 2].map(i => (
        <Group key={i}>{panelCell(cellX(i), y)}</Group>
      ))}
      {/* No mirror, then `/`, then `\` - the real tap cycle in `nextMirror`. */}
      {renderMirror('fwd', cellX(1) + CELL / 2, y + CELL / 2, halfLength, 'fwd', 0, 1, strokeWidth)}
      {renderMirror('back', cellX(2) + CELL / 2, y + CELL / 2, halfLength, 'back', 0, 1, strokeWidth)}
    </Group>
  );
}

/** A three-layer glow stroke - halo, mid, core - the same "light, not a
 * flat line" treatment the real beam uses, at a scale that reads clearly
 * inside the small illustration box. */
function beamGlow(path: string): React.JSX.Element {
  return (
    <Group>
      <Path path={path} color={theme.colors.mirrorBeamGlow} style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" opacity={0.22} />
      <Path path={path} color={theme.colors.mirrorBeamGlow} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" opacity={0.55} />
      <Path path={path} color={theme.colors.mirrorBeamCore} style="stroke" strokeWidth={1.6} strokeCap="round" strokeJoin="round" />
    </Group>
  );
}

function ReflectIllustration(): React.JSX.Element {
  const cols = 3;
  const rows = 2;
  const totalWidth = CELL * cols;
  const totalHeight = CELL * rows;
  const panelPad = 10;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const startY = (ILLUSTRATION_HEIGHT - totalHeight) / 2;
  const colX = (c: number): number => startX + c * CELL;
  const rowY = (r: number): number => startY + r * CELL;
  const entryCenter = { x: colX(0) + CELL / 2, y: rowY(0) + CELL / 2 };
  const bendCenter = { x: colX(1) + CELL / 2, y: rowY(0) + CELL / 2 };
  const exitCenter = { x: colX(1) + CELL / 2, y: rowY(1) + CELL / 2 };
  const halfLength = (CELL - CELL * 0.24 * 2) / 2;

  const beamPath = `M ${entryCenter.x - CELL * 0.3} ${entryCenter.y} L ${bendCenter.x} ${bendCenter.y} L ${exitCenter.x} ${exitCenter.y}`;

  return (
    <Group>
      {panel(startX - panelPad, startY - panelPad, totalWidth + panelPad * 2, totalHeight + panelPad * 2)}
      {[0, 1].map(r => [0, 1, 2].map(c => <Group key={`${r}-${c}`}>{panelCell(colX(c), rowY(r))}</Group>))}
      {beamGlow(beamPath)}
      <Path
        path={arrowPath(entryCenter.x - CELL * 0.3, entryCenter.y, CELL * 0.16, 'right')}
        color={theme.colors.background}
      />
      {renderMirror('bend', bendCenter.x, bendCenter.y, halfLength, 'back', 0, 1, Math.max(2.5, CELL * 0.09))}
    </Group>
  );
}

function GemsIllustration(): React.JSX.Element {
  const gap = 20;
  const totalWidth = CELL * 2 + gap;
  const panelPad = 10;
  const startX = (ILLUSTRATION_WIDTH - totalWidth) / 2;
  const y = (ILLUSTRATION_HEIGHT - CELL) / 2;
  const litCenter = { x: startX + CELL / 2, y: y + CELL / 2 };
  const dimCenter = { x: startX + CELL + gap + CELL / 2, y: y + CELL / 2 };
  const gemSize = CELL * 0.18;

  return (
    <Group>
      {panel(startX - panelPad, y - panelPad, totalWidth + panelPad * 2, CELL + panelPad * 2)}
      {panelCell(startX, y)}
      {panelCell(startX + CELL + gap, y)}
      <Path path={gemPath(litCenter.x, litCenter.y, gemSize * 1.1)} color={theme.colors.accent} />
      <Path path={gemPath(dimCenter.x, dimCenter.y, gemSize * 0.9)} color={theme.colors.mirrorGlass} opacity={0.55} />
    </Group>
  );
}

function TargetIllustration(): React.JSX.Element {
  const size = 80;
  const panelPad = 10;
  const x = (ILLUSTRATION_WIDTH - size) / 2;
  const y = (ILLUSTRATION_HEIGHT - size) / 2;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const beamPath = `M ${x - panelPad * 1.4} ${cy} L ${cx} ${cy}`;

  return (
    <Group>
      {panel(x - panelPad, y - panelPad, size + panelPad * 2, size + panelPad * 2)}
      {beamGlow(beamPath)}
      <TargetMarker cx={cx} cy={cy} radius={size * 0.3} color={theme.colors.accent} strokeWidth={Math.max(2, size * 0.07)} />
    </Group>
  );
}

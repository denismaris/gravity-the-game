import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Path, rect, RoundedRect, rrect, vec } from '@shopify/react-native-skia';
import {
  Direction,
  MirrorKind,
  MirrorMazeCell,
  MirrorMazePuzzle,
  MirrorMazeState,
  traceAll,
} from '../game/mirror';
import {
  BoardLayout,
  computeBoardLayout,
  DealClock, DealIn,
  dealDelay,
  getCellCenter,
  getCellOrigin,
  shade,
  useDealing,
  useReducedMotion,
} from '../game/rendering';
import { theme } from '../theme';
import { SkiaEntrance } from './SkiaEntrance';
import { cancelAnimation, Easing, SharedValue, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** How long a mirror takes to spin into place after a tap. */
const FLOURISH_MS = 260;
/** How long a gem's "collected" ring takes to expand and fade. */
const GEM_BURST_MS = 420;

const DIRECTION_VECTOR: Readonly<Record<Direction, { dRow: number; dCol: number }>> = {
  up: { dRow: -1, dCol: 0 },
  down: { dRow: 1, dCol: 0 },
  left: { dRow: 0, dCol: -1 },
  right: { dRow: 0, dCol: 1 },
};

/** The gap between two tiles, as a share of a square. */
const TILE_GAP_SHARE = 0.1;

/**
 * The board's squares, laid out inside a margin as wide as the gap
 * between two tiles - so the outer tiles sit as far from the frame as
 * they do from each other. The tap layer (`MirrorMazeBoard`) uses the
 * same numbers, which is what keeps a tap on the tile it lands on.
 */
export function mazeGrid(rows: number, size: number): { layout: BoardLayout; margin: number; outer: number } {
  const outer = Math.max(0, Math.floor(size));
  // margin + half a gap at the edge = one whole gap between tiles.
  const margin = rows > 0 ? (outer * TILE_GAP_SHARE * 0.5) / (rows + TILE_GAP_SHARE) : 0;
  return { layout: computeBoardLayout(rows, outer - margin * 2), margin, outer };
}

/** A stone's hatching: fine diagonals across its tile, the mark for a
 * square nothing can pass. Clipped to the tile by its caller. */
function hatch(x: number, y: number, size: number): string {
  const step = size / 6;
  const lines: string[] = [];
  for (let k = -size; k < size; k += step) {
    lines.push(`M ${x + k} ${y + size} L ${x + k + size} ${y}`);
  }
  return lines.join(' ');
}

function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function easeOutCubic(t: number): number {
  'worklet';
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

/** A solid arrowhead centred on (cx, cy), pointing `direction` - marks where
 * the beam enters the board and which way it starts moving. */
export function arrowPath(cx: number, cy: number, size: number, direction: Direction): string {
  const { dRow, dCol } = DIRECTION_VECTOR[direction];
  const perpRow = dCol;
  const perpCol = -dRow;
  const tip = { x: cx + dCol * size, y: cy + dRow * size };
  const base1 = { x: cx - dCol * size * 0.6 + perpCol * size * 0.7, y: cy - dRow * size * 0.6 + perpRow * size * 0.7 };
  const base2 = { x: cx - dCol * size * 0.6 - perpCol * size * 0.7, y: cy - dRow * size * 0.6 - perpRow * size * 0.7 };
  return `M ${tip.x} ${tip.y} L ${base1.x} ${base1.y} L ${base2.x} ${base2.y} Z`;
}

/**
 * A `/` or `\` mirror as a line through the cell centre, drawn at an
 * arbitrary angle and scale so a freshly-tapped mirror can spin into its
 * resting orientation. `/` rests at -45deg and `\` at +45deg (screen
 * coordinates, y growing downward), so a 90deg sweep is exactly the
 * rotation the player's tap just asked for.
 */
export function mirrorPath(cx: number, cy: number, halfLength: number, mirror: MirrorKind, extraRadians: number, scale: number): string {
  const angle = (mirror === 'fwd' ? -Math.PI / 4 : Math.PI / 4) + extraRadians;
  const dx = Math.cos(angle) * halfLength * scale;
  const dy = Math.sin(angle) * halfLength * scale;
  return `M ${cx - dx} ${cy - dy} L ${cx + dx} ${cy + dy}`;
}

/**
 * A placed mirror: a silver bar on a dark backing a hair below it - the
 * same small lip every tile and piece in the app stands on. Flat geometry
 * only (see this project's standing depth-vs-flat guidance).
 */
export function renderMirror(key: string, cx: number, cy: number, halfLength: number, mirror: MirrorKind, extraRadians: number, scale: number, strokeWidth: number): React.JSX.Element {
  const path = mirrorPath(cx, cy, halfLength, mirror, extraRadians, scale);
  const lip = mirrorPath(cx, cy + strokeWidth * 0.35, halfLength, mirror, extraRadians, scale);
  return (
    <Group key={key}>
      <Path path={lip} color={shade(theme.colors.mirrorGlass, 0.62)} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
      <Path path={path} color={theme.colors.mirrorGlass} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
    </Group>
  );
}

/** A small diamond marking a gem - distinct from the mirror's straight
 * diagonal, the target's ring and the obstacle's square. */
export function gemPath(cx: number, cy: number, size: number): string {
  'worklet';
  return `M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`;
}

/** A gem's table - the flat top facet - as a smaller diamond, nudged up
 * toward the light. */
export function gemTablePath(cx: number, cy: number, size: number): string {
  'worklet';
  return gemPath(cx, cy - size * 0.12, size * 0.46);
}

/** An open polyline through the centres of consecutive `cells`. Empty string
 * (nothing to draw) for fewer than two cells. */
function pathThroughCells(layout: BoardLayout, cells: ReadonlyArray<MirrorMazeCell>): string {
  return partialPathThroughCells(layout, cells, 1);
}

/**
 * The first `progress` (0..1) *fraction of the whole polyline* through
 * `cells`, interpolating partway along the final segment rather than
 * stopping at the last whole cell - which is what lets the ignition sweep
 * smoothly from source to target instead of jumping square to square.
 * Every segment is one cell long, so a global fraction maps onto segments
 * directly with no arc-length bookkeeping.
 */
function partialPathThroughCells(layout: BoardLayout, cells: ReadonlyArray<MirrorMazeCell>, progress: number): string {
  if (cells.length < 2 || progress <= 0) return '';

  const segments = cells.length - 1;
  const exact = Math.min(segments, progress * segments);
  const whole = Math.floor(exact);
  const fraction = exact - whole;

  const points: string[] = [];
  for (let i = 0; i <= whole && i < cells.length; i += 1) {
    const center = getCellCenter(layout, cells[i].row, cells[i].col);
    points.push(`${i === 0 ? 'M' : 'L'} ${center.x} ${center.y}`);
  }
  if (fraction > 0 && whole + 1 < cells.length) {
    const from = getCellCenter(layout, cells[whole].row, cells[whole].col);
    const to = getCellCenter(layout, cells[whole + 1].row, cells[whole + 1].col);
    points.push(`L ${from.x + (to.x - from.x) * fraction} ${from.y + (to.y - from.y) * fraction}`);
  }

  return points.length < 2 ? '' : points.join(' ');
}

interface Flourish {
  readonly cell: MirrorMazeCell;
  readonly startedAt: number;
}

/** Notices which single cell's mirror just changed, so it can spin into
 * place. Compares against the previous grid rather than being told by the
 * screen - "what changed since the last render" is presentation's own
 * business, and keeps the screen free of animation bookkeeping. */
function useMirrorFlourish(mirrors: MirrorMazeState['mirrors']): Flourish | null {
  const [flourish, setFlourish] = useState<Flourish | null>(null);
  const previousRef = useRef(mirrors);

  // Before paint: noticed after it, the turned mirror showed for a frame
  // at rest, then jumped back a quarter turn to spin - a snap, then the
  // spin, which read as the tap lagging.
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = mirrors;
    if (previous === mirrors) return;

    for (let r = 0; r < mirrors.length; r += 1) {
      for (let c = 0; c < mirrors[r].length; c += 1) {
        if (previous[r]?.[c] !== mirrors[r][c]) {
          setFlourish({ cell: { row: r, col: c }, startedAt: Date.now() });
          return;
        }
      }
    }
  }, [mirrors]);

  return flourish;
}

interface StaticMazeLayerProps {
  puzzle: MirrorMazePuzzle;
  layout: BoardLayout;
  flashCell?: MirrorMazeCell | null;
}

/**
 * The board itself: the tiles, and
 * every fixed marker (obstacles, target, source). None of this depends on
 * the player's mirrors, the beam, or the clock, so it is memoized away from
 * the ~60 renders/sec the animated layers above it run at - the same
 * reasoning behind `BoardView.tsx`'s own `StaticGridLayer` split, and what
 * keeps an always-on idle pulse cheap.
 */
const StaticMazeLayer = React.memo(function StaticMazeLayerImpl({
  puzzle,
  layout,
  flashCell,
}: StaticMazeLayerProps) {
  const cell = layout.cellSize;
  const flashKey = flashCell ? positionKey(flashCell.row, flashCell.col) : null;
  const targetCenter = getCellCenter(layout, puzzle.target.row, puzzle.target.col);
  const inset = (cell * TILE_GAP_SHARE) / 2;
  const tile = cell - inset * 2;
  const tileRadius = cell * 0.16;
  const lip = Math.max(1.5, cell * 0.035);
  const stones = new Set(puzzle.obstacles.map(at => positionKey(at.row, at.col)));
  const rubies = new Set((puzzle.filters ?? []).map(at => positionKey(at.row, at.col)));

  return (
    <Group>
      {/* Every square the same soft tile on the same small lip - the tile
          every other board in the app is made of. A stone and a ruby pane
          are that same tile in another colour, so the grid never breaks. */}
      {Array.from({ length: puzzle.rows }, (_row, r) =>
        Array.from({ length: puzzle.cols }, (_col, c) => {
          const o = getCellOrigin(layout, r, c);
          const key = positionKey(r, c);
          const stone = stones.has(key);
          const ruby = rubies.has(key);
          const face = stone ? theme.colors.mirrorStone : ruby ? theme.colors.mirrorRubyPane : theme.colors.mirrorPanelCell;
          const edge = ruby ? theme.colors.glassRuby : stone ? theme.colors.mirrorVoid : theme.colors.mirrorPanelEdge;
          const x = o.x + inset;
          const y = o.y + inset;
          return (
            <Group key={`tile-${key}`}>
              <RoundedRect x={x} y={y + lip} width={tile} height={tile - lip} r={tileRadius} color={theme.colors.mirrorPanelEdge} />
              <RoundedRect x={x} y={y} width={tile} height={tile - lip} r={tileRadius} color={face} />
              {stone && (
                <Group clip={rrect(rect(x, y, tile, tile - lip), tileRadius, tileRadius)}>
                  <Path path={hatch(x, y, tile)} color={theme.colors.mirrorVoid} style="stroke" strokeWidth={1.2} opacity={0.75} />
                </Group>
              )}
              <RoundedRect x={x + 0.5} y={y + 0.5} width={tile - 1} height={tile - lip - 1} r={tileRadius} color={edge} style="stroke" strokeWidth={1} opacity={0.8} />
              {ruby && <Path path={`M ${x + tile * 0.22} ${y + tile * 0.44} L ${x + tile * 0.44} ${y + tile * 0.22} M ${x + tile * 0.22} ${y + tile * 0.62} L ${x + tile * 0.62} ${y + tile * 0.22}`} color={theme.colors.glassRuby} style="stroke" strokeWidth={1.4} strokeCap="round" opacity={0.5} />}
              {flashKey === key && <RoundedRect x={x - 2} y={y - 2} width={tile + 4} height={tile + 4} r={tileRadius + 2} color={theme.colors.accent} style="stroke" strokeWidth={2.5} />}
            </Group>
          );
        }),
      )}

      {(puzzle.splitters ?? []).map(at => {
        // A splitter: a clear crystal with a bright table.
        const c = getCellCenter(layout, at.row, at.col);
        const k = cell * 0.28;
        return (
          <Group key={`split-${at.row}-${at.col}`}>
            <Path path={gemPath(c.x, c.y, k)} color={theme.colors.mirrorBeamGlow} opacity={0.35} />
            <Path path={gemPath(c.x, c.y, k)} color={theme.colors.mirrorGlass} style="stroke" strokeWidth={1.6} strokeJoin="round" />
            <Path path={gemTablePath(c.x, c.y, k)} color={theme.colors.mirrorGlass} opacity={0.85} />
          </Group>
        );
      })}

      {/* The target: a gold ring with a gold heart. */}
      <Circle cx={targetCenter.x} cy={targetCenter.y} r={cell * 0.27} color={theme.colors.accent} style="stroke" strokeWidth={Math.max(2, cell * 0.065)} />
      <Circle cx={targetCenter.x} cy={targetCenter.y} r={cell * 0.07} color={theme.colors.accent} />
    </Group>
  );
});

/** The beam's slow breath and the gems' shimmer: one full cycle of each,
 * in milliseconds (the old clock's `sin(t / 700)` and `sin(t / 820)`). */
const PULSE_PERIOD_MS = Math.round(2 * Math.PI * 700);
const SHIMMER_PERIOD_MS = Math.round(2 * Math.PI * 820);

/**
 * One gem. Waiting, it shimmers; the moment the beam first reaches it, it
 * throws a ring; lit, it rests. All of it on the UI thread - Skia reads
 * these values directly, so nothing here re-renders while it moves.
 */
function MazeGem({ cx, cy, size, lit, ruby = false, index, shimmerPhase, reducedMotion }: { cx: number; cy: number; size: number; lit: boolean; ruby?: boolean; index: number; shimmerPhase: SharedValue<number>; reducedMotion: boolean }): React.JSX.Element {
  const burst = useSharedValue(1);
  const wasLit = useRef(lit);
  useEffect(() => {
    if (lit && !wasLit.current && !reducedMotion) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: GEM_BURST_MS, easing: Easing.linear });
    }
    wasLit.current = lit;
  }, [lit, burst, reducedMotion]);

  const shimmer = useDerivedValue(() => (reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(shimmerPhase.value + index * 0.9)));
  const restingPath = useMemo(() => gemPath(cx, cy, size * 1.08), [cx, cy, size]);
  const waitingPath = useDerivedValue(() => gemPath(cx, cy, size * (0.9 + 0.14 * shimmer.value)));
  const waitingOpacity = useDerivedValue(() => 0.7 + 0.3 * shimmer.value);
  const waitingTable = useDerivedValue(() => gemTablePath(cx, cy, size * (0.9 + 0.14 * shimmer.value)));
  const restingTable = useMemo(() => gemTablePath(cx, cy, size * 1.08), [cx, cy, size]);
  const tone = ruby ? theme.colors.glassRuby : lit ? theme.colors.accent : theme.colors.mirrorGlass;
  const ringR = useDerivedValue(() => size * (1 + easeOutCubic(burst.value) * 2.2));
  const ringWidth = useDerivedValue(() => Math.max(1, size * 0.35 * (1 - burst.value)));
  const ringOpacity = useDerivedValue(() => (burst.value >= 1 ? 0 : 0.7 * (1 - burst.value)));

  return (
    <Group>
      {lit && <Circle cx={cx} cy={cy} r={ringR} color={ruby ? theme.colors.glassRuby : theme.colors.accent} style="stroke" strokeWidth={ringWidth} opacity={ringOpacity} />}
      {lit ? (
        <Group>
          <Path path={restingPath} color={tone} />
          <Path path={restingTable} color={shade(tone, 1.35)} />
        </Group>
      ) : (
        <Group opacity={waitingOpacity}>
          <Path path={waitingPath} color={theme.colors.mirrorPanelCell} />
          <Path path={waitingPath} color={tone} style="stroke" strokeWidth={1.6} strokeJoin="round" />
          <Path path={waitingTable} color={tone} opacity={0.35} />
        </Group>
      )}
      {/* A ruby gem keeps a ring of its own colour, lit or not. */}
      {ruby && <Circle cx={cx} cy={cy} r={size * 1.7} color={theme.colors.glassRuby} style="stroke" strokeWidth={1.2} opacity={0.55} />}
    </Group>
  );
}

interface StaticMirrorsProps {
  layout: BoardLayout;
  mirrors: MirrorMazeState['mirrors'];
  mirrorHalfLength: number;
  mirrorStrokeWidth: number;
  /** The single cell currently mid-flourish (`useMirrorFlourish` only ever
   * tracks one at a time), or `null` - every other placed mirror is at
   * rest and genuinely never needs the clock again once its own flourish
   * finishes. */
  flourishingKey: string | null;
  /** The board's opening second: the mirrors are dealt in. */
  dealing: DealClock;
}

const StaticMirrors = React.memo(function StaticMirrorsImpl({ layout, mirrors, mirrorHalfLength, mirrorStrokeWidth, flourishingKey, dealing }: StaticMirrorsProps) {
  const far = Math.max(mirrors.length, mirrors[0]?.length ?? 0) - 1;
  return (
    <Group>
      {mirrors.map((line, r) =>
        line.map((mirror, c) => {
          if (!mirror) return null;
          if (flourishingKey === positionKey(r, c)) return null;
          const center = getCellCenter(layout, r, c);
          return (
            <DealIn key={`mirror-${r}-${c}`} x={center.x} y={center.y} delay={dealDelay(Math.max(r, c), far)} dealing={dealing}>
              {renderMirror(`mirror-${r}-${c}`, center.x, center.y, mirrorHalfLength, mirror, 0, 1, mirrorStrokeWidth)}
            </DealIn>
          );
        }),
      )}
    </Group>
  );
});

/**
 * The light source: the light itself, not a device - an orb in the beam's
 * own colour with a soft halo and a bright heart, sitting on a pale disc
 * so it reads on any tile. The beam leaving it says which way it shines.
 */
function SourceLamp({ x, y, cell }: { x: number; y: number; cell: number }): React.JSX.Element {
  return (
    <Group>
      <Circle cx={x} cy={y} r={cell * 0.34} color={theme.colors.mirrorBeamGlow} opacity={0.22} />
      <Circle cx={x} cy={y} r={cell * 0.24} color={theme.colors.surfaceHi} />
      <Circle cx={x} cy={y} r={cell * 0.19} color={theme.colors.mirrorBeamCore} />
      <Circle cx={x} cy={y} r={cell * 0.11} color={theme.colors.mirrorBeamGlow} />
      <Circle cx={x} cy={y} r={cell * 0.05} color={theme.colors.surfaceHi} />
    </Group>
  );
}

export interface MirrorMazeBoardViewProps {
  puzzle: MirrorMazePuzzle;
  state: MirrorMazeState;
  /** Pixel size of the square area available to draw the board in. */
  size: number;
  /** The beam's current traced path, recomputed fresh from `state` on every
   * change - drawn as live light so placing a mirror has instant feedback,
   * whether or not it happens to solve the puzzle. */
  path: ReadonlyArray<MirrorMazeCell>;
  /** How far the solve ignition has travelled, 0..1 (see
   * `useAnimatedBeamReveal`). Stays 0 until the puzzle is solved. */
  revealProgress: number;
  solved: boolean;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: MirrorMazeCell | null;
}

/**
 * Renders a `MirrorMazePuzzle`/`MirrorMazeState` as a grid of Skia shapes on
 * the same paper tray as every other board (and its dark twin in the dark
 * theme): the same tiles, a game-colour rim, and simple pieces on top.
 *
 * The beam is three overlaid strokes (a wide pale glow, a body and a fine
 * core), breathing on a slow idle pulse while the puzzle is unsolved and
 * igniting in gold from source to target the moment it's solved. Mirrors
 * are steel bars; gems wait hollow and fill once lit. Pure presentation:
 * no game logic lives here.
 */
export function MirrorMazeBoardView({
  puzzle,
  state,
  size,
  path,
  revealProgress,
  solved,
  flashCell,
}: MirrorMazeBoardViewProps): React.JSX.Element {
  const dealing = useDealing();
  const { layout, margin, outer } = useMemo(() => mazeGrid(puzzle.rows, size), [puzzle.rows, size]);
  const panelRadius = 12;
  const reducedMotion = useReducedMotion();



  // A board with a filter or a splitter has more than one stretch of
  // light, and colour; a plain one is just `path`, as it always was.
  const ruled = !!(puzzle.filters?.length || puzzle.splitters?.length || puzzle.rubyGems?.length);
  const trace = useMemo(() => (ruled ? traceAll(puzzle, state) : null), [ruled, puzzle, state]);
  const litGemKeys = useMemo(() => (trace ? new Set(trace.lit) : new Set(path.map(cell => positionKey(cell.row, cell.col)))), [trace, path]);
  const pieces = useMemo(
    () =>
      (trace ? trace.pieces : [{ cells: path, ruby: false }])
        .map(piece => {
          // A stretch that never left its square - a splitter's half sent
          // straight into a wall - is drawn as a short stub to the wall,
          // so both halves of a split are seen, not just the one that runs.
          const heading = 'heading' in piece ? piece.heading : undefined;
          if (piece.cells.length === 1 && heading) {
            const c = getCellCenter(layout, piece.cells[0].row, piece.cells[0].col);
            const { dRow, dCol } = DIRECTION_VECTOR[heading];
            return { d: `M ${c.x} ${c.y} L ${c.x + dCol * layout.cellSize * 0.46} ${c.y + dRow * layout.cellSize * 0.46}`, ruby: piece.ruby };
          }
          return { d: pathThroughCells(layout, piece.cells), ruby: piece.ruby };
        })
        .filter(piece => piece.d !== ''),
    [trace, path, layout],
  );
  // The solve's gold sweeps every stretch of light at once - both halves
  // of a split beam, not only the first beam out of the lamp (which left
  // the second half dark as the board finished).
  const ignitionPathString = useMemo(
    () =>
      (trace ? trace.pieces : [{ cells: path, ruby: false }])
        .map(piece => {
          const heading = 'heading' in piece ? piece.heading : undefined;
          if (piece.cells.length === 1 && heading && revealProgress > 0) {
            const c = getCellCenter(layout, piece.cells[0].row, piece.cells[0].col);
            const { dRow, dCol } = DIRECTION_VECTOR[heading];
            const k = layout.cellSize * 0.46 * Math.min(1, revealProgress * 4);
            return `M ${c.x} ${c.y} L ${c.x + dCol * k} ${c.y + dRow * k}`;
          }
          return partialPathThroughCells(layout, piece.cells, revealProgress);
        })
        .filter(d => d !== '')
        .join(' '),
    [trace, path, layout, revealProgress],
  );

  const flourish = useMirrorFlourish(state.mirrors);
  const flourishingKey = flourish ? positionKey(flourish.cell.row, flourish.cell.col) : null;

  // The beam breathes and the waiting gems shimmer - on the UI thread.
  // This board used to run a JavaScript clock that re-rendered all of it
  // twelve times a second (sixty while anything moved), which is what made
  // turning a mirror feel heavy on a phone.
  const idle = !solved && !reducedMotion;
  const pulsePhase = useSharedValue(Math.PI / 2);
  const shimmerPhase = useSharedValue(0);
  useEffect(() => {
    if (!idle) {
      cancelAnimation(pulsePhase);
      cancelAnimation(shimmerPhase);
      pulsePhase.value = Math.PI / 2;
      return;
    }
    pulsePhase.value = 0;
    pulsePhase.value = withRepeat(withTiming(2 * Math.PI, { duration: PULSE_PERIOD_MS, easing: Easing.linear }), -1, false);
    shimmerPhase.value = 0;
    shimmerPhase.value = withRepeat(withTiming(2 * Math.PI, { duration: SHIMMER_PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [idle, pulsePhase, shimmerPhase]);
  const pulse = useDerivedValue(() => 0.5 + 0.5 * Math.sin(pulsePhase.value));

  // Light wants to be thin and sharp with a wide, faint bloom around it -
  // a thick core just reads as a glowing rod.
  const haloBase = Math.max(4, layout.cellSize * 0.14);
  const haloWidth = useDerivedValue(() => haloBase * (0.85 + 0.3 * pulse.value));
  const haloOpacity = useDerivedValue(() => 0.1 + 0.08 * pulse.value);
  const coreOpacity = useDerivedValue(() => 0.85 + 0.15 * pulse.value);
  const midWidth = Math.max(1.8, layout.cellSize * 0.055);
  const coreWidth = Math.max(1, layout.cellSize * 0.026);
  const sourceCenter = getCellCenter(layout, puzzle.source.row, puzzle.source.col);
  const gemSize = layout.cellSize * 0.16;
  const mirrorHalfLength = (layout.cellSize - layout.cellSize * 0.22 * 2) / 2;
  const mirrorStrokeWidth = Math.max(2.5, layout.cellSize * 0.09);

  return (
    <Group>
      <RoundedRect x={0} y={0} width={outer} height={outer} r={panelRadius} color={theme.colors.mirrorPanel} />
      <Group transform={[{ translateX: margin }, { translateY: margin }]}>
      <StaticMazeLayer puzzle={puzzle} layout={layout} flashCell={flashCell} />

      {/* The live beam: a halo, a body and a core, so it reads as light with
          falloff rather than a single flat stroke. */}
      {pieces.map((piece, i) => (
        <Group key={`beam-${i}`}>
          <Path
            path={piece.d}
            color={piece.ruby ? theme.colors.glassRuby : theme.colors.mirrorBeamGlow}
            style="stroke"
            strokeWidth={haloWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={haloOpacity}
          />
          <Path
            path={piece.d}
            color={piece.ruby ? theme.colors.glassRuby : theme.colors.mirrorBeamGlow}
            style="stroke"
            strokeWidth={midWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={piece.ruby ? 0.8 : 0.55}
          />
          <Path
            path={piece.d}
            color={piece.ruby ? theme.colors.glassRuby : theme.colors.mirrorBeamCore}
            style="stroke"
            strokeWidth={coreWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={coreOpacity}
          />
        </Group>
      ))}

      {/* The solve ignition: the same three-layer light, in gold, sweeping
          the path from source to target. */}
      {ignitionPathString !== '' && (
        <Group>
          <Path
            path={ignitionPathString}
            color={theme.colors.accent}
            style="stroke"
            strokeWidth={haloBase * 1.25}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.30}
          />
          <Path
            path={ignitionPathString}
            color={theme.colors.accent}
            style="stroke"
            strokeWidth={midWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.75}
          />
          <Path
            path={ignitionPathString}
            color={shade(theme.colors.accent, 0.8)}
            style="stroke"
            strokeWidth={coreWidth * 1.4}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      )}

      {/* The source, over the beam it sends out. */}
      <SourceLamp x={sourceCenter.x} y={sourceCenter.y} cell={layout.cellSize} />

      {puzzle.gems.map((cell, i) => {
        const center = getCellCenter(layout, cell.row, cell.col);
        return (
          <DealIn key={`gem-${cell.row}-${cell.col}`} x={center.x} y={center.y} delay={dealDelay(Math.max(cell.row, cell.col), Math.max(puzzle.rows, puzzle.cols) - 1)} dealing={dealing}>
          <MazeGem
            cx={center.x}
            cy={center.y}
            size={gemSize}
            lit={litGemKeys.has(positionKey(cell.row, cell.col))}
            ruby={puzzle.rubyGems?.includes(i) ?? false}
            index={i}
            shimmerPhase={shimmerPhase}
            reducedMotion={reducedMotion}
          />
          </DealIn>
        );
      })}

      <StaticMirrors
        layout={layout}
        mirrors={state.mirrors}
        mirrorHalfLength={mirrorHalfLength}
        mirrorStrokeWidth={mirrorStrokeWidth}
        flourishingKey={flourishingKey}
        dealing={dealing}
      />
      {/* The one mirror still mid-flourish, if any - every other placed
          mirror is `StaticMirrors`' job. */}
      {flourish && (
        <Group>
          {(() => {
            const { row: r, col: c } = flourish.cell;
            const mirror = state.mirrors[r][c];
            if (!mirror) return null;
            const center = getCellCenter(layout, r, c);
            // A quarter turn unwinding into place with a brief swell - on
            // the UI thread (`SkiaEntrance`), so turning a mirror needs no
            // clock of its own.
            return (
              <SkiaEntrance
                key={`${r}:${c}@${flourish.startedAt}`}
                duration={FLOURISH_MS}
                fadeShare={0}
                turn={Math.PI / 2}
                swell={0.16}
                origin={vec(center.x, center.y)}
                reducedMotion={reducedMotion}
              >
                {renderMirror('flourishing', center.x, center.y, mirrorHalfLength, mirror, 0, 1, mirrorStrokeWidth)}
              </SkiaEntrance>
            );
          })()}
        </Group>
      )}
      </Group>
      <RoundedRect x={1} y={1} width={outer - 2} height={outer - 2} r={panelRadius - 1} color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.5} opacity={0.6} />
    </Group>
  );
}

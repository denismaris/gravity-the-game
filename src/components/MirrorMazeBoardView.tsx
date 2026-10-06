import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import {
  Direction,
  MirrorKind,
  MirrorMazeCell,
  MirrorMazePuzzle,
  MirrorMazeState,
} from '../game/mirror';
import {
  BoardLayout,
  CellBackground,
  computeBoardLayout,
  getCellCenter,
  getCellOrigin,
  ObstacleBlock,
  shade,
  TargetMarker,
  useReducedMotion,
} from '../game/rendering';
import { theme, lightColors } from '../theme';
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

const mirrorHalo = (): string => shade(theme.colors.mirrorGlass, 1.35);

/**
 * A placed mirror, drawn as a soft halo behind a crisp core - the same
 * two-layer idiom the beam itself uses (`livePathString`'s own halo/mid/
 * core), applied here instead of a shadow: this board is a dark, lit
 * scene, not paper on a page, so a mirror reads as "catching light"
 * rather than "casting one" - a cast shadow would not even be visible
 * against a near-black panel. `mirrorGlass`'s own doc comment already
 * calls this "polished silver"; the halo is what actually makes it read
 * as polished rather than flat, without reaching for a gradient fill
 * (see this project's own standing depth-vs-flat guidance: geometry, not
 * bevels, and a mirror is not a sphere).
 */
export function renderMirror(key: string, cx: number, cy: number, halfLength: number, mirror: MirrorKind, extraRadians: number, scale: number, strokeWidth: number): React.JSX.Element {
  const path = mirrorPath(cx, cy, halfLength, mirror, extraRadians, scale);
  return (
    <Group key={key}>
      <Path path={path} color={mirrorHalo()} style="stroke" strokeWidth={strokeWidth * 2.2} strokeCap="round" opacity={0.35} />
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

interface Speck {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly opacity: number;
}

/**
 * Faint constellation dust scattered across the ink panel. Deterministic
 * (a tiny seeded LCG, seeded off the puzzle id) so the same board always
 * has the same sky - a fresh `Math.random()` per render would make the
 * whole field twinkle chaotically on every frame.
 */
function useSpeckle(boardSize: number, seed: number): ReadonlyArray<Speck> {
  return useMemo(() => {
    let state = seed || 1;
    const random = (): number => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };

    const count = Math.max(24, Math.round(boardSize / 5));
    return Array.from({ length: count }, (): Speck => ({
      x: random() * boardSize,
      y: random() * boardSize,
      r: 0.9 + random() * 1.8,
      opacity: 0.18 + random() * 0.42,
    }));
  }, [boardSize, seed]);
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
  speckle: ReadonlyArray<Speck>;
  flashCell?: MirrorMazeCell | null;
}

/**
 * The board itself: the ink panel, its constellation dust, the tiles, and
 * every fixed marker (obstacles, target, source). None of this depends on
 * the player's mirrors, the beam, or the clock, so it is memoized away from
 * the ~60 renders/sec the animated layers above it run at - the same
 * reasoning behind `BoardView.tsx`'s own `StaticGridLayer` split, and what
 * keeps an always-on idle pulse cheap.
 */
const StaticMazeLayer = React.memo(function StaticMazeLayerImpl({
  puzzle,
  layout,
  speckle,
  flashCell,
}: StaticMazeLayerProps) {
  const cellInset = layout.cellSize * 0.05;
  const cellCornerRadius = layout.cellSize * 0.14;
  const obstacleInset = layout.cellSize * 0.18;
  const obstacleCornerRadius = layout.cellSize * 0.06;
  const targetRadius = layout.cellSize * 0.28;
  const targetStrokeWidth = Math.max(2, layout.cellSize * 0.075);

  const flashKey = flashCell ? positionKey(flashCell.row, flashCell.col) : null;
  const targetCenter = getCellCenter(layout, puzzle.target.row, puzzle.target.col);

  return (
    <Group>
      <RoundedRect
        x={0}
        y={0}
        width={layout.boardSize}
        height={layout.boardSize}
        r={layout.cellSize * 0.16}
        color={theme.colors.mirrorPanel}
      />

      {speckle.map((speck, i) => (
        <Circle key={`speck-${i}`} cx={speck.x} cy={speck.y} r={speck.r} color={theme.colors.mirrorSpeckle} opacity={speck.opacity} />
      ))}

      {/* Each cell is a flat lit-tile fill plus one hairline (`CellBackground`
          draws nothing else - no shadow, no corner highlight), sitting on
          the one panel above whose own shadow and frame (this component's
          own outer `RoundedRect`s) are the only elevation this board casts
          - the same single-elevation rule `BinairoBoardView.tsx`'s
          `renderTileChrome` was fixed to follow, already true here without
          needing a change. */}
      {Array.from({ length: puzzle.rows }, (_row, r) =>
        Array.from({ length: puzzle.cols }, (_col, c) => {
          const origin = getCellOrigin(layout, r, c);
          const flashed = flashKey === positionKey(r, c);
          return (
            <CellBackground
              key={`bg-${r}-${c}`}
              x={origin.x + cellInset}
              y={origin.y + cellInset}
              size={layout.cellSize - cellInset * 2}
              fill={flashed ? theme.colors.accent : theme.colors.mirrorPanelCell}
              stroke={theme.colors.mirrorPanelEdge}
              cornerRadius={cellCornerRadius}
            />
          );
        }),
      )}

      {puzzle.obstacles.map((cell, i) => {
        const origin = getCellOrigin(layout, cell.row, cell.col);
        return (
          <ObstacleBlock
            key={`obstacle-${i}`}
            x={origin.x + obstacleInset}
            y={origin.y + obstacleInset}
            size={layout.cellSize - obstacleInset * 2}
            color={theme.colors.mirrorVoid}
            cornerRadius={obstacleCornerRadius}
          />
        );
      })}

      <TargetMarker
        cx={targetCenter.x}
        cy={targetCenter.y}
        radius={targetRadius}
        color={theme.colors.accent}
        strokeWidth={targetStrokeWidth}
      />

      {/* The panel's own identity-colour frame - the same move
          `BinairoBoardView.tsx`'s `renderTray` makes for the light board
          (giving `mirrorAccent` real presence on the board itself, not
          just the header's kicker/track), pushed to a higher opacity than
          that cream tray's 0.55 uses: a faint tint reads fine against
          luminous paper but would all but vanish against this panel's
          near-black wash. Drawn last so the rim stays a crisp, unbroken
          ring on top of every cell, obstacle and marker inside it. */}
      <RoundedRect
        x={1}
        y={1}
        width={layout.boardSize - 2}
        height={layout.boardSize - 2}
        r={Math.max(0, layout.cellSize * 0.16 - 1)}
        color={theme.colors.mirrorAccent}
        style="stroke"
        strokeWidth={1.75}
        opacity={0.85}
      />
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
function MazeGem({ cx, cy, size, lit, index, shimmerPhase, reducedMotion }: { cx: number; cy: number; size: number; lit: boolean; index: number; shimmerPhase: SharedValue<number>; reducedMotion: boolean }): React.JSX.Element {
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
  const waitingOpacity = useDerivedValue(() => 0.55 + 0.35 * shimmer.value);
  const ringR = useDerivedValue(() => size * (1 + easeOutCubic(burst.value) * 2.2));
  const ringWidth = useDerivedValue(() => Math.max(1, size * 0.35 * (1 - burst.value)));
  const ringOpacity = useDerivedValue(() => (burst.value >= 1 ? 0 : 0.7 * (1 - burst.value)));

  return (
    <Group>
      {lit && <Circle cx={cx} cy={cy} r={ringR} color={theme.colors.accent} style="stroke" strokeWidth={ringWidth} opacity={ringOpacity} />}
      {lit ? <Path path={restingPath} color={theme.colors.accent} /> : <Path path={waitingPath} color={theme.colors.mirrorGlass} opacity={waitingOpacity} />}
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
}

const StaticMirrors = React.memo(function StaticMirrorsImpl({ layout, mirrors, mirrorHalfLength, mirrorStrokeWidth, flourishingKey }: StaticMirrorsProps) {
  return (
    <Group>
      {mirrors.map((line, r) =>
        line.map((mirror, c) => {
          if (!mirror) return null;
          if (flourishingKey === positionKey(r, c)) return null;
          const center = getCellCenter(layout, r, c);
          return renderMirror(`mirror-${r}-${c}`, center.x, center.y, mirrorHalfLength, mirror, 0, 1, mirrorStrokeWidth);
        }),
      )}
    </Group>
  );
});

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
 * a dark ink panel - the one board in the app that inverts, because a beam
 * drawn on cream is a line, and a beam drawn on ink is light.
 *
 * The beam is three overlaid strokes (wide blue halo, mid, warm-white core)
 * rather than one flat line, breathing on a slow idle pulse while the puzzle
 * is unsolved and igniting from source to target the moment it's solved.
 * Fixed content (source, target, obstacles) is paper and gold; the player's
 * mirrors are polished silver. Pure presentation: no game logic lives here.
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
  const layout = useMemo(() => computeBoardLayout(puzzle.rows, size), [puzzle.rows, size]);
  const reducedMotion = useReducedMotion();


  const seed = useMemo(() => [...puzzle.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0), [puzzle.id]);
  const speckle = useSpeckle(layout.boardSize, seed);

  const litGemKeys = useMemo(() => new Set(path.map(cell => positionKey(cell.row, cell.col))), [path]);
  const livePathString = useMemo(() => pathThroughCells(layout, path), [layout, path]);
  const ignitionPathString = partialPathThroughCells(layout, path, revealProgress);

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
  const haloBase = Math.max(4, layout.cellSize * 0.17);
  const haloWidth = useDerivedValue(() => haloBase * (0.85 + 0.3 * pulse.value));
  const haloOpacity = useDerivedValue(() => 0.16 + 0.12 * pulse.value);
  const coreOpacity = useDerivedValue(() => 0.85 + 0.15 * pulse.value);
  const midWidth = Math.max(1.8, layout.cellSize * 0.055);
  const coreWidth = Math.max(1, layout.cellSize * 0.026);
  const arrowSize = layout.cellSize * 0.26;
  const sourceCenter = getCellCenter(layout, puzzle.source.row, puzzle.source.col);
  const gemSize = layout.cellSize * 0.16;
  const mirrorHalfLength = (layout.cellSize - layout.cellSize * 0.22 * 2) / 2;
  const mirrorStrokeWidth = Math.max(2.5, layout.cellSize * 0.09);

  return (
    <Group>
      <StaticMazeLayer puzzle={puzzle} layout={layout} speckle={speckle} flashCell={flashCell} />

      {/* The live beam: a halo, a body and a core, so it reads as light with
          falloff rather than a single flat stroke. */}
      {livePathString !== '' && (
        <Group>
          <Path
            path={livePathString}
            color={theme.colors.mirrorBeamGlow}
            style="stroke"
            strokeWidth={haloWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={haloOpacity}
          />
          <Path
            path={livePathString}
            color={theme.colors.mirrorBeamGlow}
            style="stroke"
            strokeWidth={midWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.55}
          />
          <Path
            path={livePathString}
            color={theme.colors.mirrorBeamCore}
            style="stroke"
            strokeWidth={coreWidth}
            strokeCap="round"
            strokeJoin="round"
            opacity={coreOpacity}
          />
        </Group>
      )}

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
            color={theme.colors.mirrorBeamCore}
            style="stroke"
            strokeWidth={coreWidth * 1.4}
            strokeCap="round"
            strokeJoin="round"
          />
        </Group>
      )}

      {/* The emitter, drawn over the beam rather than under it - light
          should leave the source, not swallow it. */}
      <Path
        path={arrowPath(sourceCenter.x, sourceCenter.y, arrowSize, puzzle.sourceDirection)}
        color={lightColors.background}
      />

      {puzzle.gems.map((cell, i) => {
        const center = getCellCenter(layout, cell.row, cell.col);
        return (
          <MazeGem
            key={`gem-${cell.row}-${cell.col}`}
            cx={center.x}
            cy={center.y}
            size={gemSize}
            lit={litGemKeys.has(positionKey(cell.row, cell.col))}
            index={i}
            shimmerPhase={shimmerPhase}
            reducedMotion={reducedMotion}
          />
        );
      })}

      <StaticMirrors
        layout={layout}
        mirrors={state.mirrors}
        mirrorHalfLength={mirrorHalfLength}
        mirrorStrokeWidth={mirrorStrokeWidth}
        flourishingKey={flourishingKey}
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
  );
}

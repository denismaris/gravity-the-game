import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
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
  TargetMarker,
  useAnimationClock,
  useReducedMotion,
} from '../game/rendering';
import { theme } from '../theme';

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

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeOutCubic(t: number): number {
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

/** A small diamond marking a gem - distinct from the mirror's straight
 * diagonal, the target's ring and the obstacle's square. */
export function gemPath(cx: number, cy: number, size: number): string {
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

  useEffect(() => {
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

/** When each gem was first reached by the beam, so a newly-lit one can throw
 * a collected ring. Keyed by cell, and never cleared - a gem the beam later
 * stops reaching simply stops being `lit`, and re-lighting it restamps. */
function useGemBursts(litGemKeys: ReadonlySet<string>): ReadonlyMap<string, number> {
  const [bursts, setBursts] = useState<ReadonlyMap<string, number>>(new Map());
  const previousRef = useRef(litGemKeys);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = litGemKeys;

    const newlyLit = [...litGemKeys].filter(key => !previous.has(key));
    if (newlyLit.length === 0) return;

    setBursts(current => {
      const next = new Map(current);
      const now = Date.now();
      for (const key of newlyLit) next.set(key, now);
      return next;
    });
  }, [litGemKeys]);

  return bursts;
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

  // Idle motion runs while there's still a puzzle to solve, and through the
  // ignition so the last gem's burst isn't cut off mid-flight.
  const clock = useAnimationClock(!solved || revealProgress < 1);

  const seed = useMemo(() => [...puzzle.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0), [puzzle.id]);
  const speckle = useSpeckle(layout.boardSize, seed);

  const litGemKeys = useMemo(() => new Set(path.map(cell => positionKey(cell.row, cell.col))), [path]);
  const livePathString = useMemo(() => pathThroughCells(layout, path), [layout, path]);
  const ignitionPathString = partialPathThroughCells(layout, path, revealProgress);

  const flourish = useMirrorFlourish(state.mirrors);
  const gemBursts = useGemBursts(litGemKeys);

  // Frozen at its own midpoint under reduced motion, not fully removed -
  // the beam still shows the same halo/core presence, it just stops
  // breathing. `clock / 700` is a ~0.23Hz idle oscillation, inside the
  // slow-loop band motion-sensitive users are most bothered by.
  const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock / 700);
  // Light wants to be thin and sharp with a wide, faint bloom around it -
  // a thick core just reads as a glowing rod.
  const haloWidth = Math.max(4, layout.cellSize * 0.17) * (0.85 + 0.3 * pulse);
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
            opacity={0.16 + 0.12 * pulse}
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
            opacity={0.85 + 0.15 * pulse}
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
            strokeWidth={haloWidth * 1.25}
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
        color={theme.colors.background}
      />

      {/* Gems: a slow shimmer while waiting, a ring thrown outward the moment
          the beam first reaches one. */}
      {puzzle.gems.map((cell, i) => {
        const center = getCellCenter(layout, cell.row, cell.col);
        const key = positionKey(cell.row, cell.col);
        const lit = litGemKeys.has(key);
        const shimmer = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(clock / 820 + i * 0.9);

        const burstAt = gemBursts.get(key);
        const burst = burstAt === undefined ? 1 : clamp01((Date.now() - burstAt) / GEM_BURST_MS);
        const bursting = lit && burst < 1;

        return (
          <Group key={`gem-${i}`}>
            {bursting && (
              <Circle
                cx={center.x}
                cy={center.y}
                r={gemSize * (1 + easeOutCubic(burst) * 2.2)}
                color={theme.colors.accent}
                style="stroke"
                strokeWidth={Math.max(1, gemSize * 0.35 * (1 - burst))}
                opacity={0.7 * (1 - burst)}
              />
            )}
            <Path
              path={gemPath(center.x, center.y, gemSize * (lit ? 1.08 : 0.9 + 0.14 * shimmer))}
              color={lit ? theme.colors.accent : theme.colors.mirrorGlass}
              opacity={lit ? 1 : 0.55 + 0.35 * shimmer}
            />
          </Group>
        );
      })}

      {/* Mirrors: polished silver, spun into place on the tap that set them. */}
      {state.mirrors.map((line, r) =>
        line.map((mirror, c) => {
          if (!mirror) return null;
          const center = getCellCenter(layout, r, c);

          const isFlourishing = flourish?.cell.row === r && flourish?.cell.col === c;
          const raw = isFlourishing ? clamp01((Date.now() - flourish.startedAt) / FLOURISH_MS) : 1;
          const eased = easeOutCubic(raw);
          const extraRadians = (1 - eased) * (Math.PI / 2);
          const scale = 1 + Math.sin(eased * Math.PI) * 0.16;

          return (
            <Path
              key={`mirror-${r}-${c}`}
              path={mirrorPath(center.x, center.y, mirrorHalfLength, mirror, extraRadians, scale)}
              color={theme.colors.mirrorGlass}
              style="stroke"
              strokeWidth={mirrorStrokeWidth}
              strokeCap="round"
            />
          );
        }),
      )}
    </Group>
  );
}

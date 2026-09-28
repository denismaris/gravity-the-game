import React, { useMemo, useRef } from 'react';
import { Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import {
  ArukoneCell,
  ArukonePair,
  ArukonePuzzle,
  ArukoneState,
  cellKey,
  drawnHalf,
  isPathComplete,
  mirrorPairOf,
  obstacleSet,
  occupancy,
  pendingArm,
  sameCell,
} from '../game/arukone';
import {
  BoardLayout,
  computeBoardLayout,
  getCellCenter,
  getCellOrigin,
  introCellProgress,
  INTRO_TOTAL_MS,
  isIntroActive,
  shade,
  useAnimationClock,
  useIntroWave,
  useReducedMotion,
} from '../game/rendering';
import { theme } from '../theme';

/**
 * The Skia-drawn Arukone+ board: a ruled paper grid, blocked squares
 * stopped out in ink, and the paths themselves drawn as rounded cords -
 * a soft shadow under, a light along the top - so a line reads as
 * something laid onto the page rather than a stroke through it.
 *
 * Nothing here animates while the board sits untouched. The intro wave
 * runs once and the clock stops; a path completing flashes for a third of
 * a second and the clock stops again. This board is the newest in the app
 * and it is the one that spends the least time rendering, which is the
 * intended direction of travel.
 */

/** How long a pair's "that one is done" flash lasts. */
const COMPLETE_FLASH_MS = 380;

/**
 * Tones for the pairs, all struck off the one accent.
 *
 * Mirror partners deliberately share a tone: the two of them are drawn by
 * a single gesture and are the same shape folded over, so showing them as
 * one colour is showing the player what actually happened. A board is
 * therefore two or three tones, not one per number - and they differ by
 * weight within a single hue rather than by being different colours,
 * which is how the rest of this palette works.
 */
const TONE_FACTORS: ReadonlyArray<number> = [1, 1.46, 0.72, 1.78];

/** Each pair's tone, keyed by value - mirror partners share one. */
export function toneForPairs(puzzle: ArukonePuzzle): ReadonlyMap<number, string> {
  const tones = new Map<number, string>();
  let next = 0;
  for (const pair of puzzle.pairs) {
    if (tones.has(pair.value)) continue;
    const tone = shade(theme.colors.arukoneAccent, TONE_FACTORS[next % TONE_FACTORS.length]);
    next += 1;
    tones.set(pair.value, tone);
    const twin = mirrorPairOf(puzzle, pair);
    if (twin) tones.set(twin.value, tone);
  }
  return tones;
}

/** The runs to draw for one pair: what is on the board, plus the arm a
 * self-symmetric pair has growing towards it but has not yet joined. */
function runsFor(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  pair: ArukonePair,
): { committed: ReadonlyArray<ArukoneCell>; pending: ReadonlyArray<ArukoneCell> } {
  return {
    committed: state.paths[pair.value] ?? [],
    pending: pendingArm(puzzle, state, pair),
  };
}

function polyline(layout: BoardLayout, cells: ReadonlyArray<ArukoneCell>): string {
  if (cells.length === 0) return '';
  const points = cells.map(cell => getCellCenter(layout, cell.row, cell.col));
  if (points.length === 1) {
    // A single cell has no length to stroke; a hairline back to itself
    // gives the round cap something to draw, which is the dot the player
    // expects to see the instant they touch a number.
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.01} ${points[0].y}`;
  }
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

/** The paper the whole board is ruled on, tile by tile so the intro wave
 * has something to arrive on. */
const Tiles = React.memo(function TilesImpl({
  layout,
  blocked,
  introElapsed,
  reducedMotion,
}: {
  layout: BoardLayout;
  blocked: ReadonlySet<string>;
  introElapsed: number;
  reducedMotion: boolean;
}): React.JSX.Element {
  const tiles: React.JSX.Element[] = [];
  const inset = layout.cellSize * 0.035;
  for (let row = 0; row < layout.gridSize; row += 1) {
    for (let col = 0; col < layout.gridSize; col += 1) {
      const progress = reducedMotion ? 1 : introCellProgress(introElapsed, row, col);
      if (progress <= 0) continue;
      const origin = getCellOrigin(layout, row, col);
      const eased = 1 - Math.pow(1 - progress, 3);
      // Tiles settle outward from a slightly shrunken square, so the wave
      // reads as the page being laid down rather than fading up.
      const shrink = (1 - eased) * layout.cellSize * 0.16;
      const x = origin.x + inset + shrink;
      const y = origin.y + inset + shrink;
      const side = layout.cellSize - inset * 2 - shrink * 2;
      const r = layout.cellSize * 0.16;
      // A framed well - fill plus the hairline `border` stroke every other
      // board's wells carry. Without the stroke these were paper on paper,
      // and the mostly-empty board read as a blank sheet.
      tiles.push(
        <Group key={`tile-${row}-${col}`} opacity={eased}>
          <RoundedRect x={x} y={y} width={side} height={side} r={r} color={blocked.has(`${row}:${col}`) ? theme.colors.surface : theme.colors.surfaceHi} />
          <RoundedRect x={x} y={y} width={side} height={side} r={r} color={theme.colors.border} style="stroke" strokeWidth={1} />
        </Group>,
      );
    }
  }
  return <Group>{tiles}</Group>;
});

/** The line the board folds about - or, for a half-turn board, the point
 * it turns around. */
/** Memoised: depends only on the puzzle and the layout, neither of which
 * changes while the board animates. Without this the fold guide, the
 * obstacles and every tile were rebuilt on each clock tick - this board
 * was the only one in the app with no static layer at all. */
const FoldGuide = React.memo(function FoldGuideImpl({ puzzle, layout }: { puzzle: ArukonePuzzle; layout: BoardLayout }): React.JSX.Element {
  const span = layout.boardSize;
  const mid = span / 2;
  const width = Math.max(1, layout.cellSize * 0.022);

  if (puzzle.axis === 'rotational') {
    return (
      <Group>
        <Circle cx={mid} cy={mid} r={layout.cellSize * 0.2} color={theme.colors.arukoneFold} style="stroke" strokeWidth={width} />
        <Circle cx={mid} cy={mid} r={layout.cellSize * 0.05} color={theme.colors.arukoneFold} />
      </Group>
    );
  }

  const path =
    puzzle.axis === 'vertical'
      ? `M ${mid} ${span * 0.03} L ${mid} ${span * 0.97}`
      : `M ${span * 0.03} ${mid} L ${span * 0.97} ${mid}`;
  return (
    <Path
      path={path}
      color={theme.colors.arukoneFold}
      style="stroke"
      strokeWidth={width}
      strokeCap="round"
    />
  );
});

/** A blocked square: ink, with its own lit top edge so it reads as solid
 * rather than as a hole in the page. */
const Obstacles = React.memo(function ObstaclesImpl({ puzzle, layout }: { puzzle: ArukonePuzzle; layout: BoardLayout }): React.JSX.Element {
  const inset = layout.cellSize * 0.1;
  const side = layout.cellSize - inset * 2;
  return (
    <Group>
      {puzzle.obstacles.map(cell => {
        const origin = getCellOrigin(layout, cell.row, cell.col);
        return (
          <Group key={`block-${cellKey(cell)}`}>
            <RoundedRect
              x={origin.x + inset}
              y={origin.y + inset}
              width={side}
              height={side}
              r={layout.cellSize * 0.14}
              color={theme.colors.arukoneObstacle}
            />
            <RoundedRect
              x={origin.x + inset}
              y={origin.y + inset}
              width={side}
              height={side * 0.42}
              r={layout.cellSize * 0.14}
              color={theme.colors.arukoneObstacleEdge}
              opacity={0.55}
            />
          </Group>
        );
      })}
    </Group>
  );
});

/** One pair's cord: a shadow beneath, the body, and a light along it. */
export function Cord({
  path,
  tone,
  width,
  faded,
}: {
  path: string;
  tone: string;
  width: number;
  faded: boolean;
}): React.JSX.Element | null {
  if (!path) return null;
  return (
    <Group opacity={faded ? 0.42 : 1}>
      <Group transform={[{ translateY: Math.max(1, width * 0.12) }]}>
        <Path path={path} color={theme.colors.towersShadow} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" />
      </Group>
      <Path path={path} color={tone} style="stroke" strokeWidth={width} strokeCap="round" strokeJoin="round" />
      <Group transform={[{ translateY: -width * 0.16 }]}>
        <Path
          path={path}
          color={shade(tone, 1.3)}
          opacity={0.5}
          style="stroke"
          strokeWidth={width * 0.26}
          strokeCap="round"
          strokeJoin="round"
        />
      </Group>
    </Group>
  );
}

/** A number's own cell: a raised token the cord runs into. */
export function Token({
  center,
  radius,
  tone,
  joined,
}: {
  center: { x: number; y: number };
  radius: number;
  tone: string;
  joined: boolean;
}): React.JSX.Element {
  return (
    <Group>
      <Circle cx={center.x} cy={center.y + radius * 0.12} r={radius} color={theme.colors.towersShadow} />
      <Circle cx={center.x} cy={center.y} r={radius} color={tone} />
      {/* One light source, top-left - the same convention every board here
       * draws to. A joined pair loses the ring and gains a full rim, so
       * "this one is done" is visible without reading the path. */}
      <Circle
        cx={center.x}
        cy={center.y}
        r={radius * 0.92}
        color={joined ? shade(tone, 1.55) : shade(tone, 1.3)}
        opacity={joined ? 0.85 : 0.4}
        style="stroke"
        strokeWidth={radius * 0.14}
      />
    </Group>
  );
}

/** When each pair most recently became joined, so a completion can flash
 * once without the screen having to notice it and pass it down. */
function useCompletionFlashes(puzzle: ArukonePuzzle, state: ArukoneState, now: number): ReadonlyMap<number, number> {
  const joinedRef = useRef<ReadonlySet<number>>(new Set());
  const flashRef = useRef<Map<number, number>>(new Map());

  const joined = new Set<number>();
  for (const pair of puzzle.pairs) {
    if (isPathComplete(pair, state.paths[pair.value] ?? [])) joined.add(pair.value);
  }
  for (const value of joined) {
    if (!joinedRef.current.has(value)) flashRef.current.set(value, now);
  }
  for (const value of flashRef.current.keys()) {
    if (!joined.has(value)) flashRef.current.delete(value);
  }
  joinedRef.current = joined;
  return flashRef.current;
}

/**
 * The finish: every cord flares in turn.
 *
 * This board already flared a *single* pair the moment it joined, which
 * meant finishing the puzzle lit up only the last cord the player
 * happened to close - the one celebration on the board marked the
 * smallest possible thing. Solving it now runs the same flare down every
 * pair in order, so the whole route the player built reads back at them.
 * Staggered to land inside `SOLVE_CELEBRATION_MS`, the beat the
 * completion card waits out: at six pairs the last starts at 330ms and
 * is done by 560ms.
 */
const SOLVE_FLARE_STAGGER_MS = 66;

/** Each pair's own start time for the solve wave, or `null` when the
 * board is not finished. */
function useSolveFlares(solved: boolean, now: number): number | null {
  const startedAtRef = useRef<number | null>(null);
  if (solved && startedAtRef.current === null) startedAtRef.current = now;
  if (!solved && startedAtRef.current !== null) startedAtRef.current = null;
  return startedAtRef.current;
}

export interface ArukoneBoardViewProps {
  puzzle: ArukonePuzzle;
  state: ArukoneState;
  /** Pixel width (and height - always square) available for the board. */
  size: number;
  solved: boolean;
  /** Bumped by the screen on restart to replay the intro wave. */
  introKey?: number;
  /** A cell to knock back briefly - the board's answer to a move it just
   * refused (see `ArukoneScreen`). */
  rejectedCell?: ArukoneCell | null;
}

export function ArukoneBoardView({
  puzzle,
  state,
  size,
  solved,
  introKey,
  rejectedCell,
}: ArukoneBoardViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);
  const blocked = useMemo(() => new Set(puzzle.obstacles.map(cellKey)), [puzzle.obstacles]);
  const tones = useMemo(() => toneForPairs(puzzle), [puzzle]);

  const now = Date.now();
  const introStartedAt = useIntroWave(introKey, now);
  const introElapsed = now - introStartedAt;
  const introActive = isIntroActive(introElapsed, reducedMotion);

  const flashes = useCompletionFlashes(puzzle, state, now);
  const flashing = [...flashes.values()].some(at => now - at < COMPLETE_FLASH_MS);

  // The clock runs for the arrival wave and for a completion flash, and
  // then stops. There is no idle animation on this board on purpose.
  const solveFlareAt = useSolveFlares(solved, now);
  const solveFlaring =
    solveFlareAt !== null && now - solveFlareAt < puzzle.pairs.length * SOLVE_FLARE_STAGGER_MS + COMPLETE_FLASH_MS;
  useAnimationClock(!reducedMotion && (introActive || flashing || solveFlaring));

  const cordWidth = layout.cellSize * 0.3;
  const tokenRadius = layout.cellSize * 0.3;

  return (
    <Group>
      <RoundedRect
        x={0}
        y={0}
        width={layout.boardSize}
        height={layout.boardSize}
        r={layout.cellSize * 0.24}
        color={theme.colors.surface}
      />
      {/* Frozen once the intro is over, so `Tiles` can actually bail out
          of its memo. Passing the live `introElapsed` would hand it a new
          number on every single frame of the solve flare, rebuilding
          every tile on the board to draw the identical thing. */}
      <Tiles
        layout={layout}
        blocked={blocked}
        introElapsed={introActive ? introElapsed : INTRO_TOTAL_MS}
        reducedMotion={reducedMotion}
      />
      <FoldGuide puzzle={puzzle} layout={layout} />
      <Obstacles puzzle={puzzle} layout={layout} />

      {puzzle.pairs.map(pair => {
        const tone = tones.get(pair.value) ?? theme.colors.arukoneAccent;
        const { committed, pending } = runsFor(puzzle, state, pair);
        return (
          <Group key={`run-${pair.value}`}>
            <Cord path={polyline(layout, pending)} tone={tone} width={cordWidth} faded />
            <Cord path={polyline(layout, committed)} tone={tone} width={cordWidth} faded={false} />
          </Group>
        );
      })}

      {/* The solve wave: the same flare, run down every cord in turn. */}
      {solveFlareAt !== null &&
        !reducedMotion &&
        puzzle.pairs.map((pair, index) => {
          const progress = (now - solveFlareAt - index * SOLVE_FLARE_STAGGER_MS) / COMPLETE_FLASH_MS;
          if (progress < 0 || progress >= 1) return null;
          const tone = tones.get(pair.value) ?? theme.colors.arukoneAccent;
          return (
            <Path
              key={`solve-flare-${pair.value}`}
              path={polyline(layout, state.paths[pair.value] ?? [])}
              color={shade(tone, 1.8)}
              opacity={Math.sin(progress * Math.PI) * 0.85}
              style="stroke"
              strokeWidth={cordWidth * (1 + Math.sin(progress * Math.PI) * 0.8)}
              strokeCap="round"
              strokeJoin="round"
            />
          );
        })}

      {/* A completing pair flares once along its whole length. */}
      {puzzle.pairs.map(pair => {
        const startedAt = flashes.get(pair.value);
        if (startedAt === undefined) return null;
        const progress = (now - startedAt) / COMPLETE_FLASH_MS;
        if (reducedMotion || progress >= 1) return null;
        const tone = tones.get(pair.value) ?? theme.colors.arukoneAccent;
        return (
          <Path
            key={`flare-${pair.value}`}
            path={polyline(layout, state.paths[pair.value] ?? [])}
            color={shade(tone, 1.7)}
            opacity={(1 - progress) * 0.7}
            style="stroke"
            strokeWidth={cordWidth * (1 + progress * 0.7)}
            strokeCap="round"
            strokeJoin="round"
          />
        );
      })}

      {puzzle.pairs.flatMap(pair => {
        const tone = tones.get(pair.value) ?? theme.colors.arukoneAccent;
        const joined = isPathComplete(pair, state.paths[pair.value] ?? []);
        return [pair.a, pair.b].map(cell => (
          <Token
            key={`token-${pair.value}-${cellKey(cell)}`}
            center={getCellCenter(layout, cell.row, cell.col)}
            radius={tokenRadius}
            tone={tone}
            joined={joined}
          />
        ));
      })}

      {rejectedCell && (
        <RoundedRect
          x={getCellOrigin(layout, rejectedCell.row, rejectedCell.col).x + layout.cellSize * 0.08}
          y={getCellOrigin(layout, rejectedCell.row, rejectedCell.col).y + layout.cellSize * 0.08}
          width={layout.cellSize * 0.84}
          height={layout.cellSize * 0.84}
          r={layout.cellSize * 0.16}
          color={theme.colors.danger}
          opacity={0.28}
        />
      )}

      <RoundedRect
        x={0.5}
        y={0.5}
        width={layout.boardSize - 1}
        height={layout.boardSize - 1}
        r={layout.cellSize * 0.24}
        color={solved ? theme.colors.arukoneAccent : theme.colors.borderStrong}
        opacity={solved ? 0.9 : 1}
        style="stroke"
        strokeWidth={solved ? 2 : 1}
      />
    </Group>
  );
}

/** The half currently under the player's finger, exported for the touch
 * layer's own accessibility labels. */
export function describePair(puzzle: ArukonePuzzle, state: ArukoneState, pair: ArukonePair): string {
  const half = drawnHalf(puzzle, state, pair);
  if (isPathComplete(pair, state.paths[pair.value] ?? [])) return 'joined';
  if (half.length <= 1) return 'not started';
  return `${half.length} squares drawn`;
}

/** Whether `cell` is one of `pair`'s own two numbers. */
export function isEndpointOf(pair: ArukonePair, cell: ArukoneCell): boolean {
  return sameCell(pair.a, cell) || sameCell(pair.b, cell);
}

/** A single cell's own state, in words - the per-cell counterpart to
 * `describePair`'s whole-pair summary. `ArukoneBoard`'s whole-board
 * `PanResponder` can't sit behind a grid of per-cell `Pressable`s (see its
 * own doc comment: a continuous drag needs the touch layer to have no
 * children), so this doesn't add tappable cells - it labels a
 * `pointerEvents="none"` overlay VoiceOver can still swipe through
 * element-by-element, the same baseline the other five boards' real
 * per-cell `Pressable`s already give for free. */
export function describeCell(puzzle: ArukonePuzzle, state: ArukoneState, row: number, col: number): string {
  const base = `Row ${row + 1}, column ${col + 1}`;
  const key = cellKey({ row, col });
  if (obstacleSet(puzzle).has(key)) return `${base}, blocked`;

  const endpoint = puzzle.pairs.find(pair => isEndpointOf(pair, { row, col }));
  if (endpoint) {
    const joined = isPathComplete(endpoint, state.paths[endpoint.value] ?? []);
    return `${base}, number ${endpoint.value}${joined ? ', joined' : ''}`;
  }

  const owner = occupancy(state).get(key);
  return owner === undefined ? `${base}, empty` : `${base}, part of ${owner}'s path`;
}

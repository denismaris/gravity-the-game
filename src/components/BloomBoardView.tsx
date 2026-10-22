import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Circle, Group, Path, RoundedRect, Skia, SkPath, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { BloomArcStep, BloomCell, BloomEdge, BloomPuzzle, BloomState, joinedArcs, tileArcs, traceLoops } from '../game/bloom';
import { BoardLayout, computeBoardLayout, DealIn, dealDelay, useAnimationClock, useDealing, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { CellWell, PaperTray } from './boardChrome';

/** A quarter turn, eased - short enough that a run of taps never queues
 * up behind itself, long enough to read as the tile turning rather than
 * snapping. */
const TURN_MS = 190;
/** A loop that has just closed opens out from its own centre. */
const BLOOM_MS = 420;
/** The finish: every blossom swells in turn, inside the shared
 * `SOLVE_CELEBRATION_MS` beat. */
const SOLVE_STAGGER_MS = 70;
const SOLVE_SWELL_MS = 300;

const WELL_INSET = 0.07;
/** A line joined at both ends is set in full ink; a loose one is drawn
 * lighter, so progress shows line by line before a loop even closes. */
const lineInk = (): string => theme.colors.primary;
// Opaque - the ink mixed 40/60 with the well's paper - not translucent:
// two translucent round caps meeting at a midpoint doubled up into a dark
// blob exactly where the eye looks to see whether lines connect.
const TURN_WASH = 'rgba(200, 80, 106, 0.16)'; // bloomAccent, faint

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

function edgeMidpoint(layout: BoardLayout, row: number, col: number, e: BloomEdge): { x: number; y: number } {
  const s = layout.cellSize;
  const x = col * s;
  const y = row * s;
  if (e === 0) return { x: x + s / 2, y };
  if (e === 1) return { x: x + s, y: y + s / 2 };
  if (e === 2) return { x: x + s / 2, y: y + s };
  return { x, y: y + s / 2 };
}

/** The corner an arc between two adjacent edges wraps - its centre. */
function arcCorner(layout: BoardLayout, row: number, col: number, a: BloomEdge, b: BloomEdge): { x: number; y: number } {
  const s = layout.cellSize;
  const north = a === 0 || b === 0;
  const west = a === 3 || b === 3;
  return { x: (west ? col : col + 1) * s, y: (north ? row : row + 1) * s };
}

/** SVG for one quarter arc from edge `from` to edge `to`, continuing a
 * path already standing at `from`'s midpoint. */
function arcTo(layout: BoardLayout, step: BloomArcStep): string {
  const p0 = edgeMidpoint(layout, step.row, step.col, step.from);
  const p1 = edgeMidpoint(layout, step.row, step.col, step.to);
  const c = arcCorner(layout, step.row, step.col, step.from, step.to);
  // Screen y points down, so a positive cross product is a clockwise turn.
  const cross = (p0.x - c.x) * (p1.y - c.y) - (p0.y - c.y) * (p1.x - c.x);
  const r = layout.cellSize / 2;
  return `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${cross > 0 ? 1 : 0} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

function arcSvg(layout: BoardLayout, row: number, col: number, a: BloomEdge, b: BloomEdge): string {
  const p0 = edgeMidpoint(layout, row, col, a);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${arcTo(layout, { row, col, from: a, to: b })}`;
}

function loopSvg(layout: BoardLayout, loop: ReadonlyArray<BloomArcStep>): string {
  const start = edgeMidpoint(layout, loop[0].row, loop[0].col, loop[0].from);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ${loop.map(step => arcTo(layout, step)).join(' ')} Z`;
}

/** A loop's identity: the set of arcs it is made of, whichever one the
 * trace happened to start from. */
function loopKey(loop: ReadonlyArray<BloomArcStep>): string {
  return loop
    .map(step => `${step.row}:${step.col}:${Math.min(step.from, step.to)}${Math.max(step.from, step.to)}`)
    .sort()
    .join('|');
}

/** Parsed once, handed to Skia as an object - so a frame that only moves
 * a transform never re-parses path text. */
function toPath(svg: string): SkPath | null {
  return svg ? Skia.Path.MakeFromSVGString(svg) : null;
}

/** `a` moved `t` of the way toward `b`, both `#RRGGBB`. */
function mix(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0'));
  return `#${out.join('')}`;
}

/** A closed loop's colour: this game's own, softened a little toward the
 * paper, so a large loop reads as colour laid in rather than a solid
 * block. From `bloomAccent`, so a skin recolours it. */
function fillTone(): string {
  return mix(theme.colors.bloomAccent, theme.colors.surfaceHi, 0.22);
}

/** When each loop first closed, keyed by `loopKey`. Seeded silently on
 * mount, so a board opened with loops already closed does not bloom them
 * all at once. */
function useLoopOpenings(keys: ReadonlyArray<string>, now: number): Map<string, number> {
  const seededRef = useRef(false);
  const openedRef = useRef(new Map<string, number>());
  const live = new Set(keys);
  for (const key of [...openedRef.current.keys()]) if (!live.has(key)) openedRef.current.delete(key);
  for (const key of keys) if (!openedRef.current.has(key)) openedRef.current.set(key, seededRef.current ? now : -Infinity);
  seededRef.current = true;
  return openedRef.current;
}

/** One non-empty tile's ink, parsed and split by whether it is joined. */
interface TileInk {
  readonly turns: boolean;
  readonly rotation: number;
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly joined: SkPath | null;
  readonly loose: SkPath | null;
}

// --- Static layers: each re-renders only when its own inputs change, which
// during an animation frame is never. -------------------------------------

const StaticWells = React.memo(function StaticWellsImpl({ size, layout }: { size: number; layout: BoardLayout }) {
  const inset = layout.cellSize * WELL_INSET;
  const well = layout.cellSize - inset * 2;
  return (
    <Group>
      <PaperTray width={layout.boardSize} height={layout.boardSize} accent={theme.colors.bloomAccent} />
      {Array.from({ length: size }, (_v, r) =>
        Array.from({ length: size }, (_v2, c) => (
          <CellWell key={`w-${r}-${c}`} x={c * layout.cellSize + inset} y={r * layout.cellSize + inset} size={well} r={well * 0.22} />
        )),
      )}
    </Group>
  );
});

const StaticFill = React.memo(function StaticFillImpl({ path }: { path: SkPath | null }) {
  return path ? <Path path={path} color={fillTone()} fillType="evenOdd" /> : null;
});

/**
 * One tile's line, turning on the UI thread. An arc tile is drawn once in
 * its unturned facing and the whole drawing is turned to where it points,
 * so a tap changes only an angle: the turn eases on, overshoots a hair and
 * settles, every frame on the UI thread. (It used to be redrawn from a
 * JavaScript clock sixty times a second, which stuttered on a phone.) The
 * well behind it flushes rose as it turns.
 */
const TileView = React.memo(function TileViewImpl({
  turns,
  rotation,
  base,
  cx,
  cy,
  wellSize,
  strokeWidth,
  reducedMotion,
}: {
  /** Whether this tile turns at all (a loose arc). */
  turns: boolean;
  rotation: number;
  /** The tile's arcs at rotation 0 (turning tiles) or as they lie (others),
   * split by whether each is joined. */
  base: { joined: SkPath | null; loose: SkPath | null };
  cx: number;
  cy: number;
  wellSize: number;
  strokeWidth: number;
  reducedMotion: boolean;
}) {
  const quarter = Math.PI / 2;
  const count = useRef(rotation);
  const angle = useSharedValue(turns ? rotation * quarter : 0);
  const flush = useSharedValue(0);
  useLayoutEffect(() => {
    if (!turns) return;
    const step = (((rotation - count.current) % 4) + 4) % 4;
    if (step === 0) return;
    count.current += step;
    const to = count.current * quarter;
    if (reducedMotion) {
      angle.value = to;
      return;
    }
    // A tap turns one quarter; a hint may turn two or three - the same
    // easy swing, a little longer, never a jump.
    angle.value = withTiming(to, { duration: TURN_MS * (1 + (step - 1) * 0.45), easing: Easing.out(Easing.back(1.4)) });
    flush.value = 1;
    flush.value = withTiming(0, { duration: TURN_MS + 120, easing: Easing.out(Easing.cubic) });
  }, [rotation, turns, reducedMotion, angle, flush, quarter]);
  const transform = useDerivedValue(() => [{ rotate: angle.value }]);
  return (
    <Group>
      <RoundedRect x={cx - wellSize / 2} y={cy - wellSize / 2} width={wellSize} height={wellSize} r={wellSize * 0.22} color={TURN_WASH} opacity={flush} />
      <Group origin={vec(cx, cy)} transform={transform}>
        {base.loose && <Path path={base.loose} color={theme.colors.bloomLooseInk} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />}
        {base.joined && <Path path={base.joined} color={lineInk()} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />}
      </Group>
    </Group>
  );
});

/** Pins, and the tray's own rim drawn back over the ink - so a line that
 * reaches the edge runs *under* the frame instead of being sliced off by
 * the canvas boundary. */
const StaticTop = React.memo(function StaticTopImpl({ puzzle, layout }: { puzzle: BloomPuzzle; layout: BoardLayout }) {
  const pinRadius = Math.max(2.5, layout.cellSize * 0.06);
  const pins: React.JSX.Element[] = [];
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      // Anything that will never turn - a knot, or a pinned clue - wears a
      // small ochre pin at its centre, so it can be read at a glance.
      if (puzzle.kinds[r][c] === 'knot' || puzzle.pinned[r][c]) {
        pins.push(
          <Circle key={`p-${r}-${c}`} cx={(c + 0.5) * layout.cellSize} cy={(r + 0.5) * layout.cellSize} r={pinRadius} color={theme.colors.accent} />,
        );
      }
    }
  }
  // Twin tiles wear matching marks at their hearts, one ring per pair
  // number (one for the first pair, two for the second).
  (puzzle.twins ?? []).forEach((t, k) =>
    [t.a, t.b].forEach((cell, side) => {
      const cx = (cell.col + 0.5) * layout.cellSize;
      const cy = (cell.row + 0.5) * layout.cellSize;
      const w = Math.max(1.5, layout.cellSize * 0.035);
      Array.from({ length: k + 1 }, (_v, n) =>
        pins.push(<Circle key={`t-${k}-${side}-${n}`} cx={cx} cy={cy} r={layout.cellSize * (0.1 + n * 0.07)} color={theme.colors.bloomAccent} style="stroke" strokeWidth={w} />),
      );
    }),
  );
  const { boardSize } = layout;
  return (
    <Group>
      {pins}
      <RoundedRect x={1} y={1} width={boardSize - 2} height={boardSize - 2} r={9} color={theme.colors.surfaceHi} style="stroke" strokeWidth={4} />
      <RoundedRect x={1} y={1} width={boardSize - 2} height={boardSize - 2} r={9} color={theme.colors.bloomAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
});

export interface BloomBoardViewProps {
  puzzle: BloomPuzzle;
  state: BloomState;
  size: number;
  solved: boolean;
  flashCell?: BloomCell | null;
}

/**
 * Bloom's board: curved line on paper wells, and the colour that fills a
 * loop the moment it closes. Pure presentation - rules live in
 * `src/game/bloom`.
 *
 * Built for a smooth turn. Every path is parsed once per *move* (into Skia
 * path objects) and everything that is not moving sits in a memoised
 * layer, so an animation frame renders only the tile that is turning and
 * any blossom that is opening - and those only change a transform. An
 * earlier version rebuilt and re-parsed every tile, loop and pin on every
 * frame, which is what made a turn stutter on a real device. No idle
 * motion at all: the clock runs only while something moves.
 */
export function BloomBoardView({ puzzle, state, size, solved, flashCell }: BloomBoardViewProps): React.JSX.Element {
  const dealing = useDealing();
  const layout = useMemo(() => computeBoardLayout(puzzle.rows, size), [puzzle.rows, size]);
  const reducedMotion = useReducedMotion();
  const now = Date.now();

  // --- Per move (not per frame) -------------------------------------------
  const loops = useMemo(() => traceLoops(puzzle, state).loops, [puzzle, state]);
  const loopGeometry = useMemo(
    () =>
      loops.map(loop => {
        const svg = loopSvg(layout, loop);
        return { key: loopKey(loop), svg, path: toPath(svg) };
      }),
    [loops, layout],
  );
  const ink = useMemo<TileInk[]>(() => {
    const joined = joinedArcs(puzzle, state);
    const tiles: TileInk[] = [];
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        // A tile that turns is drawn unturned and turned as a whole by
        // `TileView`; a knot or a pinned arc is drawn as it lies.
        const turns = puzzle.kinds[r][c] === 'arc' && !puzzle.pinned[r][c];
        const arcs = tileArcs(puzzle.kinds[r][c], turns ? 0 : state.rotations[r][c]);
        if (arcs.length === 0) continue;
        let joinedSvg = '';
        let looseSvg = '';
        arcs.forEach(([a, b], i) => {
          const svg = arcSvg(layout, r, c, a, b);
          if (joined[r][c][i]) joinedSvg += ` ${svg}`;
          else looseSvg += ` ${svg}`;
        });
        tiles.push({
          key: `${r}:${c}`,
          turns,
          rotation: state.rotations[r][c],
          cx: (c + 0.5) * layout.cellSize,
          cy: (r + 0.5) * layout.cellSize,
          joined: toPath(joinedSvg.trim()),
          loose: toPath(looseSvg.trim()),
        });
      }
    }
    return tiles;
  }, [puzzle, state, layout]);

  // --- Per frame: only timing, and only for what is moving ----------------
  const keys = useMemo(() => loopGeometry.map(loop => loop.key), [loopGeometry]);
  const openedAt = useLoopOpenings(keys, now);

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = now;
  if (!solved) solvedAtRef.current = null;
  const solvedAt = solvedAtRef.current;

  const finishing = !reducedMotion && solvedAt !== null && now - solvedAt < loops.length * SOLVE_STAGGER_MS + SOLVE_SWELL_MS;

  const movingLoops: Array<{ key: string; path: SkPath | null; opacity: number }> = [];
  const settledSvg: string[] = [];
  loopGeometry.forEach((loop, index) => {
    // A loop that closes takes its colour in place - a fade, with nothing
    // growing or moving, since the line around it stays exactly where it
    // is. The finish passes one soft breath of colour over each in turn.
    let opacity = 1;
    if (!reducedMotion) {
      const since = now - (openedAt.get(loop.key) ?? -Infinity);
      if (since < BLOOM_MS) opacity = easeOutCubic(clamp01(since / BLOOM_MS));
      if (finishing) {
        const t = (now - solvedAt! - index * SOLVE_STAGGER_MS) / SOLVE_SWELL_MS;
        if (t > 0 && t < 1) opacity *= 1 - 0.3 * Math.sin(t * Math.PI);
      }
    }
    if (opacity === 1) settledSvg.push(loop.svg);
    else movingLoops.push({ key: loop.key, path: loop.path, opacity });
  });
  // Joined as text, parsed only when the settled set actually changes.
  const settledKey = settledSvg.join(' ');
  const settledPath = useMemo(() => toPath(settledKey), [settledKey]);

  useAnimationClock(!reducedMotion && (movingLoops.length > 0 || finishing), 60);

  const strokeWidth = Math.max(3, layout.cellSize * 0.1);
  const inset = layout.cellSize * WELL_INSET;
  const well = layout.cellSize - inset * 2;

  return (
    <Group>
      <StaticWells size={puzzle.rows} layout={layout} />

      <StaticFill path={settledPath} />
      {movingLoops.map(loop =>
        loop.path ? <Path key={loop.key} path={loop.path} color={fillTone()} fillType="evenOdd" opacity={loop.opacity} /> : null,
      )}

      {flashCell && (
        <RoundedRect
          x={flashCell.col * layout.cellSize + 2}
          y={flashCell.row * layout.cellSize + 2}
          width={layout.cellSize - 4}
          height={layout.cellSize - 4}
          r={layout.cellSize * 0.2}
          color={theme.colors.accent}
          opacity={0.35}
        />
      )}

      {ink.map(tile => {
        const [r, c] = tile.key.split(':').map(Number);
        // Dealt onto the board as it opens, corner to corner.
        return (
          <DealIn key={tile.key} x={tile.cx} y={tile.cy} delay={dealDelay(Math.max(r, c), Math.max(puzzle.rows, puzzle.cols) - 1)} dealing={dealing}>
            <TileView
              turns={tile.turns}
              rotation={tile.rotation}
              base={tile}
              cx={tile.cx}
              cy={tile.cy}
              wellSize={well}
              strokeWidth={strokeWidth}
              reducedMotion={reducedMotion}
            />
          </DealIn>
        );
      })}

      <StaticTop puzzle={puzzle} layout={layout} />
    </Group>
  );
}

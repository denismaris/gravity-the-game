import React, { useMemo, useRef } from 'react';
import { Circle, Group, Path, RoundedRect, Skia, SkPath, vec } from '@shopify/react-native-skia';
import { BloomArcStep, BloomCell, BloomEdge, BloomPuzzle, BloomState, joinedArcs, tileArcs, traceLoops } from '../game/bloom';
import { BoardLayout, computeBoardLayout, useAnimationClock, useReducedMotion } from '../game/rendering';
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
const INK = theme.colors.primary;
// Opaque - the ink mixed 40/60 with the well's paper - not translucent:
// two translucent round caps meeting at a midpoint doubled up into a dark
// blob exactly where the eye looks to see whether lines connect.
const LOOSE_INK = '#B1A4B6';
const TURN_WASH = 'rgba(200, 80, 106, 0.16)'; // bloomAccent, faint

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
/** A little overshoot, so a turning tile and an opening blossom both land
 * with a settle rather than a dead stop. */
function easeOutBack(t: number): number {
  const c = 1.2;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

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

function loopCentre(layout: BoardLayout, loop: ReadonlyArray<BloomArcStep>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const step of loop) {
    x += (step.col + 0.5) * layout.cellSize;
    y += (step.row + 0.5) * layout.cellSize;
  }
  return { x: x / loop.length, y: y / loop.length };
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

/** When each tile last turned, and how far it still has to swing - so a
 * second tap mid-turn adds to the swing instead of snapping. */
interface Turn {
  readonly at: number;
  readonly fromDegrees: number;
}

function turnOffset(turn: Turn | undefined, now: number): number {
  if (!turn) return 0;
  const t = clamp01((now - turn.at) / TURN_MS);
  return t >= 1 ? 0 : turn.fromDegrees * (1 - easeOutBack(t));
}

function useTurns(rotations: BloomState['rotations'], now: number): Map<string, Turn> {
  const previousRef = useRef<BloomState['rotations'] | null>(null);
  const turnsRef = useRef(new Map<string, Turn>());
  if (previousRef.current !== rotations) {
    const previous = previousRef.current;
    if (previous) {
      for (let r = 0; r < rotations.length; r += 1) {
        for (let c = 0; c < rotations[r].length; c += 1) {
          if (previous[r][c] === rotations[r][c]) continue;
          const key = `${r}:${c}`;
          // A single quarter clockwise is a tap; anything else (a hint, a
          // restart) jumps straight there.
          if ((previous[r][c] + 1) % 4 === rotations[r][c] % 4) {
            turnsRef.current.set(key, { at: now, fromDegrees: turnOffset(turnsRef.current.get(key), now) - 90 });
          } else {
            turnsRef.current.delete(key);
          }
        }
      }
    }
    previousRef.current = rotations;
  }
  return turnsRef.current;
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
  return path ? <Path path={path} color={theme.colors.bloomAccent} fillType="evenOdd" /> : null;
});

/** Every tile not currently mid-turn. `activeKeys` is a string so the
 * shallow memo comparison holds across frames where the set is unchanged. */
const StaticTiles = React.memo(function StaticTilesImpl({
  ink,
  activeKeys,
  strokeWidth,
}: {
  ink: ReadonlyArray<TileInk>;
  activeKeys: string;
  strokeWidth: number;
}) {
  const skip = useMemo(() => new Set(activeKeys ? activeKeys.split(',') : []), [activeKeys]);
  return (
    <Group>
      {ink.map(tile => (skip.has(tile.key) ? null : <TileStrokes key={tile.key} tile={tile} strokeWidth={strokeWidth} />))}
    </Group>
  );
});

function TileStrokes({ tile, strokeWidth }: { tile: TileInk; strokeWidth: number }): React.JSX.Element {
  return (
    <>
      {tile.loose && <Path path={tile.loose} color={LOOSE_INK} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />}
      {tile.joined && <Path path={tile.joined} color={INK} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />}
    </>
  );
}

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
  const layout = useMemo(() => computeBoardLayout(puzzle.rows, size), [puzzle.rows, size]);
  const reducedMotion = useReducedMotion();
  const now = Date.now();

  // --- Per move (not per frame) -------------------------------------------
  const loops = useMemo(() => traceLoops(puzzle, state).loops, [puzzle, state]);
  const loopGeometry = useMemo(
    () =>
      loops.map(loop => {
        const svg = loopSvg(layout, loop);
        return { key: loopKey(loop), svg, path: toPath(svg), centre: loopCentre(layout, loop) };
      }),
    [loops, layout],
  );
  const ink = useMemo<TileInk[]>(() => {
    const joined = joinedArcs(puzzle, state);
    const tiles: TileInk[] = [];
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        const arcs = tileArcs(puzzle.kinds[r][c], state.rotations[r][c]);
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
  const turns = useTurns(state.rotations, now);
  const keys = useMemo(() => loopGeometry.map(loop => loop.key), [loopGeometry]);
  const openedAt = useLoopOpenings(keys, now);

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = now;
  if (!solved) solvedAtRef.current = null;
  const solvedAt = solvedAtRef.current;

  const turningKeys: string[] = [];
  if (!reducedMotion) for (const [key, turn] of turns) if (now - turn.at < TURN_MS) turningKeys.push(key);
  const finishing = !reducedMotion && solvedAt !== null && now - solvedAt < loops.length * SOLVE_STAGGER_MS + SOLVE_SWELL_MS;

  const movingLoops: Array<{ key: string; path: SkPath | null; centre: { x: number; y: number }; scale: number; opacity: number }> = [];
  const settledSvg: string[] = [];
  loopGeometry.forEach((loop, index) => {
    let scale = 1;
    let opacity = 1;
    if (!reducedMotion) {
      const since = now - (openedAt.get(loop.key) ?? -Infinity);
      if (since < BLOOM_MS) {
        const t = clamp01(since / BLOOM_MS);
        scale = 0.25 + 0.75 * easeOutBack(t);
        opacity = easeOutCubic(clamp01(t * 1.8));
      }
      if (finishing) {
        const t = (now - solvedAt! - index * SOLVE_STAGGER_MS) / SOLVE_SWELL_MS;
        if (t > 0 && t < 1) scale *= 1 + 0.07 * Math.sin(t * Math.PI);
      }
    }
    if (scale === 1 && opacity === 1) settledSvg.push(loop.svg);
    else movingLoops.push({ key: loop.key, path: loop.path, centre: loop.centre, scale, opacity });
  });
  // Joined as text, parsed only when the settled set actually changes.
  const settledKey = settledSvg.join(' ');
  const settledPath = useMemo(() => toPath(settledKey), [settledKey]);

  useAnimationClock(!reducedMotion && (turningKeys.length > 0 || movingLoops.length > 0 || finishing), 60);

  const strokeWidth = Math.max(3, layout.cellSize * 0.1);
  const activeKeys = turningKeys.join(',');
  const inset = layout.cellSize * WELL_INSET;
  const well = layout.cellSize - inset * 2;

  return (
    <Group>
      <StaticWells size={puzzle.rows} layout={layout} />

      {/* The touched tile's well flushes faintly rose while it turns - an
          answer to the finger as well as to the eye. */}
      {turningKeys.map(key => {
        const [r, c] = key.split(':').map(Number);
        const t = clamp01((now - turns.get(key)!.at) / TURN_MS);
        return (
          <RoundedRect
            key={`wash-${key}`}
            x={c * layout.cellSize + inset}
            y={r * layout.cellSize + inset}
            width={well}
            height={well}
            r={well * 0.22}
            color={TURN_WASH}
            opacity={1 - easeOutCubic(t)}
          />
        );
      })}

      <StaticFill path={settledPath} />
      {movingLoops.map(loop =>
        loop.path ? (
          <Group key={loop.key} origin={vec(loop.centre.x, loop.centre.y)} transform={[{ scale: loop.scale }]} opacity={loop.opacity}>
            <Path path={loop.path} color={theme.colors.bloomAccent} fillType="evenOdd" />
          </Group>
        ) : null,
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

      <StaticTiles ink={ink} activeKeys={activeKeys} strokeWidth={strokeWidth} />
      {turningKeys.map(key => {
        const tile = ink.find(candidate => candidate.key === key);
        if (!tile) return null;
        const degrees = turnOffset(turns.get(key), now);
        return (
          <Group key={`turn-${key}`} origin={vec(tile.cx, tile.cy)} transform={[{ rotate: (degrees * Math.PI) / 180 }]}>
            <TileStrokes tile={tile} strokeWidth={strokeWidth} />
          </Group>
        );
      })}

      <StaticTop puzzle={puzzle} layout={layout} />
    </Group>
  );
}

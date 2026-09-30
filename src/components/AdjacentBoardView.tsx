import React, { useMemo, useRef } from 'react';
import { Circle, DashPathEffect, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { AdjacentCoord, AdjacentFall, AdjacentPuzzle, AdjacentState } from '../game/adjacent';
import { shade, useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme, inkWash } from '../theme';

/**
 * Adjacent's tray.
 *
 * Rebuilt once, after the first version was called unpolished next to
 * this app's other boards, and the comparison was fair. What it was
 * missing was not detail on the *tiles* - it was everything around them.
 * Binairo, the closest light-ground board here, works because every cell
 * is a framed well with a hairline rule, its tokens sit *inside* those
 * wells with paper visible all round, and the panel itself carries a
 * double rule. Colour is an accent on a paper ground. The first Adjacent
 * board instead filled each cell edge to edge with flat colour on an
 * unruled slab, which inverted that ratio: five saturated hues covering
 * most of the board, and nothing structural holding them. Same palette,
 * wrong proportion.
 *
 * So the tiles are inset inside ruled wells, the wells are drawn for
 * empty squares too (an empty square is a slot in a sorting tray, not a
 * hole), and the tray takes Binairo's own panel treatment.
 */

/** Gap between a cell's bounds and its well. */
const WELL_GAP = 1.5;
/** How much of a well a tile actually covers. Paper stays visible all
 * round it - that margin is the single biggest reason this reads as the
 * same hand as the rest of the app. */
export const TILE_SCALE = 0.72;
/**
 * The tile's extruded side face: a darker copy of its own glaze, pushed
 * down-right toward the same upper-left light every board here shades
 * from.
 *
 * This replaced a translucent drop shadow *plus* a lighter band across
 * the tile's top third, and both of those were the wrong register by
 * this project's own standing rule - a bevel gradient or a "white top
 * edge" on a flat tile is named there as a depth cue that does not work
 * here, while an offset side face is the one that does. It is also what
 * Skyscrapers' buildings already use. A chip of glazed clay, not a
 * plastic counter with a highlight painted on.
 */
const SIDE_FACE_OFFSET = 0.075;
const SIDE_FACE_SHADE = 0.58;
/** The mark stamped into the glaze - a lighter tint of the tile's own
 * colour rather than paper white, which at five colours across a full
 * tray was the loudest thing on the board. */
const GLYPH_SHADE = 1.52;

/**
 * Timings, tightened after the game was reported as laggy.
 *
 * The original beats came straight from the brief - a 200ms preview,
 * then 200ms to clear, then 300ms to fall - and input was locked for the
 * preview. That is seven hundred milliseconds between a tap and a board
 * ready for the next one, in a game whose whole rhythm is tapping runs
 * in quick succession; it read as the game hesitating. The preview is
 * now tied to the finger instead of a timer (see `AdjacentBoard`), and
 * what is left is a clear that gets out of the way and a fall that still
 * has weight.
 */
/** A cleared tile's whole pop, and how much later each step of distance
 * from the tapped tile starts its own - see \`clearing\`. */
const CLEAR_MS = 300;
const CLEAR_RIPPLE_MS = 22;
/** Share of the pop spent swelling before it bursts. */
const CLEAR_SWELL = 0.25;
const FALL_DELAY_MS = 90;
const FALL_MS = 240;

/** The finish: every tile left on the tray fades out in reading order,
 * tuned so the last one lands inside `SOLVE_CELEBRATION_MS` - the beat
 * the completion card waits out before covering the board. On a full
 * 6x6 that is 35 * 8 + 300 = 580ms. */
const SWEEP_STAGGER_MS = 8;
const SWEEP_MS = 300;

/** The four ways a cleared tile's chips fly - the diagonals, slightly
 * uneven so a burst never looks stamped out of a template. */
const CHIP_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-0.78, -0.62],
  [0.72, -0.7],
  [-0.66, 0.74],
  [0.8, 0.6],
];

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * A drop, not a slide.
 *
 * Falling accelerates, so the bulk of this is `t^2` - a linear or
 * ease-out fall reads as a tile being *lowered*, which is the single
 * thing that most made an early version of this board feel weightless.
 * The last stretch decelerates hard, so the tile arrives and settles
 * rather than stopping dead at full speed. Deliberately not a bounce:
 * this app's motion is restrained everywhere else.
 */
function fallEase(t: number): number {
  const c = clamp01(t);
  if (c < 0.82) {
    const a = c / 0.82;
    return a * a * 0.94;
  }
  const b = (c - 0.82) / 0.18;
  return 0.94 + 0.06 * (1 - (1 - b) ** 2);
}

const tileColors = (): ReadonlyArray<string> => [
  theme.colors.adjacentTile0,
  theme.colors.adjacentTile1,
  theme.colors.adjacentTile2,
  theme.colors.adjacentTile3,
  theme.colors.adjacentTile4,
];

export function adjacentTileColor(colour: number): string {
  const palette = tileColors();
  return palette[colour % palette.length];
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export interface AdjacentLayout {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A square tray, fitted to whichever budget is tighter.
 *
 * Worth recording, because the obvious-looking alternative was tried and
 * was wrong: this briefly cropped the rows above the tallest dealt
 * column, on the reasoning that a 40%-full easy tray should not draw a
 * band of empty squares. It made the board *smaller* without buying
 * anything - the tray is width-constrained on a phone, so losing rows
 * only shortened it and handed the difference back to the page as bare
 * paper, which is the worse trade in this app. Binairo settles the
 * question: its board is well over half empty cells and reads as
 * premium, because an empty cell there is a framed well rather than a
 * blank. Once the wells were drawn properly here the empty rows stopped
 * being the problem, and the full square tray is simply bigger.
 */
export function computeAdjacentLayout(puzzle: AdjacentPuzzle, availableWidth: number, availableHeight: number): AdjacentLayout {
  const size = puzzle.size;
  const cell = Math.max(0, Math.min(Math.floor(availableWidth), Math.floor(availableHeight)) / size);
  return { cell, cols: size, rows: size, width: cell * size, height: cell * size };
}

/**
 * The mark cut into each glaze.
 *
 * Every tile carries a different shape as well as a different colour, so
 * the board is readable without relying on hue at all - terracotta and
 * green are the classic red-green confusable pair and this board puts
 * them side by side. Knocked out in the tray's own colour rather than
 * drawn in a second ink, the same rule `GameEmblem` follows.
 */
function TileGlyph({ colour, cx, cy, r }: { colour: number; cx: number; cy: number; r: number }): React.JSX.Element {
  const ink = shade(adjacentTileColor(colour), GLYPH_SHADE);
  switch (colour % 5) {
    case 0:
      return <Circle cx={cx} cy={cy} r={r * 0.6} color={ink} />;
    case 1:
      return (
        <Path
          path={`M ${cx} ${cy - r * 0.76} L ${cx + r * 0.76} ${cy} L ${cx} ${cy + r * 0.76} L ${cx - r * 0.76} ${cy} Z`}
          color={ink}
        />
      );
    case 2:
      return (
        <Path
          path={`M ${cx} ${cy - r * 0.7} L ${cx + r * 0.7} ${cy + r * 0.54} L ${cx - r * 0.7} ${cy + r * 0.54} Z`}
          color={ink}
        />
      );
    case 3:
      return <RoundedRect x={cx - r * 0.78} y={cy - r * 0.25} width={r * 1.56} height={r * 0.5} r={r * 0.25} color={ink} />;
    default:
      return <Circle cx={cx} cy={cy} r={r * 0.58} color={ink} style="stroke" strokeWidth={Math.max(1.4, r * 0.24)} />;
  }
}

/** One cell's well - drawn for every square, tile or not. */
function Well({ x, y, cell, empty }: { x: number; y: number; cell: number; empty: boolean }): React.JSX.Element {
  const size = cell - WELL_GAP * 2;
  const left = x + WELL_GAP;
  const top = y + WELL_GAP;
  const radius = size * 0.2;
  return (
    <Group>
      <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={theme.colors.surfaceHi} />
      <RoundedRect
        x={left}
        y={top}
        width={size}
        height={size}
        r={radius}
        color={theme.colors.border}
        style="stroke"
        strokeWidth={1}
      />
      {/* An empty slot says so, the way Binairo's empty cells do - a
          dashed ring, not a blank. A slot waiting to be refilled and a
          hole in the tray look very different, and only one of them
          looks finished. */}
      {empty && (
        <Circle
          cx={left + size / 2}
          cy={top + size / 2}
          r={size * 0.26}
          color={theme.colors.borderStrong}
          style="stroke"
          strokeWidth={1.1}
          opacity={0.55}
        >
          <DashPathEffect intervals={[3, 3]} />
        </Circle>
      )}
    </Group>
  );
}

interface TileProps {
  colour: number;
  /** Top-left of the cell this tile is drawn in - already offset for a
   * fall by the time it reaches here. */
  x: number;
  y: number;
  cell: number;
  /** 1 at rest; below 1 while clearing. */
  scale?: number;
  opacity?: number;
  /** The run under the player's finger, a moment before it clears. */
  highlighted?: boolean;
}

function Tile({ colour, x, y, cell, scale = 1, opacity = 1, highlighted = false }: TileProps): React.JSX.Element {
  const full = cell * TILE_SCALE;
  const size = full * scale;
  const left = x + (cell - size) / 2;
  const top = y + (cell - size) / 2;
  const radius = size * 0.28;
  const base = adjacentTileColor(colour);
  const face = highlighted ? shade(base, 1.18) : base;
  const offset = cell * SIDE_FACE_OFFSET;

  return (
    <Group opacity={opacity}>
      {/* A solid block, the same way Mosaic's tesserae are drawn: a flat
          shadow on the well, then its thickness showing as a lighter
          right face and a darker bottom face - lit from the top-left -
          then the glazed top. Geometry only, no gradient. */}
      <RoundedRect x={left + offset * 1.2} y={top + offset * 2} width={size} height={size} r={radius} color={inkWash(0.14)} />
      <RoundedRect x={left + offset * 0.55} y={top + offset * 0.4} width={size} height={size} r={radius} color={shade(base, 0.76)} />
      <RoundedRect x={left + offset * 0.25} y={top + offset} width={size} height={size} r={radius} color={shade(base, SIDE_FACE_SHADE)} />
      {/* The top face - flat, matte, one colour. */}
      <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={face} />
      <TileGlyph colour={colour} cx={left + size / 2} cy={top + size / 2} r={size * 0.26} />
      {highlighted && (
        <RoundedRect
          x={left - 2}
          y={top - 2}
          width={size + 4}
          height={size + 4}
          r={radius + 2}
          color={theme.colors.adjacentAccent}
          style="stroke"
          strokeWidth={2}
        />
      )}
    </Group>
  );
}

/**
 * The tray itself - panel, lit edge, inner rule and accent rim.
 *
 * Memoized on its own size, which is the only thing it depends on.
 * Without this the gradient and all four strokes were rebuilt on every
 * one of the sixty frames a second the fall asks for, to draw exactly
 * the same rectangle each time.
 */
const TrayChrome = React.memo(function TrayChromeImpl({ width, height }: { width: number; height: number }) {
  return (
    <Group>
      <RoundedRect x={0} y={0} width={width} height={height} r={12}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width, height)}
          colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]}
          positions={[0, 0.55, 1]}
        />
      </RoundedRect>
      <Path
        path={`M 1.5 ${height - 12} L 1.5 12 Q 1.5 1.5 12 1.5 L ${width - 12} 1.5`}
        color="rgba(255,255,255,0.9)"
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
      />
      <RoundedRect x={2.5} y={2.5} width={width - 5} height={height - 5} r={10} color={inkWash(0.16)} style="stroke" strokeWidth={1} />
    </Group>
  );
});

/** The accent rim, drawn last so it sits over the tiles' own edges. */
const TrayRim = React.memo(function TrayRimImpl({ width, height }: { width: number; height: number }) {
  return (
    <RoundedRect
      x={1}
      y={1}
      width={width - 2}
      height={height - 2}
      r={11}
      color={theme.colors.adjacentAccent}
      style="stroke"
      strokeWidth={1.5}
      opacity={0.55}
    />
  );
});

interface StaticTilesProps {
  layout: AdjacentLayout;
  grid: AdjacentState['grid'];
  /** Comma-joined keys the animated layer owns this frame - the same
   * primitive-string-prop idiom `StaticLights` uses so `React.memo` can
   * actually bail out between clock ticks. */
  activeKeys: string;
  previewKeys: string;
}

/**
 * Every well, and every settled tile. Memoized away from the animation
 * clock from the outset: a move touches a handful of cells, and
 * redrawing all forty-nine wells on every frame of a fall is exactly the
 * waste that had to be retrofitted out of two earlier boards here.
 */
const StaticTiles = React.memo(function StaticTilesImpl({ layout, grid, activeKeys, previewKeys }: StaticTilesProps) {
  const skip = useMemo(() => new Set(activeKeys ? activeKeys.split(',') : []), [activeKeys]);
  const preview = useMemo(() => new Set(previewKeys ? previewKeys.split(',') : []), [previewKeys]);
  const { cell, cols, rows } = layout;

  const nodes: React.JSX.Element[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = cellKey(row, col);
      const colour = grid[row][col];
      const hidden = skip.has(key);
      nodes.push(<Well key={`well-${key}`} x={col * cell} y={row * cell} cell={cell} empty={colour === null || hidden} />);
      if (colour === null || hidden) continue;
      nodes.push(
        <Tile key={`tile-${key}`} colour={colour} x={col * cell} y={row * cell} cell={cell} highlighted={preview.has(key)} />,
      );
    }
  }

  return <Group>{nodes}</Group>;
});

/** A tile that has just been cleared: where it was, and what colour it
 * was, since it is already gone from the grid by the time this renders. */
export interface AdjacentRemoved extends AdjacentCoord {
  readonly colour: number;
}

/** One move's worth of motion, handed down by the screen rather than
 * recovered by diffing - see `AdjacentFall` in the engine for why. */
export interface AdjacentAnimation {
  /** `Date.now()` at the moment the move was applied. */
  readonly at: number;
  readonly removed: ReadonlyArray<AdjacentRemoved>;
  readonly falls: ReadonlyArray<AdjacentFall>;
}

export interface AdjacentBoardViewProps {
  puzzle: AdjacentPuzzle;
  state: AdjacentState;
  /** Pixel budget for the grid - the cell is fitted to the tighter. */
  maxWidth: number;
  maxHeight: number;
  /** The run under the player's finger, highlighted before it clears. */
  preview?: ReadonlyArray<AdjacentCoord> | null;
  animation?: AdjacentAnimation | null;
  solved: boolean;
}

export function AdjacentBoardView({ puzzle, state, maxWidth, maxHeight, preview, animation, solved }: AdjacentBoardViewProps): React.JSX.Element {
  const layout = useMemo(() => computeAdjacentLayout(puzzle, maxWidth, maxHeight), [puzzle, maxWidth, maxHeight]);
  const reducedMotion = useReducedMotion();
  const { cell, width, height } = layout;

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = Date.now();
  if (!solved && solvedAtRef.current !== null) solvedAtRef.current = null;
  const solvedAt = solvedAtRef.current;

  // The clock runs only while a move or the finishing sweep is genuinely
  // in flight, and stops dead the rest of the time - a tray of settled
  // tiles has nothing to animate, and this board has no idle ambience by
  // design.
  const now = Date.now();
  const clearWindow = animation
    ? CLEAR_MS +
      CLEAR_RIPPLE_MS *
        Math.max(0, ...animation.removed.map(t => Math.abs(t.row - animation.removed[0].row) + Math.abs(t.col - animation.removed[0].col)))
    : 0;
  const moveWindow = Math.max(FALL_DELAY_MS + FALL_MS, clearWindow);
  const sweepWindow = SWEEP_MS + puzzle.size * puzzle.size * SWEEP_STAGGER_MS;
  const animating =
    !reducedMotion &&
    ((animation != null && now - animation.at < moveWindow) || (solvedAt !== null && now - solvedAt < sweepWindow));
  useAnimationClock(animating, 60);

  const frame = Date.now();

  /**
   * Tiles on their way down, held at their origin until the drop starts.
   *
   * The `Math.max(0, ...)` is the whole bug fix, and the bug it fixes was
   * bad: this used to return nothing at all during `FALL_DELAY_MS`, which
   * left the static layer free to draw those tiles at the positions they
   * had *already landed on* - the grid is updated the instant the tap
   * applies. So for the first 90ms a falling tile sat at the bottom of
   * its column, then snapped back up to where it came from and fell
   * again. A teleport, followed by the animation, every single move.
   *
   * Holding progress at 0 through the delay draws the tile where it
   * genuinely still is while the cleared run fades out underneath it,
   * which is also the honest reading of the move: the run goes, *then*
   * the column drops.
   */
  const falling = useMemo(() => {
    const map = new Map<string, { fall: AdjacentFall; progress: number }>();
    if (!animation || reducedMotion) return map;
    const since = frame - animation.at;
    if (since < 0 || since >= FALL_DELAY_MS + FALL_MS) return map;
    const progress = fallEase(Math.max(0, since - FALL_DELAY_MS) / FALL_MS);
    for (const fall of animation.falls) map.set(cellKey(fall.toRow, fall.col), { fall, progress });
    return map;
  }, [animation, frame, reducedMotion]);

  /**
   * The clear: each tile swells a little, then pops - shrinking away while
   * four chips of its colour burst outward and fall. It ripples out from
   * the tile that was tapped (the run's first tile), one step of distance
   * at a time, so a big run visibly *spreads* rather than vanishing all at
   * once. A tile whose turn has not come yet is drawn untouched - it is
   * already gone from the grid, so skipping it would make it vanish early.
   */
  const clearing = useMemo(() => {
    if (!animation || reducedMotion || animation.removed.length === 0) return [];
    const since = frame - animation.at;
    if (since < 0) return [];
    const origin = animation.removed[0];
    const out: Array<{ tile: AdjacentRemoved; opacity: number; scale: number; burst: number }> = [];
    for (const tile of animation.removed) {
      const distance = Math.abs(tile.row - origin.row) + Math.abs(tile.col - origin.col);
      const t = (since - distance * CLEAR_RIPPLE_MS) / CLEAR_MS;
      if (t >= 1) continue;
      if (t <= 0) {
        out.push({ tile, opacity: 1, scale: 1, burst: 0 });
        continue;
      }
      const swell = t < CLEAR_SWELL ? 1 + 0.12 * easeOutCubic(t / CLEAR_SWELL) : 1.12 * (1 - ((t - CLEAR_SWELL) / (1 - CLEAR_SWELL)) ** 2);
      out.push({
        tile,
        scale: Math.max(0, swell),
        opacity: t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45,
        burst: t < CLEAR_SWELL ? 0 : (t - CLEAR_SWELL) / (1 - CLEAR_SWELL),
      });
    }
    return out;
  }, [animation, frame, reducedMotion]);

  const sweep = useMemo(() => {
    if (solvedAt === null || reducedMotion) return new Map<string, number>();
    const map = new Map<string, number>();
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (state.grid[row][col] === null) continue;
        const since = frame - solvedAt - (row * puzzle.size + col) * SWEEP_STAGGER_MS;
        if (since < 0) continue;
        map.set(cellKey(row, col), 1 - easeOutCubic(clamp01(since / SWEEP_MS)));
      }
    }
    return map;
  }, [solvedAt, frame, reducedMotion, puzzle.size, state.grid]);

  const activeKeys = useMemo(() => [...new Set([...falling.keys(), ...sweep.keys()])].join(','), [falling, sweep]);
  const previewKeys = useMemo(() => (preview ?? []).map(c => cellKey(c.row, c.col)).join(','), [preview]);

  return (
    <Group>
      {/* The tray, given the same panel treatment Binairo's board uses -
          a near-neutral paper sheen, a white inner highlight along the
          lit edges, a dark inner rule, then this game's own accent rim.
          Four strokes is what makes a rectangle read as a made object
          rather than a filled shape. */}
      <TrayChrome width={width} height={height} />

      <StaticTiles layout={layout} grid={state.grid} activeKeys={activeKeys} previewKeys={previewKeys} />

      {/* Tiles still falling, drawn back toward where they came from. */}
      {[...falling.entries()].map(([key, { fall, progress }]) => {
        const colour = state.grid[fall.toRow][fall.col];
        if (colour === null) return null;
        const y = (fall.fromRow + (fall.toRow - fall.fromRow) * progress) * cell;
        return <Tile key={`fall-${key}`} colour={colour} x={fall.col * cell} y={y} cell={cell} />;
      })}

      {/* Tiles on their way out: the pop, and its chips. */}
      {clearing.map(({ tile, opacity, scale, burst }) => {
        const key = cellKey(tile.row, tile.col);
        const cx = tile.col * cell + cell / 2;
        const cy = tile.row * cell + cell / 2;
        const chip = cell * 0.13;
        const colour = adjacentTileColor(tile.colour);
        return (
          <Group key={`clear-${key}`}>
            {scale > 0.02 && <Tile colour={tile.colour} x={tile.col * cell} y={tile.row * cell} cell={cell} opacity={opacity} scale={scale} />}
            {burst > 0 &&
              CHIP_DIRECTIONS.map(([dx, dy], i) => {
                const reach = cell * 0.62 * easeOutCubic(burst);
                const drop = cell * 0.4 * burst * burst;
                return (
                  <RoundedRect
                    key={`chip-${key}-${i}`}
                    x={cx + dx * reach - chip / 2}
                    y={cy + dy * reach + drop - chip / 2}
                    width={chip}
                    height={chip}
                    r={chip * 0.3}
                    color={colour}
                    opacity={1 - burst}
                  />
                );
              })}
          </Group>
        );
      })}

      {/* The finishing sweep. */}
      {[...sweep.entries()].map(([key, opacity]) => {
        const [row, col] = key.split(':').map(Number);
        const colour = state.grid[row][col];
        if (colour === null) return null;
        return (
          <Tile
            key={`sweep-${key}`}
            colour={colour}
            x={col * cell}
            y={row * cell}
            cell={cell}
            opacity={opacity}
            scale={0.6 + 0.4 * opacity}
          />
        );
      })}

      <TrayRim width={width} height={height} />
    </Group>
  );
}

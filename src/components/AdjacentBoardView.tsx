import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Easing, SharedValue, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { AdjacentCoord, AdjacentFall, AdjacentPuzzle, AdjacentState, GOLD, STONE } from '../game/adjacent';
import { DealClock, DealIn, dealDelay, shade, useAnimationClock, useDealing, useReducedMotion } from '../game/rendering';
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
const WELL_GAP = 3;
/** How much of a well a tile actually covers. Paper stays visible all
 * round it - that margin is the single biggest reason this reads as the
 * same hand as the rest of the app. */
export const TILE_SCALE = 0.84;
/**
 * The tile's extruded side face: a darker copy of its own glaze, pushed
 * straight down, as if lit from above.
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
/** The mark inlaid in the glaze: a pale tint of the tile's own colour set
 * into a shallow cut, whose upper edge shows as a darker lip - enamel in a
 * fired tile, not a sticker on top and not a muddy stamp. */
const GLYPH_SHADE = 1.3;
const GLYPH_LIP_SHADE = 0.74;
/** The fine keyline round the glaze pool, the tile's fired edge. */
const KEYLINE_SHADE = 0.84;
/** The raised pool of glaze on a tile's face, inset from its edge. */
const POOL_INSET = 0.085;
const POOL_SHADE = 1.07;

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
/**
 * A stone dug out from under: it drops to the floor with the rest of the
 * fall, then cracks and breaks apart - four pieces tumbling out and down,
 * a puff of dust - over this long. Anything above it in its column waits
 * until it has broken, then falls into the space it leaves.
 */
const CRUMBLE_MS = 560;
const CLEAR_RIPPLE_MS = 22;
/** Share of the pop spent swelling before it bursts. */
const CLEAR_SWELL = 0.25;
const FALL_DELAY_MS = 90;
const FALL_MS = 240;
/** When the tiles above a breaking stone start to fall: once it has hit
 * the floor and split. */
const COLUMN_HOLD_MS = FALL_DELAY_MS + FALL_MS + Math.round(CRUMBLE_MS * 0.45);

/** The finish: every tile left on the tray fades out in reading order,
 * tuned so the last one lands inside `SOLVE_CELEBRATION_MS` - the beat
 * the completion card waits out before covering the board. On a full
 * 6x6 that is 35 * 8 + 300 = 580ms. */
/** The finish: a ripple out from the middle of the tray, a beat per ring
 * of tiles - each hops and lands back in its place. */
const SWEEP_STAGGER_MS = 85;
const SWEEP_MS = 620;

/** The four ways a cleared tile's chips fly - the diagonals, slightly
 * uneven so a burst never looks stamped out of a template. */
const CHIP_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-0.78, -0.62],
  [0.72, -0.7],
  [-0.66, 0.74],
  [0.8, 0.6],
];

function clamp01(t: number): number {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOutCubic(t: number): number {
  'worklet';
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
  'worklet';
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
  if (colour === STONE) return theme.colors.adjacentStone;
  if (colour === GOLD) return theme.colors.adjacentGold;
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
function TileGlyph({ colour, cx, cy, r, ink = shade(adjacentTileColor(colour), GLYPH_SHADE) }: { colour: number; cx: number; cy: number; r: number; ink?: string }): React.JSX.Element {
  if (colour === STONE) {
    // A stone: a hairline crack and two flecks, cut darker than the face.
    const dark = shade(adjacentTileColor(colour), 0.72);
    return (
      <Group>
        <Path path={`M ${cx - r * 0.8} ${cy - r * 0.35} L ${cx - r * 0.2} ${cy - r * 0.05} L ${cx + r * 0.1} ${cy + r * 0.45} L ${cx + r * 0.7} ${cy + r * 0.6}`} color={dark} style="stroke" strokeWidth={Math.max(1, r * 0.13)} strokeCap="round" strokeJoin="round" />
        <Circle cx={cx + r * 0.55} cy={cy - r * 0.5} r={r * 0.11} color={dark} />
        <Circle cx={cx - r * 0.45} cy={cy + r * 0.55} r={r * 0.08} color={dark} />
      </Group>
    );
  }
  if (colour === GOLD) {
    // Gold: a four-point glint, struck in the gilt's own deep tone.
    const k = r * 0.82;
    const w = r * 0.2;
    return <Path path={`M ${cx} ${cy - k} Q ${cx + w} ${cy - w} ${cx + k} ${cy} Q ${cx + w} ${cy + w} ${cx} ${cy + k} Q ${cx - w} ${cy + w} ${cx - k} ${cy} Q ${cx - w} ${cy - w} ${cx} ${cy - k} Z`} color={ink} />;
  }
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

/** One cell's well - drawn for every square, tile or not: a shallow
 * recess in the tray, with the shadow of its upper rim inside it. No rule
 * round each square and no mark in an empty one - those turned the board
 * into a spreadsheet; one even field of wells lets the chips carry it. */
function Well({ x, y, cell }: { x: number; y: number; cell: number; empty: boolean }): React.JSX.Element {
  const size = cell - WELL_GAP * 2;
  const left = x + WELL_GAP;
  const top = y + WELL_GAP;
  const radius = size * 0.24;
  const rim = Math.max(1.5, size * 0.05);
  return (
    <Group>
      <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={inkWash(0.045)} />
      <RoundedRect x={left + radius * 0.5} y={top + rim * 0.4} width={size - radius} height={rim} r={rim / 2} color={inkWash(0.05)} />
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
  const radius = size * 0.24;
  const base = adjacentTileColor(colour);
  const face = highlighted ? shade(base, 1.14) : base;
  const offset = cell * SIDE_FACE_OFFSET;
  const pool = size * POOL_INSET;
  const gold = colour === GOLD;
  const rim = shade(theme.colors.goldRim, 0.78);
  const cx = left + size / 2;
  const cy = top + size / 2;
  const gr = size * 0.24;
  const lip = Math.max(1, size * 0.03);
  const ink = gold ? shade(theme.colors.goldRim, 0.72) : shade(base, GLYPH_SHADE);

  return (
    <Group opacity={opacity}>
      {/* A solid block, the same way Mosaic's tesserae are drawn: a soft
          shadow on the well, then its thickness as one darker face
          straight below - lit from above - then the glazed top. Geometry
          only, no gradient. (The face used to lean right as well, which
          read as a skewed tile.) */}
      <RoundedRect x={left} y={top + offset * 1.9} width={size} height={size} r={radius} color={inkWash(0.14)} />
      <RoundedRect x={left} y={top + offset} width={size} height={size} r={radius} color={shade(gold ? theme.colors.goldRim : base, SIDE_FACE_SHADE)} />
      {/* The top face, and on it a raised pool of glaze a shade lighter,
          set in from the edge - the rim that is left reads as the tile's
          fired edge. Geometry only, no gradient. */}
      <RoundedRect x={left} y={top} width={size} height={size} r={radius} color={face} />
      {colour !== STONE && (
        <RoundedRect x={left + pool} y={top + pool} width={size - pool * 2} height={size - pool * 2} r={radius * 0.72} color={shade(face, POOL_SHADE)} />
      )}
      {/* Gold is gilt metal, not a sixth glaze: a double rim, like a coin's. */}
      {gold && (
        <>
          <RoundedRect x={left + 1} y={top + 1} width={size - 2} height={size - 2} r={radius - 1} color={rim} style="stroke" strokeWidth={Math.max(1.5, size * 0.045)} />
          <RoundedRect x={left + pool * 1.6} y={top + pool * 1.6} width={size - pool * 3.2} height={size - pool * 3.2} r={radius * 0.6} color={rim} style="stroke" strokeWidth={Math.max(1, size * 0.022)} opacity={0.7} />
        </>
      )}
      {colour !== STONE && !gold && (
        <RoundedRect x={left + pool} y={top + pool} width={size - pool * 2} height={size - pool * 2} r={radius * 0.72} color={shade(base, KEYLINE_SHADE)} style="stroke" strokeWidth={Math.max(1, size * 0.02)} />
      )}
      {colour !== STONE && <TileGlyph colour={colour} cx={cx} cy={cy - lip} r={gr} ink={gold ? shade(theme.colors.goldRim, 1.1) : shade(base, GLYPH_LIP_SHADE)} />}
      <TileGlyph colour={colour} cx={cx} cy={cy} r={gr} ink={ink} />
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
 * The shards a stone breaks into: a fan of five uneven pieces round a
 * point a little off its centre, each with the direction it is thrown.
 * In the stone's own unit square (-1..1), fixed - a stone always breaks
 * the same believable way, never into a neat grid of squares.
 */
const SHARD_HUB: readonly [number, number] = [0.12, 0.1];
const SHARD_RIM: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0.2, -1],
  [1, -0.35],
  [1, 1],
  [-0.15, 1],
  [-1, 0.25],
];
const SHARDS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [SHARD_HUB, SHARD_RIM[0], SHARD_RIM[1]],
  [SHARD_HUB, SHARD_RIM[1], [1, -1], SHARD_RIM[2]],
  [SHARD_HUB, SHARD_RIM[2], SHARD_RIM[3]],
  [SHARD_HUB, SHARD_RIM[3], SHARD_RIM[4]],
  [SHARD_HUB, SHARD_RIM[4], [-1, 1], SHARD_RIM[5]],
  [SHARD_HUB, SHARD_RIM[5], SHARD_RIM[0]],
];
/** Grit thrown out with the shards: where from, which way, how big. */
const PEBBLES: ReadonlyArray<readonly [number, number, number]> = [
  [-0.9, -0.5, 0.09],
  [0.85, -0.7, 0.07],
  [-0.4, 0.9, 0.06],
  [0.7, 0.5, 0.08],
];

/**
 * A stone at the end of its drop. It lands whole; then it shudders, a
 * crack draws itself across it, and it gives way - six uneven shards
 * thrown out and falling with a turn each, grit flying wider, and a low
 * puff of dust along the floor where it stood. Stone, not glaze: no
 * sparkle.
 */
function CrumblingStone({ x, y, cell, t }: { x: number; y: number; cell: number; t: number }): React.JSX.Element {
  if (t <= 0) return <Tile colour={STONE} x={x} y={y} cell={cell} />;
  const full = cell * TILE_SCALE;
  const half = full / 2;
  const face = theme.colors.adjacentStone;
  const dark = shade(face, 0.62);
  // The first beat: a shudder that dies away as the crack runs.
  const shudder = t < 0.26 ? Math.sin(t * 90) * cell * 0.022 * (1 - t / 0.26) : 0;
  const cx = x + cell / 2 + shudder;
  const cy = y + cell / 2;
  const crack = clamp01(t / 0.24);
  const breakT = clamp01((t - 0.26) / 0.74);
  const dust = easeOutCubic(clamp01((t - 0.24) / 0.76));
  const at = ([ux, uy]: readonly [number, number]) => `${cx + ux * half} ${cy + uy * half}`;
  // The crack stops short of the edge, inside the stone's rounded corners.
  const inside = ([ux, uy]: readonly [number, number]): readonly [number, number] => [SHARD_HUB[0] + (ux - SHARD_HUB[0]) * 0.78, SHARD_HUB[1] + (uy - SHARD_HUB[1]) * 0.78];
  return (
    <Group>
      {dust > 0 &&
        [-0.5, 0, 0.5].map((dx, i) => (
          <Circle key={`d${i}`} cx={cx + dx * full * (0.55 + dust * 0.9)} cy={cy + half * 0.86 - dust * full * 0.12 * (i === 1 ? 1.4 : 1)} r={full * (0.1 + dust * 0.24)} color={shade(face, 1.18)} opacity={0.5 * (1 - dust)} />
        ))}
      {breakT === 0 ? (
        <Group>
          <Tile colour={STONE} x={x + shudder} y={y} cell={cell} />
          {/* The crack runs out from where it will break, along the seams
              the shards will part on. */}
          <Path
            path={`M ${at(SHARD_HUB)} L ${at(inside(SHARD_RIM[0]))} M ${at(SHARD_HUB)} L ${at(inside(SHARD_RIM[2]))} M ${at(SHARD_HUB)} L ${at(inside(SHARD_RIM[4]))} M ${at(SHARD_HUB)} L ${at(inside(SHARD_RIM[1]))}`}
            color={dark}
            style="stroke"
            strokeWidth={Math.max(1.2, full * 0.045)}
            strokeCap="round"
            end={crack}
          />
        </Group>
      ) : (
        <Group>
          {SHARDS.map((shard, i) => {
            const mx = shard.reduce((a, p) => a + p[0], 0) / shard.length;
            const my = shard.reduce((a, p) => a + p[1], 0) / shard.length;
            // Stone is heavy: the pieces part a little and mostly drop.
            const throwOut = easeOutCubic(breakT) * full * 0.18;
            const fall = breakT * breakT * full * 0.85;
            const len = Math.hypot(mx, my) || 1;
            const dx = (mx / len) * throwOut;
            const dy = (my / len) * throwOut * 0.4 + fall;
            const turn = (mx >= 0 ? 1 : -1) * breakT * (0.28 + i * 0.06);
            const shrink = 0.94 - breakT * 0.2;
            const pts = shard.map(([ux, uy]) => [(ux - mx) * half * shrink, (uy - my) * half * shrink] as const);
            const poly = `M ${pts.map(([px, py]) => `${px} ${py}`).join(' L ')} Z`;
            return (
              <Group key={`s${i}`} opacity={1 - breakT ** 2} transform={[{ translateX: cx + mx * half + dx }, { translateY: cy + my * half + dy }, { rotate: turn }]}>
                <Path path={poly} color={dark} transform={[{ translateY: full * 0.05 }]} />
                <Path path={poly} color={face} />
              </Group>
            );
          })}
          {PEBBLES.map(([ux, uy, r], i) => {
            const out = easeOutCubic(breakT) * full * 0.45;
            const fall = breakT * breakT * full * 1.1;
            return <Circle key={`g${i}`} cx={cx + ux * (half + out)} cy={cy + uy * half * 0.6 + fall - (1 - breakT) * breakT * full * 0.5} r={full * r} color={dark} opacity={1 - breakT} />;
          })}
        </Group>
      )}
    </Group>
  );
}

/**
 * The tray itself - panel, inner rule and accent rim.
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
  /** The board's opening second: tiles are dealt in, not shown. */
  dealing: DealClock;
}

/**
 * Every well, and every settled tile. Memoized away from the animation
 * clock from the outset: a move touches a handful of cells, and
 * redrawing all forty-nine wells on every frame of a fall is exactly the
 * waste that had to be retrofitted out of two earlier boards here.
 */
const StaticTiles = React.memo(function StaticTilesImpl({ layout, grid, activeKeys, previewKeys, dealing }: StaticTilesProps) {
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
        <DealIn key={`tile-${key}`} x={col * cell + cell / 2} y={row * cell + cell / 2} delay={dealDelay(Math.max(row, col), Math.max(rows, cols) - 1)} dealing={dealing}>
          <Tile colour={colour} x={col * cell} y={row * cell} cell={cell} highlighted={preview.has(key)} />
        </DealIn>,
      );
    }
  }

  return <Group>{nodes}</Group>;
});

/**
 * One move, on the UI thread: the cleared run pops - swelling, then
 * shrinking away as chips of its colour burst out and fall - rippling out
 * from the tapped tile, and the tiles above drop into the gaps. One clock
 * for the whole move; each piece reads its own moment from it. A column
 * with a stone breaking in it holds its tiles until the stone has broken.
 */
function MoveLayer({ move, grid, cell }: { move: AdjacentAnimation; grid: AdjacentState['grid']; cell: number }): React.JSX.Element {
  // Starts at the move's own age, so a board mounted mid-move shows that
  // moment rather than replaying it from the top.
  const clock = useSharedValue(Math.max(0, Date.now() - move.at));
  const span = 2000;
  useEffect(() => {
    clock.value = withTiming(span, { duration: Math.max(0, span - clock.value), easing: Easing.linear });
    // Once: this layer is keyed by its move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const origin = move.removed[0];
  const holding = new Set(move.removed.filter(t => t.colour === STONE).map(t => t.col));
  return (
    <Group>
      {move.falls.map(fall => {
        const colour = grid[fall.toRow][fall.col];
        if (colour === null) return null;
        return <FallingTile key={`fall-${fall.col}-${fall.toRow}`} fall={fall} colour={colour} cell={cell} delay={holding.has(fall.col) ? COLUMN_HOLD_MS : FALL_DELAY_MS} clock={clock} />;
      })}
      {move.removed.map(tile =>
        tile.colour === STONE ? null : (
          <ClearingTile key={`clear-${tile.row}-${tile.col}`} tile={tile} cell={cell} delay={origin ? (Math.abs(tile.row - origin.row) + Math.abs(tile.col - origin.col)) * CLEAR_RIPPLE_MS : 0} clock={clock} />
        ),
      )}
    </Group>
  );
}

/** A tile dropping from where it was to where it lands, held until its
 * column's turn. Drawn where it lands and lifted back up. */
function FallingTile({ fall, colour, cell, delay, clock }: { fall: AdjacentFall; colour: number; cell: number; delay: number; clock: SharedValue<number> }): React.JSX.Element {
  const rise = (fall.fromRow - fall.toRow) * cell;
  const transform = useDerivedValue(() => [{ translateY: rise * (1 - fallEase((clock.value - delay) / FALL_MS)) }]);
  return (
    <Group transform={transform}>
      <Tile colour={colour} x={fall.col * cell} y={fall.toRow * cell} cell={cell} />
    </Group>
  );
}

/** A cleared tile's pop and its four chips. */
function ClearingTile({ tile, cell, delay, clock }: { tile: AdjacentRemoved; cell: number; delay: number; clock: SharedValue<number> }): React.JSX.Element {
  const cx = tile.col * cell + cell / 2;
  const cy = tile.row * cell + cell / 2;
  const chip = cell * 0.13;
  const colour = adjacentTileColor(tile.colour);
  const local = useDerivedValue(() => (clock.value - delay) / CLEAR_MS);
  const tileTransform = useDerivedValue(() => {
    const t = local.value;
    if (t <= 0) return [{ scale: 1 }];
    if (t >= 1) return [{ scale: 0 }];
    const swell = t < CLEAR_SWELL ? 1 + 0.12 * easeOutCubic(t / CLEAR_SWELL) : 1.12 * (1 - ((t - CLEAR_SWELL) / (1 - CLEAR_SWELL)) ** 2);
    return [{ scale: Math.max(0, swell) }];
  });
  const tileOpacity = useDerivedValue(() => {
    const t = local.value;
    return t <= 0.55 ? 1 : t >= 1 ? 0 : 1 - (t - 0.55) / 0.45;
  });
  return (
    <Group>
      <Group origin={vec(cx, cy)} transform={tileTransform} opacity={tileOpacity}>
        <Tile colour={tile.colour} x={tile.col * cell} y={tile.row * cell} cell={cell} />
      </Group>
      {CHIP_DIRECTIONS.map(([dx, dy], i) => (
        <Chip key={i} cx={cx} cy={cy} dx={dx} dy={dy} cell={cell} size={chip} colour={colour} local={local} />
      ))}
    </Group>
  );
}

function Chip({ cx, cy, dx, dy, cell, size, colour, local }: { cx: number; cy: number; dx: number; dy: number; cell: number; size: number; colour: string; local: SharedValue<number> }): React.JSX.Element {
  const transform = useDerivedValue(() => {
    const burst = clamp01((local.value - CLEAR_SWELL) / (1 - CLEAR_SWELL));
    const reach = cell * 0.62 * easeOutCubic(burst);
    return [{ translateX: dx * reach }, { translateY: dy * reach + cell * 0.4 * burst * burst }];
  });
  const opacity = useDerivedValue(() => {
    const t = local.value;
    if (t <= CLEAR_SWELL || t >= 1) return 0;
    return 1 - (t - CLEAR_SWELL) / (1 - CLEAR_SWELL);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect x={cx - size / 2} y={cy - size / 2} width={size} height={size} r={size * 0.3} color={colour} />
    </Group>
  );
}

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
  const dealing = useDealing();
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
  const hasStones = !!animation?.removed.some(t => t.colour === STONE);
  const moveWindow = Math.max(hasStones ? FALL_DELAY_MS + FALL_MS + CRUMBLE_MS + COLUMN_HOLD_MS : FALL_DELAY_MS + FALL_MS, clearWindow);
  const sweepWindow = SWEEP_MS + puzzle.size * SWEEP_STAGGER_MS;
  // The move itself - falls and the clear - runs on the UI thread (see
  // `MoveLayer`); the JavaScript clock is left only for a breaking stone
  // and the finish, which are rare. Every ordinary move used to redraw the
  // board from JavaScript sixty times a second for half a second.
  const moveLive = !reducedMotion && animation != null && now - animation.at < moveWindow ? animation : null;
  const [, settle] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!moveLive) return;
    const timer = setTimeout(settle, moveWindow - (Date.now() - moveLive.at) + 20);
    return () => clearTimeout(timer);
  }, [moveLive, moveWindow]);
  const animating = !reducedMotion && ((moveLive != null && hasStones) || (solvedAt !== null && now - solvedAt < sweepWindow));
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
  /** The squares tiles are falling into this move: the static layer
   * leaves them to `MoveLayer` until the move is over. */
  const fallingKeys = useMemo(() => (moveLive ? moveLive.falls.map(f => cellKey(f.toRow, f.col)) : []), [moveLive]);

  /** Stones on their way down and breaking up: the drop to the floor, then
   * the crumble (see `CRUMBLE_MS`). */
  const crumbling = useMemo(() => {
    if (!animation || reducedMotion) return [];
    const since = frame - animation.at;
    if (since < 0) return [];
    const stones = animation.removed.filter(t => t.colour === STONE);
    return stones
      .map(tile => {
        // Where it comes to rest: the floor, or on the stones beneath it
        // that are breaking too.
        const below = stones.filter(o => o.col === tile.col && o.row > tile.row).length;
        const floor = puzzle.size - 1 - below;
        const fall = fallEase(Math.max(0, Math.min(1, (since - FALL_DELAY_MS) / FALL_MS)));
        const crumble = (since - FALL_DELAY_MS - FALL_MS) / CRUMBLE_MS;
        return { tile, y: tile.row + (floor - tile.row) * fall, crumble };
      })
      .filter(c => c.crumble < 1);
  }, [animation, frame, reducedMotion, puzzle.size]);

  const sweep = useMemo(() => {
    if (solvedAt === null || reducedMotion) return new Map<string, number>();
    const map = new Map<string, number>();
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (state.grid[row][col] === null) continue;
        // Rings out from the middle: the same spreading the clear's own
        // pop uses, from the centre of the tray instead of a tapped tile.
        const mid = (puzzle.size - 1) / 2;
        const ringOut = Math.round(Math.max(Math.abs(row - mid), Math.abs(col - mid)) - (puzzle.size % 2 === 0 ? 0.5 : 0));
        const since = frame - solvedAt - ringOut * SWEEP_STAGGER_MS;
        if (since < 0) continue;
        map.set(cellKey(row, col), clamp01(since / SWEEP_MS));
      }
    }
    return map;
  }, [solvedAt, frame, reducedMotion, puzzle.size, state.grid]);

  const activeKeys = useMemo(() => [...new Set([...fallingKeys, ...sweep.keys()])].join(','), [fallingKeys, sweep]);
  const previewKeys = useMemo(() => (preview ?? []).map(c => cellKey(c.row, c.col)).join(','), [preview]);

  return (
    <Group>
      {/* The tray, given the same panel treatment Binairo's board uses -
          a near-neutral paper sheen, a dark inner rule, then this game's
          own accent rim. (A white highlight along the lit edges read as
          stray white stripes beside the rim, and is gone.) */}
      <TrayChrome width={width} height={height} />

      <StaticTiles layout={layout} grid={state.grid} activeKeys={activeKeys} previewKeys={previewKeys} dealing={dealing} />

      {moveLive && <MoveLayer key={moveLive.at} move={moveLive} grid={state.grid} cell={cell} />}

      {crumbling.map(({ tile, y, crumble }) => (
        <CrumblingStone key={`crumble-${tile.row}-${tile.col}`} x={tile.col * cell} y={y * cell} cell={cell} t={crumble} />
      ))}

      {/* The finish: a ripple out from the middle over the tiles that are
          left - each hops and lands back in place with a little give, a
          ring of its colour spreading as it does. The board is finished, not emptied: every tile stays. */}
      {[...sweep.entries()].map(([key, t]) => {
        const [row, col] = key.split(':').map(Number);
        const colour = state.grid[row][col];
        if (colour === null) return null;
        // Up and down on one arc, then a small squash on landing.
        const hop = t < 0.78 ? Math.sin((t / 0.78) * Math.PI) : 0;
        const land = t >= 0.78 && t < 1 ? Math.sin(((t - 0.78) / 0.22) * Math.PI) : 0;
        const scale = 1 + 0.07 * hop - 0.04 * land;
        const ring = clamp01((t - 0.72) / 0.28);
        return (
          <Group key={`sweep-${key}`}>
            {ring > 0 && ring < 1 && (
              <Circle cx={col * cell + cell / 2} cy={row * cell + cell / 2} r={cell * (0.36 + 0.3 * easeOutCubic(ring))} color={adjacentTileColor(colour)} style="stroke" strokeWidth={Math.max(1, cell * 0.06 * (1 - ring))} opacity={0.55 * (1 - ring)} />
            )}
            <Tile colour={colour} x={col * cell} y={row * cell - hop * cell * 0.24} cell={cell} scale={scale} />
          </Group>
        );
      })}

      <TrayRim width={width} height={height} />
    </Group>
  );
}

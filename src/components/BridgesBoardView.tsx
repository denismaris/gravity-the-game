import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Path, Rect, RoundedRect, Skia, SkPath } from '@shopify/react-native-skia';
import {
  Easing,
  SharedValue,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BridgeLink, BridgesPuzzle, BridgesState, bridgeLinks, islandLoads, linksByIsland } from '../game/bridges';
import { BoardLayout, computeBoardLayout, useReducedMotion } from '../game/rendering';
import { getColorScheme, lightColors, theme } from '../theme';
import { useEquipped } from '../progression/PlayerProgressProvider';
import { DEFAULT_EQUIPPED, cosmeticById } from '../progression/shop';
import { REMOVE_DURATION_MS, buildDurationMs, buildEase, clamp01, easeOutCubic, laneSpan, plankScale } from './bridgesMotion';

/**
 * Bridges, drawn as a hand-made harbour chart - so it looks like nothing
 * else in the genre, where every other version is circles joined by lines.
 *
 * - The chart: pale water inside a graduated neatline (an old map's
 *   alternating ink-and-paper border, one bar per grid square), depth
 *   contours round every island, survey dots and the odd wave mark on the
 *   open water.
 * - Islands are islets with their own coastlines (seeded outlines): a
 *   sand beach round a lighter inland, standing on a shore face, with a
 *   foam line and a shadow on the sea. Met, the inland turns meadow green
 *   and a coral pennant goes up and flutters. The number is hand-drawn -
 *   there is no Skia font - so it moves with the islet.
 * - Bridges are boardwalks: planks laid tight in two grains between fine
 *   ropes, a post at each end, a shadow on the water.
 *
 * **All motion runs on the UI thread** (Reanimated shared values driving
 * Skia props). React renders the board only when the game state changes;
 * every frame of every animation - a bridge laid plank by plank from where
 * it was started, an island hopping, a pennant going up, foam rolling out,
 * the entrance, the finish wave, the drag ghost following the finger - is
 * computed natively, so nothing waits on JavaScript. That is what the
 * first version, which re-rendered the whole board from a JS clock every
 * frame and re-parsed bridge paths per frame, got wrong on a phone.
 */

const harbourAccent = (): string => theme.colors.bridgesAccent;
// The islands are printed sand and foam in either palette, so their ink
// and paper are the daylight ones even at night.
const INK = lightColors.primary;
const PAPER = lightColors.surfaceHi;
const WATER = '#D8E8EA';
const CONTOUR = '#BBD5DA';
const SURVEY_DOT = '#B6D0D5';
const WATER_SHADOW = 'rgba(28,78,96,0.2)';
const FOAM = 'rgba(255,255,255,0.85)';
const BEACH = '#EBD7A5';
const SHORE = '#C29F62';
const INLAND = '#F6EBCB';
const MEADOW = '#B7D487';
const CORAL = '#F0B19D';
const CORAL_SHORE = '#C77A64';
const WOOD = '#BE8D55';
const WOOD_ALT = '#CC9E67';
const WOOD_SIDE = '#7B5230';
const WOOD_GLOW = '#FBEBC4';
const ROPE = '#6B4A2D';
const pennantColor = (): string => theme.colors.secondary;

/** Island radius, and a single and a double bridge's width and spacing,
 * as shares of one square. */
const ISLAND_R = 0.36;
const SINGLE_W = 0.2;
const DOUBLE_W = 0.15;
const DOUBLE_GAP = 0.12;
const PLANK_PITCH = 0.16;

const INTRO_MS = 520;
const FOAM_MS = 700;

/** Digits drawn in a 0.6 x 1 box, stroked with round caps. */
const DIGITS: Record<number, string> = {
  1: 'M 0.15 0.25 L 0.33 0.08 L 0.33 0.92 M 0.15 0.92 L 0.5 0.92',
  2: 'M 0.09 0.27 C 0.1 0.05 0.51 0.05 0.51 0.29 C 0.51 0.5 0.1 0.62 0.08 0.92 L 0.53 0.92',
  3: 'M 0.08 0.17 C 0.2 0.04 0.52 0.05 0.5 0.27 C 0.49 0.43 0.33 0.47 0.24 0.47 C 0.4 0.47 0.53 0.55 0.53 0.7 C 0.53 0.95 0.18 0.98 0.07 0.82',
  4: 'M 0.41 0.92 L 0.41 0.08 L 0.07 0.64 L 0.54 0.64',
  5: 'M 0.5 0.08 L 0.15 0.08 L 0.11 0.45 C 0.3 0.36 0.53 0.44 0.53 0.67 C 0.53 0.95 0.2 0.99 0.07 0.83',
  6: 'M 0.48 0.12 C 0.22 0 0.08 0.3 0.08 0.6 C 0.08 0.86 0.18 0.93 0.3 0.93 C 0.45 0.93 0.53 0.82 0.53 0.67 C 0.53 0.51 0.42 0.42 0.3 0.42 C 0.18 0.42 0.1 0.5 0.08 0.6',
  7: 'M 0.07 0.08 L 0.53 0.08 L 0.24 0.92',
  8: 'M 0.3 0.47 C 0.14 0.47 0.1 0.36 0.1 0.27 C 0.1 0.14 0.2 0.07 0.3 0.07 C 0.4 0.07 0.5 0.14 0.5 0.27 C 0.5 0.36 0.46 0.47 0.3 0.47 C 0.12 0.47 0.07 0.58 0.07 0.7 C 0.07 0.84 0.18 0.93 0.3 0.93 C 0.42 0.93 0.53 0.84 0.53 0.7 C 0.53 0.58 0.48 0.47 0.3 0.47 Z',
};
const glyphCache = new Map<number, SkPath | null>();
function glyph(n: number): SkPath | null {
  if (!glyphCache.has(n)) glyphCache.set(n, DIGITS[n] ? Skia.Path.MakeFromSVGString(DIGITS[n]) : null);
  return glyphCache.get(n) ?? null;
}
const PENNANT_PATH = Skia.Path.MakeFromSVGString('M 0 0 L 1 0.28 L 0 0.58 Z');
/** A chart's wave mark: two small crests side by side, in a 1 x 0.3 box. */
const WAVE_PATH = Skia.Path.MakeFromSVGString('M 0 0.3 Q 0.125 0 0.25 0.3 Q 0.375 0 0.5 0.3 M 0.5 0.3 Q 0.625 0 0.75 0.3 Q 0.875 0 1 0.3');

/* eslint-disable no-bitwise -- mulberry32 is bitwise by definition */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

/**
 * One islet's coastline, as a closed curve of radius about 1 round the
 * origin - nine points at jittered radii joined by a smooth Catmull-Rom
 * curve. Seeded from where the island is, so a board's coastlines never
 * change between visits, and no two islets share one.
 */
export function coastlineSvg(seed: number): string {
  const random = seeded(seed);
  const n = 9;
  const points = Array.from({ length: n }, (_v, k) => {
    const angle = (k / n) * Math.PI * 2 + (random() - 0.5) * 0.35;
    const r = 0.9 + random() * 0.2;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
  const p = (k: number) => points[(k + n) % n];
  let d = `M ${p(0).x.toFixed(3)} ${p(0).y.toFixed(3)}`;
  for (let k = 0; k < n; k += 1) {
    const c1 = { x: p(k).x + (p(k + 1).x - p(k - 1).x) / 6, y: p(k).y + (p(k + 1).y - p(k - 1).y) / 6 };
    const c2 = { x: p(k + 1).x - (p(k + 2).x - p(k).x) / 6, y: p(k + 1).y - (p(k + 2).y - p(k).y) / 6 };
    d += ` C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)} ${c2.x.toFixed(3)} ${c2.y.toFixed(3)} ${p(k + 1).x.toFixed(3)} ${p(k + 1).y.toFixed(3)}`;
  }
  return `${d} Z`;
}

export type IslandTone = 'open' | 'done' | 'over';

export interface BridgesDrag {
  /** The island the finger went down on. */
  readonly source: number;
  /** The lane the drag points along, once it has a direction. */
  readonly link: number | null;
  /** How far toward the far island, 0-1 - used when no live
   * `dragProgress` is passed (a still picture, say). */
  readonly progress: number;
  /** Past the point where letting go lays the bridge. */
  readonly snapped: boolean;
  /** The lane is crossed by a built bridge. */
  readonly blocked: boolean;
}

export interface BridgesBoardViewProps {
  puzzle: BridgesPuzzle;
  state: BridgesState;
  size: number;
  solved: boolean;
  drag?: BridgesDrag | null;
  /** The drag's progress toward the far island, written straight from the
   * finger - the ghost bridge follows it on the UI thread. */
  dragProgress?: SharedValue<number>;
  /** Where the latest bridge was started, as a share of the way along its
   * lane from island `a` (0) to island `b` (1) - the island dragged from,
   * or the spot tapped on the water. It is built outward from there. */
  origin?: { link: number; at: number } | null;
  /** A lane to glow: the one a hint just set. */
  flashLink?: number | null;
  /** A bridge that just refused a crossing, and when. */
  blocked?: { link: number; at: number } | null;
  /** Bumped to replay the entrance (a restart). */
  introKey?: number;
}

export interface BridgesGeometry {
  readonly layout: BoardLayout;
  /** The grid's offset inside the board - room for the chart's border. */
  readonly inset: number;
  readonly cell: number;
  readonly R: number;
  readonly centres: ReadonlyArray<{ x: number; y: number }>;
}
type Geometry = BridgesGeometry;

/** Where everything is - shared by the drawing and the touch layer, so a
 * finger and the island under it can never disagree. */
export function bridgesGeometry(puzzle: Pick<BridgesPuzzle, 'rows' | 'islands'>, size: number): BridgesGeometry {
  const layout = computeBoardLayout(puzzle.rows, size);
  const cell = layout.boardSize / (puzzle.rows + 0.62);
  const inset = cell * 0.31;
  return { layout, inset, cell, R: cell * ISLAND_R, centres: puzzle.islands.map(i => ({ x: inset + (i.col + 0.5) * cell, y: inset + (i.row + 0.5) * cell })) };
}

function toneOf(load: number, need: number): IslandTone {
  return load === need ? 'done' : load > need ? 'over' : 'open';
}

interface Lane {
  readonly x1: number;
  readonly y1: number;
  readonly length: number;
  readonly horizontal: boolean;
}

/** A lane, shore to shore. */
function laneOf(geo: Geometry, link: BridgeLink): Lane {
  const a = geo.centres[link.a];
  const b = geo.centres[link.b];
  const inset = geo.R * 0.72;
  return link.horizontal ? { x1: a.x + inset, y1: a.y, length: b.x - a.x - 2 * inset, horizontal: true } : { x1: a.x, y1: a.y + inset, length: b.y - a.y - 2 * inset, horizontal: false };
}

/** Where along a lane (0-1) a board point falls, for a tap on the water. */
export function laneShare(geo: Geometry, link: BridgeLink, x: number, y: number): number {
  const lane = laneOf(geo, link);
  return clamp01(lane.horizontal ? (x - lane.x1) / lane.length : (y - lane.y1) / lane.length);
}

/** A box in lane space - `u` along, `v` across from the centre line - as a
 * board rectangle. */
function laneBox(lane: Lane, u: number, v: number, du: number, dv: number): { x: number; y: number; width: number; height: number } {
  return lane.horizontal ? { x: lane.x1 + u, y: lane.y1 + v, width: du, height: dv } : { x: lane.x1 + v, y: lane.y1 + u, width: dv, height: du };
}

const layoutFor = (count: number, cell: number): Array<{ offset: number; width: number }> =>
  count === 2
    ? [
        { offset: -cell * DOUBLE_GAP, width: cell * DOUBLE_W },
        { offset: cell * DOUBLE_GAP, width: cell * DOUBLE_W },
      ]
    : count === 1
      ? [{ offset: 0, width: cell * SINGLE_W }]
      : [];

interface Plank {
  /** Its centre along the lane, 0-1. */
  readonly at: number;
  readonly u: number;
  readonly du: number;
  readonly across: number;
  readonly alt: boolean;
}

function planksOf(geo: Geometry, lane: Lane, width: number): Plank[] {
  const count = Math.max(2, Math.round(lane.length / (geo.cell * PLANK_PITCH)));
  const pitch = lane.length / count;
  return Array.from({ length: count }, (_v, k) => ({ at: (k + 0.5) / count, u: (k + 0.5) * pitch - pitch * 0.4, du: pitch * 0.8, across: width * 1.08, alt: k % 2 === 1 }));
}

interface LanePaths {
  readonly shadow: SkPath | null;
  readonly sides: SkPath | null;
  readonly tops: SkPath | null;
  readonly topsAlt: SkPath | null;
  readonly ropes: SkPath | null;
}

const svgBox = (b: { x: number; y: number; width: number; height: number }): string =>
  b.width > 0.05 && b.height > 0.05 ? `M ${b.x.toFixed(2)} ${b.y.toFixed(2)} h ${b.width.toFixed(2)} v ${b.height.toFixed(2)} h ${(-b.width).toFixed(2)} Z ` : '';
const toPath = (svg: string): SkPath | null => (svg ? Skia.Path.MakeFromSVGString(svg) : null);

/** One whole boardwalk along a lane, centred on the lane line (offset 0),
 * as five paths - built once per lane and width, then only ever moved by
 * transforms. */
const lanePathCache = new Map<string, LanePaths>();
function lanePaths(geo: Geometry, link: BridgeLink, width: number): LanePaths {
  // Keyed by where the lane actually is on screen. It was keyed by its two
  // islands' *indices*, which repeat from board to board - so a lane on a
  // new board could be drawn with the cached planks of a lane from an
  // earlier board: bridges ending in open water, stubs across the middle
  // of other bridges, a double drawn over a stranger's single.
  const lane = laneOf(geo, link);
  const key = `${geo.cell.toFixed(3)}|${lane.x1.toFixed(2)},${lane.y1.toFixed(2)},${lane.length.toFixed(2)},${lane.horizontal ? 'h' : 'v'}|${width.toFixed(3)}`;
  const hit = lanePathCache.get(key);
  if (hit) return hit;
  const rope = Math.max(0.8, geo.cell * 0.016);
  const post = Math.max(2, geo.cell * 0.05);
  let sides = '';
  let tops = '';
  let topsAlt = '';
  for (const plank of planksOf(geo, lane, width)) {
    const box = svgBox(laneBox(lane, plank.u, -plank.across / 2, plank.du, plank.across));
    if (plank.alt) topsAlt += box;
    else tops += box;
    sides += svgBox(laneBox(lane, plank.u, -plank.across / 2 + Math.max(1, width * 0.12), plank.du, plank.across));
  }
  let ropes = svgBox(laneBox(lane, 0, -width * 0.4 - rope / 2, lane.length, rope)) + svgBox(laneBox(lane, 0, width * 0.4 - rope / 2, lane.length, rope));
  for (const u of [0, lane.length]) {
    ropes += svgBox(laneBox(lane, u - post / 2, -width * 0.55 - post / 2, post, post)) + svgBox(laneBox(lane, u - post / 2, width * 0.55 - post / 2, post, post));
  }
  const shadowBox = laneBox(lane, 1.5, -width / 2 + width * 0.42, lane.length, width);
  const paths: LanePaths = { shadow: toPath(svgBox(shadowBox)), sides: toPath(sides), tops: toPath(tops), topsAlt: toPath(topsAlt), ropes: toPath(ropes) };
  if (lanePathCache.size > 800) lanePathCache.clear();
  lanePathCache.set(key, paths);
  return paths;
}

/** A settled boardwalk: its cached paths, at an across-lane offset. */
function Boardwalk({ paths, lane, offset, tint }: { paths: LanePaths; lane: Lane; offset: number; tint?: string }): React.JSX.Element {
  const shift = lane.horizontal ? [{ translateY: offset }] : [{ translateX: offset }];
  if (tint) {
    return (
      <Group transform={shift}>
        {paths.tops && <Path path={paths.tops} color={tint} />}
        {paths.topsAlt && <Path path={paths.topsAlt} color={tint} />}
      </Group>
    );
  }
  return (
    <Group transform={shift}>
      {paths.shadow && <Path path={paths.shadow} color={WATER_SHADOW} />}
      {paths.sides && <Path path={paths.sides} color={WOOD_SIDE} />}
      {paths.tops && <Path path={paths.tops} color={WOOD} />}
      {paths.topsAlt && <Path path={paths.topsAlt} color={WOOD_ALT} />}
      {paths.ropes && <Path path={paths.ropes} color={ROPE} />}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Bridges in motion
// ---------------------------------------------------------------------------

/** One plank of a bridge being laid or taken up - it pops in (or out) as
 * the moving end of the bridge passes it, on the UI thread. */
/** One plank of a bridge being laid or taken up. As the moving end of the
 * bridge reaches it, it fades in, settles from slightly small to full size
 * and drops the last hair onto the ropes - on the UI thread, eased over
 * several frames so the build reads as a smooth run of planks. */
function PoppingPlank({ lane, plank, offset, width, pop, drop, progress, origin, building }: { lane: Lane; plank: Plank; offset: number; width: number; pop: number; drop: number; progress: SharedValue<number>; origin: number; building: boolean }) {
  const top = laneBox(lane, plank.u, offset - plank.across / 2, plank.du, plank.across);
  const side = laneBox(lane, plank.u, offset - plank.across / 2 + Math.max(1, width * 0.12), plank.du, plank.across);
  const cx = top.x + top.width / 2;
  const cy = top.y + top.height / 2;
  const landed = useDerivedValue(() => {
    const [from, to] = laneSpan(progress.value, origin, building);
    return plankScale(plank.at, from, to, pop);
  });
  const transform = useDerivedValue(() => {
    const t = landed.value;
    return [{ translateX: cx }, { translateY: cy - (1 - t) * drop }, { scale: 0.62 + 0.38 * t }, { translateX: -cx }, { translateY: -cy }];
  });
  const opacity = useDerivedValue(() => Math.min(1, landed.value * 1.6));
  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={side.x} y={side.y} width={side.width} height={side.height} color={WOOD_SIDE} />
      <Rect x={top.x} y={top.y} width={top.width} height={top.height} color={plank.alt ? WOOD_ALT : WOOD} />
    </Group>
  );
}

/** The ropes and shadow of a bridge in motion - they run exactly as far as
 * its planks, on the UI thread. */
function SpanStrip({ lane, v, thickness, color, progress, origin, building, nudge = 0 }: { lane: Lane; v: number; thickness: number; color: string; progress: SharedValue<number>; origin: number; building: boolean; nudge?: number }) {
  const x = useDerivedValue(() => {
    const [from] = laneSpan(progress.value, origin, building);
    return lane.horizontal ? lane.x1 + from * lane.length + nudge : lane.x1 + v;
  });
  const y = useDerivedValue(() => {
    const [from] = laneSpan(progress.value, origin, building);
    return lane.horizontal ? lane.y1 + v : lane.y1 + from * lane.length + nudge;
  });
  const w = useDerivedValue(() => {
    const [from, to] = laneSpan(progress.value, origin, building);
    return lane.horizontal ? Math.max(0, (to - from) * lane.length) : thickness;
  });
  const h = useDerivedValue(() => {
    const [from, to] = laneSpan(progress.value, origin, building);
    return lane.horizontal ? thickness : Math.max(0, (to - from) * lane.length);
  });
  return <Rect x={x} y={y} width={w} height={h} color={color} />;
}

/** A bridge being laid (or taken up): shadow, planks popping in sequence
 * from where it was started, ropes running with them. */
function MovingBoardwalk({ geo, lane, offset, width, progress, origin, building }: { geo: Geometry; lane: Lane; offset: number; width: number; progress: SharedValue<number>; origin: number; building: boolean }) {
  const planks = useMemo(() => planksOf(geo, lane, width), [geo, lane, width]);
  const rope = Math.max(0.8, geo.cell * 0.016);
  // A plank finishes landing about three planks behind the moving end -
  // several frames each, so the run of planks reads as one smooth wave.
  const pop = Math.min(0.45, planks.length > 0 ? 3 / planks.length : 0.3);
  const drop = geo.cell * 0.1;
  return (
    <>
      <SpanStrip lane={lane} v={offset - width / 2 + width * 0.42} thickness={width} color={WATER_SHADOW} progress={progress} origin={origin} building={building} nudge={1.5} />
      {planks.map((plank, k) => (
        <PoppingPlank key={k} lane={lane} plank={plank} offset={offset} width={width} pop={pop} drop={drop} progress={progress} origin={origin} building={building} />
      ))}
      <SpanStrip lane={lane} v={offset - width * 0.4 - rope / 2} thickness={rope} color={ROPE} progress={progress} origin={origin} building={building} />
      <SpanStrip lane={lane} v={offset + width * 0.4 - rope / 2} thickness={rope} color={ROPE} progress={progress} origin={origin} building={building} />
    </>
  );
}

/** A settled bridge sliding across (a single making room for a double, or
 * the reverse) - the whole boardwalk moved and squeezed by a transform. */
function SlidingBoardwalk({ paths, lane, fromOffset, toOffset, scaleTo, progress }: { paths: LanePaths; lane: Lane; fromOffset: number; toOffset: number; scaleTo: number; progress: SharedValue<number> }) {
  const transform = useDerivedValue(() => {
    const t = easeOutCubic(clamp01(progress.value * 1.6));
    const offset = fromOffset + (toOffset - fromOffset) * t;
    const squeeze = 1 + (scaleTo - 1) * t;
    return lane.horizontal
      ? [{ translateY: lane.y1 + offset }, { scaleY: squeeze }, { translateY: -lane.y1 }]
      : [{ translateX: lane.x1 + offset }, { scaleX: squeeze }, { translateX: -lane.x1 }];
  });
  return (
    <Group transform={transform}>
      {paths.shadow && <Path path={paths.shadow} color={WATER_SHADOW} />}
      {paths.sides && <Path path={paths.sides} color={WOOD_SIDE} />}
      {paths.tops && <Path path={paths.tops} color={WOOD} />}
      {paths.topsAlt && <Path path={paths.topsAlt} color={WOOD_ALT} />}
      {paths.ropes && <Path path={paths.ropes} color={ROPE} />}
    </Group>
  );
}

/** One change of a lane's bridges, played out once, then handed back. */
function LaneChange({ geo, link, from, to, origin, onDone }: { geo: Geometry; link: BridgeLink; from: number; to: number; origin: number; onDone: () => void }) {
  const building = to > from;
  const progress = useSharedValue(0);
  const lane = useMemo(() => laneOf(geo, link), [geo, link]);
  const squares = Math.max(1, Math.round((lane.length + geo.R * 1.44) / geo.cell));
  useEffect(() => {
    // Built: quick off the mark, easing into the far shore (`buildEase`);
    // the screen times its plank-by-plank haptics to the same curve.
    progress.value = withTiming(1, { duration: building ? buildDurationMs(squares) : REMOVE_DURATION_MS, easing: building ? buildEase : Easing.out(Easing.cubic) }, finished => {
      'worklet';
      if (finished) scheduleOnRN(onDone);
    });
    return () => cancelAnimation(progress);
    // One change, one run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = layoutFor(from, geo.cell);
  const end = layoutFor(to, geo.cell);
  const parts: React.JSX.Element[] = [];
  const top = Math.max(from, to);
  for (let k = 0; k < top; k += 1) {
    const kept = k < Math.min(from, to);
    if (kept) {
      parts.push(
        <SlidingBoardwalk key={`slide-${k}`} paths={lanePaths(geo, link, start[k].width)} lane={lane} fromOffset={start[k].offset} toOffset={end[k].offset} scaleTo={end[k].width / start[k].width} progress={progress} />,
      );
    } else if (building) {
      parts.push(<MovingBoardwalk key={`lay-${k}`} geo={geo} lane={lane} offset={end[k].offset} width={end[k].width} progress={progress} origin={origin} building />);
    } else {
      parts.push(<MovingBoardwalk key={`lift-${k}`} geo={geo} lane={lane} offset={start[k].offset} width={start[k].width} progress={progress} origin={0.5} building={false} />);
    }
  }
  return <>{parts}</>;
}

/** A glow over a lane's planks - a hint's pick, a refusal, the finish wave. */
function LaneGlow({ geo, lane, link, count, color, opacity }: { geo: Geometry; lane: Lane; link: BridgeLink; count: number; color: string; opacity: SharedValue<number> }) {
  return (
    <Group opacity={opacity}>
      {layoutFor(Math.max(1, count), geo.cell).map((l, k) => (
        <Boardwalk key={k} paths={lanePaths(geo, link, l.width)} lane={lane} offset={l.offset} tint={color} />
      ))}
    </Group>
  );
}

let changeCounter = 0;

/**
 * One lane's bridges. At rest: cached boardwalk paths, drawn once. When
 * its count changes, a `LaneChange` plays the build (or teardown) out on
 * the UI thread and hands back to the settled drawing when it is done.
 */
const LaneBridges = React.memo(function LaneBridgesImpl({
  geo,
  link,
  count,
  origin,
  reduced,
  flashOn,
  blockedAt,
  glowDelay,
}: {
  geo: Geometry;
  link: BridgeLink;
  count: number;
  origin: number;
  reduced: boolean;
  flashOn: boolean;
  blockedAt: number | null;
  glowDelay: number | null;
}): React.JSX.Element | null {
  const [shown, setShown] = useState<{ count: number; change: { from: number; to: number; origin: number; key: number } | null }>({ count, change: null });
  if (shown.count !== count) {
    changeCounter += 1;
    setShown({ count, change: reduced ? null : { from: shown.count, to: count, origin, key: changeCounter } });
  }
  const lane = useMemo(() => laneOf(geo, link), [geo, link]);

  const flash = useSharedValue(0);
  const refuse = useSharedValue(0);
  const wave = useSharedValue(0);
  useEffect(() => {
    if (flashOn) flash.value = withRepeat(withSequence(withTiming(0.9, { duration: 130 }), withTiming(0.25, { duration: 130 })), 2, false);
    else flash.value = withTiming(0, { duration: 150 });
  }, [flashOn, flash]);
  useEffect(() => {
    if (blockedAt !== null) refuse.value = withSequence(withTiming(0.85, { duration: 90 }), withTiming(0, { duration: 380 }));
  }, [blockedAt, refuse]);
  useEffect(() => {
    if (glowDelay !== null && !reduced) wave.value = withDelay(glowDelay, withSequence(withTiming(0.9, { duration: 150 }), withTiming(0, { duration: 300 })));
  }, [glowDelay, reduced, wave]);

  return (
    <>
      {shown.change === null && layoutFor(count, geo.cell).map((l, k) => <Boardwalk key={k} paths={lanePaths(geo, link, l.width)} lane={lane} offset={l.offset} />)}
      {shown.change && (
        <LaneChange
          key={shown.change.key}
          geo={geo}
          link={link}
          from={shown.change.from}
          to={shown.change.to}
          origin={shown.change.origin}
          onDone={() => setShown(s => ({ ...s, change: null }))}
        />
      )}
      {count > 0 && <LaneGlow geo={geo} lane={lane} link={link} count={count} color={WOOD_GLOW} opacity={flash} />}
      {count > 0 && <LaneGlow geo={geo} lane={lane} link={link} count={count} color={WOOD_GLOW} opacity={wave} />}
      {blockedAt !== null && <LaneGlow geo={geo} lane={lane} link={link} count={count} color={theme.colors.danger} opacity={refuse} />}
    </>
  );
});

/** The ghost bridge that follows a drag: its reach tracks the finger on
 * the UI thread, so a drag never re-renders the board. */
function DragGhost({ geo, link, fromB, count, blocked, snapped, progress }: { geo: Geometry; link: BridgeLink; fromB: boolean; count: number; blocked: boolean; snapped: boolean; progress: SharedValue<number> | number }) {
  const lane = useMemo(() => laneOf(geo, link), [geo, link]);
  const layout = count === 2 ? layoutFor(2, geo.cell) : layoutFor(count + 1, geo.cell).slice(count === 1 ? 1 : 0);
  const pad = geo.cell * 0.3;
  const fixed = typeof progress === 'number' ? progress : null;
  const live = typeof progress === 'number' ? null : progress;
  const clip = useDerivedValue(() => {
    const p = live ? live.value : (fixed ?? 0);
    const reach = snapped ? 1 : Math.max(0.1, Math.min(1, p));
    const start = fromB ? (1 - reach) * lane.length : 0;
    const size = reach * lane.length;
    return lane.horizontal
      ? { x: lane.x1 + start - 2, y: lane.y1 - pad, width: size + 4, height: pad * 2 }
      : { x: lane.x1 - pad, y: lane.y1 + start - 2, width: pad * 2, height: size + 4 };
  });
  const tint = blocked ? theme.colors.danger : count === 2 ? WOOD_GLOW : WOOD_SIDE;
  return (
    <Group clip={clip} opacity={blocked ? 0.6 : count === 2 ? 0.95 : 0.45}>
      {layout.map((l, k) => (
        <Boardwalk key={k} paths={lanePaths(geo, link, l.width)} lane={lane} offset={l.offset} tint={tint} />
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Islands
// ---------------------------------------------------------------------------

/**
 * One islet, animating itself on the UI thread: rising out of the sea on
 * the entrance, hopping and raising its pennant when its number is met,
 * shaking when over-built, dipping when a bridge lands on it, lifting
 * under a finger, and flashing as the finish wave passes. React only
 * re-renders it when one of those things is asked for.
 */
const IslandSprite = React.memo(function IslandSpriteImpl({
  geo,
  index,
  coast,
  need,
  tone,
  introKey,
  introDelay,
  solveDelay,
  dragRole,
  dragBlocked,
  landKey,
  landDelay,
  reduced,
}: {
  geo: Geometry;
  index: number;
  coast: SkPath | null;
  need: number;
  tone: IslandTone;
  introKey: number;
  introDelay: number;
  solveDelay: number | null;
  dragRole: 'source' | 'target' | null;
  dragBlocked: boolean;
  landKey: number;
  landDelay: number;
  reduced: boolean;
}): React.JSX.Element {
  const { x: cx, y: cy } = geo.centres[index];
  const R = geo.R;
  const rise = useSharedValue(reduced ? 1 : 0);
  const hop = useSharedValue(0);
  const flag = useSharedValue(tone === 'done' ? 1 : 0);
  const flutter = useSharedValue(0);
  const shake = useSharedValue(0);
  const dip = useSharedValue(0);
  const lift = useSharedValue(0);
  const halo = useSharedValue(0);
  const glow = useSharedValue(0);
  const foam = useSharedValue(1);

  const rollFoam = (delay: number) => {
    foam.value = withDelay(delay, withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: FOAM_MS, easing: Easing.out(Easing.cubic) })));
  };

  // The entrance: rising out of the water, then a ring of foam.
  useEffect(() => {
    if (reduced) {
      rise.value = 1;
      return;
    }
    rise.value = 0;
    rise.value = withDelay(introDelay, withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.back(1.6)) }));
    rollFoam(introDelay + INTRO_MS * 0.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey]);

  // Met, over-built, or back to open.
  const previousTone = useRef(tone);
  useEffect(() => {
    const before = previousTone.current;
    previousTone.current = tone;
    if (before === tone) return;
    if (tone === 'done') {
      if (reduced) {
        flag.value = 1;
        return;
      }
      hop.value = withSequence(withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 240 }));
      flag.value = withDelay(130, withSpring(1, { damping: 7, stiffness: 170 }));
      rollFoam(60);
    } else {
      flag.value = withTiming(0, { duration: 160 });
      if (tone === 'over' && !reduced) {
        shake.value = withSequence(
          withTiming(1, { duration: 45 }),
          withTiming(-1, { duration: 60 }),
          withTiming(0.7, { duration: 60 }),
          withTiming(-0.45, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone]);

  // A met island's pennant never quite stops moving.
  useEffect(() => {
    if (tone === 'done' && !reduced) flutter.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    else {
      cancelAnimation(flutter);
      flutter.value = 0;
    }
  }, [tone, reduced, flutter]);

  // A bridge arriving: the island takes its weight.
  useEffect(() => {
    if (landKey === 0 || reduced) return;
    dip.value = withDelay(landDelay, withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 11, stiffness: 240 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landKey, reduced]);

  // Under a finger.
  useEffect(() => {
    lift.value = withSpring(dragRole === 'source' ? 1 : 0, { damping: 14, stiffness: 280 });
    halo.value = withTiming(dragRole ? 1 : 0, { duration: 140 });
  }, [dragRole, lift, halo]);

  // The finish wave.
  useEffect(() => {
    if (solveDelay === null || reduced) return;
    glow.value = withDelay(solveDelay, withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 320 })));
    hop.value = withDelay(solveDelay, withSequence(withTiming(0.6, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 240 })));
    rollFoam(solveDelay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solveDelay, reduced]);

  const outer = useDerivedValue(() => [
    { translateX: cx + shake.value * R * 0.2 },
    { translateY: cy + (1 - rise.value) * R * 0.8 + dip.value * R * 0.14 },
    { scale: Math.max(0, 0.45 + 0.55 * rise.value) * (1 - dip.value * 0.05) },
  ]);
  const body = useDerivedValue(() => [{ translateY: -(hop.value * R * 0.42 + lift.value * R * 0.24) }]);
  const glowOpacity = useDerivedValue(() => glow.value * 0.55);
  const haloOpacity = useDerivedValue(() => halo.value * 0.65);
  const haloScale = useDerivedValue(() => [{ scale: 0.9 + 0.1 * halo.value }]);
  const foamScale = useDerivedValue(() => R * (1.15 + 1.25 * easeOutCubic(foam.value)));
  const foamTransform = useDerivedValue(() => [{ translateY: R * 0.15 }, { scale: foamScale.value }]);
  const foamOpacity = useDerivedValue(() => (foam.value > 0 && foam.value < 1 ? 0.95 * (1 - foam.value) : 0));
  const foamStroke = useDerivedValue(() => 2.4 / foamScale.value);
  const riseOpacity = useDerivedValue(() => clamp01(rise.value * 2));
  const poleX = R * 0.6;
  const poleBase = -R * 0.3;
  const poleHeight = R * 0.9;
  const flagTransform = useDerivedValue(() => [{ translateX: poleX }, { translateY: poleBase }, { scaleY: Math.max(0, flag.value) }]);
  const pennantTransform = useDerivedValue(() => [{ translateY: -poleHeight }, { scaleX: R * 0.62 * (0.8 + 0.2 * (1 - flutter.value)) }, { scaleY: R * 0.62 }]);
  const pennantSkew = useDerivedValue(() => [{ skewY: (flutter.value - 0.5) * 0.25 }]);

  const beach = tone === 'over' ? CORAL : BEACH;
  const shore = tone === 'over' ? CORAL_SHORE : SHORE;
  const inland = tone === 'done' ? MEADOW : tone === 'over' ? CORAL : INLAND;
  const digit = tone === 'over' ? theme.colors.danger : INK;
  const depth = R * 0.2;
  const h = R;
  const path = glyph(need);
  const haloColor = dragBlocked ? theme.colors.danger : harbourAccent();

  return (
    <Group transform={outer} opacity={riseOpacity}>
      <Group transform={haloScale} opacity={haloOpacity}>
        <Circle cx={0} cy={0} r={R * 1.42} color={haloColor} style="stroke" strokeWidth={2.2} />
      </Group>
      {coast && (
        <>
          <Group transform={foamTransform} opacity={foamOpacity}>
            <Path path={coast} color={PAPER} style="stroke" strokeWidth={foamStroke} />
          </Group>
          <Group transform={[{ translateX: R * 0.12 }, { translateY: depth + R * 0.16 }, { scale: R * 1.02 }]}>
            <Path path={coast} color={WATER_SHADOW} />
          </Group>
          <Group transform={[{ translateY: depth * 0.7 }, { scale: R * 1.13 }]}>
            <Path path={coast} color={FOAM} />
          </Group>
        </>
      )}
      <Group transform={body}>
        {coast && (
          <>
            <Group transform={[{ translateY: depth }, { scale: R }]}>
              <Path path={coast} color={shore} />
            </Group>
            <Group transform={[{ scale: R }]}>
              <Path path={coast} color={beach} />
            </Group>
            <Group transform={[{ translateX: -R * 0.03 }, { translateY: -R * 0.05 }, { scale: R * 0.74 }]}>
              <Path path={coast} color={inland} />
            </Group>
            <Group transform={[{ scale: R }]} opacity={glowOpacity}>
              <Path path={coast} color={PAPER} />
            </Group>
          </>
        )}
        {path && (
          <Group transform={[{ translateX: -0.3 * h - (tone === 'done' ? R * 0.12 : 0) }, { translateY: -0.5 * h + R * 0.02 }, { scale: h }]}>
            <Path path={path} color={digit} style="stroke" strokeWidth={0.15} strokeCap="round" strokeJoin="round" />
          </Group>
        )}
        <Group transform={flagTransform}>
          <RoundedRect x={-R * 0.045} y={-poleHeight} width={R * 0.09} height={poleHeight} r={R * 0.045} color={INK} />
          <Group transform={pennantTransform}>
            <Group transform={pennantSkew}>{PENNANT_PATH && <Path path={PENNANT_PATH} color={pennantColor()} />}</Group>
          </Group>
        </Group>
      </Group>
    </Group>
  );
});

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

/**
 * The chart itself: a paper mat standing on a sand edge, the neatline
 * border with its alternating bars (one per grid square, so the
 * graduation *is* the grid), the water, a pair of depth contours round
 * every island, survey dots on the open squares and the odd wave mark.
 * Squares under a bridge lose their dot.
 */
/** The chart's own colours - the shop's chart theme: [water, contour,
 * survey dot, neatline, mat]. */
type ChartColors = ReadonlyArray<string>;

const Chart = React.memo(function ChartImpl({ geo, puzzle, coasts, coveredKey, colors }: { geo: Geometry; puzzle: BridgesPuzzle; coasts: ReadonlyArray<SkPath | null>; coveredKey: string; colors: ChartColors }): React.JSX.Element {
  const [water, contour, dot, neatline, mat] = [colors[0] ?? WATER, colors[1] ?? CONTOUR, colors[2] ?? SURVEY_DOT, colors[3] ?? INK, colors[4] ?? PAPER];
  const size = geo.layout.boardSize;
  const outer = geo.cell * 0.09;
  const band = geo.cell * 0.075;
  const inner = outer + band;
  const line = Math.max(1, geo.cell * 0.022);
  const span = size - 2 * inner;
  const step = span / puzzle.rows;
  const bars: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let k = 0; k < puzzle.rows; k += 2) {
    const along = inner + k * step;
    bars.push({ x: along, y: outer, w: step, h: band });
    bars.push({ x: along, y: size - inner, w: step, h: band });
    bars.push({ x: outer, y: along, w: band, h: step });
    bars.push({ x: size - inner, y: along, w: band, h: step });
  }
  const corners = [
    [outer, outer],
    [size - inner, outer],
    [outer, size - inner],
    [size - inner, size - inner],
  ];
  const taken = new Set([...puzzle.islands.map(i => `${i.row}:${i.col}`), ...(coveredKey ? coveredKey.split(',') : [])]);
  const random = seeded(puzzle.rows * 131 + puzzle.islands.length * 17 + (puzzle.islands[0]?.col ?? 0));
  const dots: Array<{ x: number; y: number; wave: boolean }> = [];
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      const wave = random() < 0.12;
      if (!taken.has(`${row}:${col}`)) dots.push({ x: geo.inset + (col + 0.5) * geo.cell, y: geo.inset + (row + 0.5) * geo.cell, wave });
    }
  }
  const waveW = geo.cell * 0.34;
  return (
    <>
      <RoundedRect x={0} y={geo.cell * 0.05} width={size} height={size} r={geo.cell * 0.18} color={theme.colors.sandDeep} />
      <RoundedRect x={0} y={0} width={size} height={size} r={geo.cell * 0.18} color={mat} />
      <Rect x={inner} y={inner} width={span} height={span} color={water} />
      <Group clip={{ x: inner, y: inner, width: span, height: span }}>
        {puzzle.islands.map((island, i) => {
          const coast = coasts[i];
          if (!coast) return null;
          const c = geo.centres[i];
          return [1.6, 2.15].map(scale => (
            <Group key={`${i}-${scale}`} transform={[{ translateX: c.x }, { translateY: c.y + geo.R * 0.1 }, { scale: geo.R * scale }]}>
              <Path path={coast} color={contour} style="stroke" strokeWidth={1.1 / (geo.R * scale)} />
            </Group>
          ));
        })}
      </Group>
      {dots.map(d =>
        d.wave && WAVE_PATH ? (
          <Group key={`${d.x}:${d.y}`} transform={[{ translateX: d.x - waveW / 2 }, { translateY: d.y - waveW * 0.15 }, { scale: waveW }]}>
            <Path path={WAVE_PATH} color={contour} style="stroke" strokeWidth={1.4 / waveW} strokeCap="round" />
          </Group>
        ) : (
          <Circle key={`${d.x}:${d.y}`} cx={d.x} cy={d.y} r={Math.max(1.1, geo.cell * 0.028)} color={dot} />
        ),
      )}
      {bars.map(b => (
        <Rect key={`${b.x}:${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} color={neatline} />
      ))}
      {corners.map(([x, y]) => (
        <Rect key={`c${x}:${y}`} x={x} y={y} width={band} height={band} color={neatline} />
      ))}
      <Rect x={outer} y={outer} width={size - 2 * outer} height={size - 2 * outer} color={neatline} style="stroke" strokeWidth={line} />
      <Rect x={inner} y={inner} width={span} height={span} color={neatline} style="stroke" strokeWidth={line} />
    </>
  );
});

/** Breadth-first depth of every island along built bridges - the order
 * the finish wave reaches them. */
function waveDepths(puzzle: BridgesPuzzle, bridges: ReadonlyArray<number>): number[] {
  const depth = puzzle.islands.map(() => -1);
  const byIsland = linksByIsland(puzzle);
  const links = bridgeLinks(puzzle);
  depth[0] = 0;
  const queue = [0];
  while (queue.length > 0) {
    const i = queue.shift()!;
    for (const l of byIsland[i]) {
      if (bridges[l] === 0) continue;
      const j = links[l].a === i ? links[l].b : links[l].a;
      if (depth[j] === -1) {
        depth[j] = depth[i] + 1;
        queue.push(j);
      }
    }
  }
  return depth.map(d => Math.max(0, d));
}

function hashId(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 2147483647;
  return h;
}

/** The finish wave's spacing between depths - so the whole wave lands
 * inside the shared 620ms `SOLVE_CELEBRATION_MS` beat. */
function waveStepFor(maxDepth: number): number {
  return Math.min(55, 290 / Math.max(1, maxDepth));
}

export function BridgesBoardView({ puzzle, state, size, solved, drag = null, dragProgress, origin = null, flashLink = null, blocked = null, introKey = 0 }: BridgesBoardViewProps): React.JSX.Element {
  const reduced = useReducedMotion();
  // The chart theme the player wears (see the shop).
  // The default Day Chart becomes the Night Chart after dark; a chart the
  // player chose is kept as chosen.
  const worn = useEquipped('chart');
  const chart = getColorScheme() === 'dark' && worn.id === DEFAULT_EQUIPPED.chart ? cosmeticById('chart-night') ?? worn : worn;
  const geo = useMemo(() => bridgesGeometry(puzzle, size), [puzzle, size]);
  const coasts = useMemo(() => {
    const base = hashId(puzzle.id);
    return puzzle.islands.map(island => Skia.Path.MakeFromSVGString(coastlineSvg(base + island.row * 97 + island.col * 13)));
  }, [puzzle]);
  const links = bridgeLinks(puzzle);
  const loads = useMemo(() => islandLoads(puzzle, state), [puzzle, state]);
  const tones = useMemo(() => puzzle.islands.map((island, i) => toneOf(loads[i], island.need)), [puzzle, loads]);

  // Which islands a newly laid bridge lands on, so each can take its weight.
  const landKeys = useRef<number[]>(puzzle.islands.map(() => 0));
  const landDelays = useRef<number[]>(puzzle.islands.map(() => 0));
  const previousBridges = useRef(state.bridges);
  if (previousBridges.current !== state.bridges) {
    const before = previousBridges.current;
    const next = landKeys.current.slice();
    const delays = landDelays.current.slice();
    state.bridges.forEach((count, l) => {
      if (count <= before[l]) return;
      const at = origin?.link === l ? origin.at : 0.5;
      const a = puzzle.islands[links[l].a];
      const b = puzzle.islands[links[l].b];
      // The dip lands with the bridge: most of the way through its build.
      const delay = buildDurationMs(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) * 0.8;
      if (at > 0.001) {
        next[links[l].a] += 1;
        delays[links[l].a] = delay;
      }
      if (at < 0.999) {
        next[links[l].b] += 1;
        delays[links[l].b] = delay;
      }
    });
    landKeys.current = next;
    landDelays.current = delays;
    previousBridges.current = state.bridges;
  }

  const coveredKey = useMemo(
    () =>
      links
        .filter(link => state.bridges[link.index] > 0)
        .flatMap(link => {
          const a = puzzle.islands[link.a];
          const b = puzzle.islands[link.b];
          const cells: string[] = [];
          if (link.horizontal) for (let col = a.col + 1; col < b.col; col += 1) cells.push(`${a.row}:${col}`);
          else for (let row = a.row + 1; row < b.row; row += 1) cells.push(`${row}:${a.col}`);
          return cells;
        })
        .join(','),
    [links, puzzle, state.bridges],
  );

  const depths = useMemo(() => (solved ? waveDepths(puzzle, state.bridges) : null), [solved, puzzle, state.bridges]);
  const waveStep = depths ? waveStepFor(Math.max(...depths)) : 0;
  const introStagger = Math.min(38, 560 / (puzzle.rows + puzzle.cols));
  const target = drag && drag.link !== null && drag.snapped ? (links[drag.link].a === drag.source ? links[drag.link].b : links[drag.link].a) : null;

  return (
    <Group>
      <Chart geo={geo} puzzle={puzzle} coasts={coasts} coveredKey={coveredKey} colors={chart.colors} />
      {links.map(link => (
        <LaneBridges
          key={link.index}
          geo={geo}
          link={link}
          count={state.bridges[link.index]}
          origin={origin?.link === link.index ? origin.at : 0.5}
          reduced={reduced}
          flashOn={flashLink === link.index}
          blockedAt={blocked?.link === link.index ? blocked.at : null}
          glowDelay={depths ? Math.max(depths[link.a], depths[link.b]) * waveStep : null}
        />
      ))}
      {drag &&
        drag.link === null &&
        links
          .filter(link => link.a === drag.source || link.b === drag.source)
          .map(link => {
            const lane = laneOf(geo, link);
            const stepPx = Math.max(6, geo.cell * 0.2);
            const dots: React.JSX.Element[] = [];
            for (let d = stepPx / 2; d < lane.length; d += stepPx) {
              const p = laneBox(lane, d, 0, 0, 0);
              dots.push(<Circle key={d} cx={p.x} cy={p.y} r={Math.max(1.5, geo.cell * 0.04)} color={harbourAccent()} opacity={0.6} />);
            }
            return <Group key={`lane-${link.index}`}>{dots}</Group>;
          })}
      {drag && drag.link !== null && (
        <DragGhost
          geo={geo}
          link={links[drag.link]}
          fromB={links[drag.link].b === drag.source}
          count={state.bridges[drag.link]}
          blocked={drag.blocked}
          snapped={drag.snapped}
          progress={dragProgress ?? drag.progress}
        />
      )}
      {puzzle.islands.map((island, i) => (
        <IslandSprite
          key={i}
          geo={geo}
          index={i}
          coast={coasts[i]}
          need={island.need}
          tone={tones[i]}
          introKey={introKey}
          introDelay={(island.row + island.col) * introStagger}
          solveDelay={depths ? depths[i] * waveStep : null}
          dragRole={drag?.source === i ? 'source' : target === i ? 'target' : null}
          dragBlocked={drag?.blocked ?? false}
          landKey={landKeys.current[i]}
          landDelay={landDelays.current[i]}
          reduced={reduced}
        />
      ))}
    </Group>
  );
}

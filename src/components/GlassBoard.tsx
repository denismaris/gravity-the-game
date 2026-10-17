/* eslint-disable react-native/no-inline-styles -- geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, LinearGradient, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { Easing, SharedValue, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { clashes, GlassColor, GlassPuzzle, GlassState } from '../game/glass';
import { shade, useReducedMotion } from '../game/rendering';
import { inkWash, theme } from '../theme';

/**
 * The window, in the same hand as every other board here: a paper tray
 * with the board's own light seam and an accent rim (Twos' tray), and on
 * it the panes as tiles - each the rounded outline of its cells, set a
 * little apart from its neighbours. A clear pane is an empty slot (the
 * bright paper face and a hairline rule, like Twos' empty cells); a
 * coloured one is a glazed tile, flat, standing on its own darker side
 * face - depth by geometry, as the Mosaic and Adjacent tiles have it,
 * never a gradient - with the glint of glass across it.
 *
 * Setting a pane floods its glaze out from the finger, the glint arriving
 * with it and a band of light sweeping once across (see `Glaze`); two
 * touching panes alike are ringed in red, breathing; and the finished
 * window has light pass through it - a sweep across the glass, each pane
 * lifting as it passes, sparkles, and a glow spreading from the frame.
 */
export function glassColor(color: GlassColor | null): string {
  return color === null ? theme.colors.surface : [theme.colors.glassRuby, theme.colors.glassCobalt, theme.colors.glassAmber, theme.colors.glassEmerald][color];
}

/**
 * Each glass's own faint texture, so the three are told apart by more than
 * colour (for anyone who sees ruby and amber alike), and so they read as
 * glass with a grain: cobalt is hatched, amber is seeded with small dots,
 * emerald is reeded (fine level ribs), ruby is clear. Returned as one path covering a square of half-side
 * `half` round (`cx`, `cy`) - the caller clips it to the pane - drawn as a
 * stroke for the hatch and a fill for the dots.
 */
export function glassTexture(color: GlassColor | null, cx: number, cy: number, half: number, cell: number): { path: string; style: 'stroke' | 'fill' } | null {
  if (color === 1) {
    const step = cell * 0.2;
    let d = '';
    for (let k = -2 * half; k <= 2 * half; k += step) d += `M ${cx + k - half} ${cy - half} L ${cx + k + half} ${cy + half} `;
    return { path: d, style: 'stroke' };
  }
  if (color === 2) {
    const step = cell * 0.24;
    const r = cell * 0.032;
    let d = '';
    for (let yy = cy - half, row = 0; yy <= cy + half; yy += step, row += 1) {
      for (let xx = cx - half + (row % 2) * step * 0.5; xx <= cx + half; xx += step) d += `M ${xx + r} ${yy} A ${r} ${r} 0 1 0 ${xx - r} ${yy} A ${r} ${r} 0 1 0 ${xx + r} ${yy} Z `;
    }
    return { path: d, style: 'fill' };
  }
  if (color === 3) {
    const step = cell * 0.16;
    let d = '';
    for (let yy = cy - half; yy <= cy + half; yy += step) d += `M ${cx - half} ${yy} L ${cx + half} ${yy} `;
    return { path: d, style: 'stroke' };
  }
  return null;
}

/** No arch any more: the window is a square tray like every other board.
 * Kept (at 0) so callers sizing the board need not change. */
export const GLASS_ARCH = 0;
/** The tray's margin round the panes, in cells. */
export const GLASS_PAD = 0.32;
const GAP = 0.07; // the gap between panes, in cells
const DEPTH = 0.08; // a glazed tile's side face, in cells

type SkPath = NonNullable<ReturnType<typeof Skia.Path.MakeFromSVGString>>;

interface Geometry {
  readonly cell: number;
  readonly inset: number;
  readonly paths: ReadonlyArray<SkPath | null>;
  readonly svg: ReadonlyArray<string>;
  readonly centres: ReadonlyArray<{ x: number; y: number }>;
  /** Each pane's cell centres, for how far a flood has to reach. */
  readonly cells: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
}

/**
 * A pane's outline: its cells' boundary, pulled in by half the gap on
 * every side (so panes stand apart like tiles), with every corner rounded.
 */
function outlineOf(puzzle: GlassPuzzle, pane: number, inset: number, cell: number): string {
  type Pt = readonly [number, number];
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const next = new Map<string, Pt[]>();
  const add = (a: Pt, b: Pt) => next.set(key(a), [...(next.get(key(a)) ?? []), b]);
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols ? -1 : puzzle.paneOf[r][c]);
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      if (puzzle.paneOf[r][c] !== pane) continue;
      if (at(r - 1, c) !== pane) add([c, r], [c + 1, r]);
      if (at(r, c + 1) !== pane) add([c + 1, r], [c + 1, r + 1]);
      if (at(r + 1, c) !== pane) add([c + 1, r + 1], [c, r + 1]);
      if (at(r, c - 1) !== pane) add([c, r + 1], [c, r]);
    }
  }
  const half = (GAP / 2) * cell;
  const radius = cell * 0.26;
  let d = '';
  while (next.size > 0) {
    const [startKey] = next.keys();
    const start = startKey.split(',').map(Number) as unknown as Pt;
    const loop: Pt[] = [start];
    let cur = start;
    for (let guard = 0; guard < 4 * puzzle.rows * puzzle.cols; guard += 1) {
      const k = key(cur);
      const outs = next.get(k);
      if (!outs || outs.length === 0) break;
      const to = outs.shift()!;
      if (outs.length === 0) next.delete(k);
      if (to[0] === start[0] && to[1] === start[1]) break;
      loop.push(to);
      cur = to;
    }
    const corners = loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    if (corners.length < 3) continue;
    // Each corner moved inward along both its edges' inner normals.
    const pts = corners.map((p, i) => {
      const a = corners[(i - 1 + corners.length) % corners.length];
      const b = corners[(i + 1) % corners.length];
      const n1 = [-Math.sign(p[1] - a[1]), Math.sign(p[0] - a[0])];
      const n2 = [-Math.sign(b[1] - p[1]), Math.sign(b[0] - p[0])];
      return [inset + p[0] * cell + (n1[0] + n2[0]) * half, inset + p[1] * cell + (n1[1] + n2[1]) * half] as const;
    });
    const toward = (from: readonly [number, number], to: readonly [number, number], dist: number): [number, number] => {
      const t = Math.min(0.5, dist / Math.hypot(to[0] - from[0], to[1] - from[1]));
      return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    };
    pts.forEach((p, i) => {
      const [ax, ay] = toward(p, pts[(i - 1 + pts.length) % pts.length], radius);
      const [bx, by] = toward(p, pts[(i + 1) % pts.length], radius);
      d += `${i === 0 ? 'M' : 'L'} ${ax.toFixed(2)} ${ay.toFixed(2)} Q ${p[0].toFixed(2)} ${p[1].toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)} `;
    });
    d += 'Z ';
  }
  return d;
}

function geometryOf(puzzle: GlassPuzzle, size: number): Geometry {
  const inset = (size / (puzzle.cols + GLASS_PAD * 2)) * GLASS_PAD;
  const cell = (size - inset * 2) / puzzle.cols;
  const cellsOf: Array<Array<{ x: number; y: number }>> = Array.from({ length: puzzle.panes }, () => []);
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) cellsOf[puzzle.paneOf[r][c]].push({ x: inset + c * cell + cell / 2, y: inset + r * cell + cell / 2 });
  }
  const svg = Array.from({ length: puzzle.panes }, (_v, p) => outlineOf(puzzle, p, inset, cell));
  const centres = cellsOf.map(cells => {
    const cx = cells.reduce((t, c) => t + c.x, 0) / cells.length;
    const cy = cells.reduce((t, c) => t + c.y, 0) / cells.length;
    return cells.reduce((best, c) => ((c.x - cx) ** 2 + (c.y - cy) ** 2 < (best.x - cx) ** 2 + (best.y - cy) ** 2 ? c : best), cells[0]);
  });
  return { cell, inset, paths: svg.map(d => Skia.Path.MakeFromSVGString(d)), svg, centres, cells: cellsOf };
}

export type StrokePhase = 'start' | 'move';

export function GlassBoard({
  puzzle,
  state,
  size,
  solved,
  onStroke,
  highlight,
  glow,
}: {
  puzzle: GlassPuzzle;
  state: GlassState;
  /** The window's width; it stands `size * (1 + GLASS_ARCH)` tall. */
  size: number;
  solved: boolean;
  /** A finger landing on (start) or sliding onto (move) a pane. */
  onStroke: (pane: number, phase: StrokePhase) => void;
  highlight?: number | null;
  /** A pane ringed steadily, for the lesson's "tap here". */
  glow?: number | null;
}): React.JSX.Element {
  const geo = useMemo(() => geometryOf(puzzle, size), [puzzle, size]);
  const reduced = useReducedMotion();
  const archH = size * GLASS_ARCH;

  // Each pane's glaze, and what it was before. A pane that changes colour
  // gets a new version - a fresh `Glaze` that starts its own flood from its
  // first frame, so the new colour never shows before the flood does, and
  // nothing has to be cleared away afterwards.
  const touchAt = useRef<{ x: number; y: number } | null>(null);
  const panes = useRef<{ colors: GlassState['colors']; version: number[]; from: Array<GlassColor | null>; origin: Array<{ x: number; y: number }>; animate: boolean[] } | null>(null);
  if (!panes.current || panes.current.version.length !== puzzle.panes) {
    panes.current = { colors: state.colors, version: state.colors.map(() => 0), from: [...state.colors], origin: [...geo.centres], animate: state.colors.map(() => false) };
  } else if (panes.current.colors !== state.colors) {
    const track = panes.current;
    const before = track.colors;
    const changed = state.colors.map((c, i) => (c !== before[i] ? i : -1)).filter(i => i >= 0);
    // A whole window changing at once (a restart) just appears.
    const animate = !reduced && changed.length < puzzle.panes / 2;
    for (const p of changed) {
      track.version[p] += 1;
      track.from[p] = before[p];
      track.origin[p] = touchAt.current && changed.length === 1 ? touchAt.current : geo.centres[p];
      track.animate[p] = animate;
    }
    track.colors = state.colors;
  }
  const track = panes.current;

  // The opening: the window's lead and clear panes are simply there with the
  // board; the set panes, the glazier's work, pop into place one after
  // another - solid, never see-through - on one clock, started a moment
  // after mount so the screen's own entrance has settled.
  const { givenOrder, givenCount } = useMemo(() => {
    // Top to bottom, left to right: the order a reader's eye takes.
    const set = puzzle.given.map((g, p) => (g !== null ? p : -1)).filter(p => p >= 0);
    set.sort((a, b) => geo.centres[a].y - geo.centres[b].y || geo.centres[a].x - geo.centres[b].x);
    const order = puzzle.given.map(() => 0);
    set.forEach((p, i) => (order[p] = i));
    return { givenOrder: order, givenCount: set.length };
  }, [puzzle, geo]);
  const intro = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      intro.value = 1;
      return;
    }
    intro.value = 0;
    intro.value = withDelay(INTRO_DELAY_MS, withTiming(1, { duration: introLength(givenCount), easing: Easing.linear }));
  }, [puzzle.id, reduced, intro, givenCount]);

  // The finish: one clock on the UI thread drives the whole of it.
  const finish = useSharedValue(0);
  useEffect(() => {
    if (solved && !reduced) finish.value = withDelay(40, withTiming(1, { duration: FINISH_MS, easing: Easing.linear }));
    else finish.value = 0;
  }, [solved, reduced, finish]);

  const clashing = useMemo(() => clashes(puzzle, state), [puzzle, state]);
  const clashPanes = useMemo(() => [...new Set(clashing.flat())], [clashing]);

  // The finger: one stroke can colour several panes.
  const lastPane = useRef<number | null>(null);
  const touch = (e: GestureResponderEvent, phase: StrokePhase) => {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    const c = Math.floor((x - geo.inset) / geo.cell);
    const r = Math.floor((y - geo.inset) / geo.cell);
    if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return;
    const pane = puzzle.paneOf[r][c];
    if (phase === 'move' && pane === lastPane.current) return;
    lastPane.current = pane;
    touchAt.current = { x, y };
    onStroke(pane, phase);
  };

  return (
    <View style={{ width: size, height: size + archH }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {solved && !reduced && <RimGlow size={size} t={finish} />}
        <Tray size={size} archH={archH} />
        <Group transform={[{ translateY: archH }]}>
          {geo.paths.map((path, p) =>
            path ? (
              <IntroPane key={`in:${puzzle.id}:${p}`} t={intro} centre={geo.centres[p]} order={givenOrder[p]} givens={givenCount} skip={reduced || puzzle.given[p] === null}>
              <Glaze
                key={`${p}:${track.version[p]}`}
                path={path}
                from={track.from[p]}
                to={state.colors[p]}
                given={puzzle.given[p] !== null}
                centre={geo.centres[p]}
                cell={geo.cell}
                origin={track.origin[p]}
                reach={geo.cells[p].reduce((far, q) => Math.max(far, Math.hypot(q.x - track.origin[p].x, q.y - track.origin[p].y)), 0) + geo.cell}
                animate={track.animate[p]}
                finish={finish}
                wave={(geo.centres[p].x + geo.centres[p].y) / (size * 2)}
              />
              </IntroPane>
            ) : null,
          )}
          <GlassMarks puzzle={puzzle} geo={geo} colors={state.colors} />
          {clashPanes.map(p => (geo.paths[p] ? <Clash key={p} path={geo.paths[p]!} /> : null))}
          {highlight !== null && highlight !== undefined && geo.paths[highlight] && <HintRing path={geo.paths[highlight]!} />}
          {glow !== null && glow !== undefined && geo.paths[glow] && <Path path={geo.paths[glow]!} color={theme.colors.accent} style="stroke" strokeWidth={3} />}
          {solved && !reduced && <FinishLight size={size} geo={geo} t={finish} />}
        </Group>
      </Canvas>
      {/* One surface for the finger: tap a pane, or draw across several. */}
      <View
        style={{ position: 'absolute', left: 0, top: archH, width: size, height: size }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => touch(e, 'start')}
        onResponderMove={e => touch(e, 'move')}
        onResponderRelease={() => {
          // The finger's point only means anything while it is down: a hint
          // or an undo afterwards floods from the pane's own centre.
          lastPane.current = null;
          touchAt.current = null;
        }}
        onResponderTerminate={() => {
          lastPane.current = null;
          touchAt.current = null;
        }}
        accessible
        accessibilityLabel={`Window of ${puzzle.panes} panes, ${state.colors.filter(c => c === null).length} still clear`}
      />
    </View>
  );
}

/**
 * The window drawn still, for pictures that only show it (the help
 * carousel): the same tray and panes as the board, with any clashes and
 * one pane ringed, and nothing moving.
 */
export function GlassStill({ puzzle, colors, size, ring }: { puzzle: GlassPuzzle; colors: GlassState['colors']; size: number; ring?: number }): React.JSX.Element {
  const geo = useMemo(() => geometryOf(puzzle, size), [puzzle, size]);
  const clashPanes = [...new Set(clashes(puzzle, { colors }).flat())];
  const still = useSharedValue(0);
  return (
    <Group>
      <Tray size={size} archH={0} />
      {geo.paths.map((path, p) =>
        path ? <Glaze key={p} path={path} from={colors[p]} to={colors[p]} given={puzzle.given[p] !== null} centre={geo.centres[p]} cell={geo.cell} origin={geo.centres[p]} reach={geo.cell * 4} animate={false} finish={still} wave={0} /> : null,
      )}
      <GlassMarks puzzle={puzzle} geo={geo} colors={colors} />
      {clashPanes.map(p => (geo.paths[p] ? <Path key={p} path={geo.paths[p]!} color={theme.colors.danger} style="stroke" strokeWidth={2} /> : null))}
      {ring !== undefined && geo.paths[ring] && <Path path={geo.paths[ring]!} color={theme.colors.accent} style="stroke" strokeWidth={2.5} />}
    </Group>
  );
}

/**
 * What a later window brings, drawn over its glass: vines. Each leaf pane
 * carries a small leaf at its heart - green on clear glass, pale once
 * glazed - and the two leaf panes of a vine are joined by a slender
 * climbing stem, an S of green with a leaflet or two along it, lying
 * across the lead between them.
 */
function GlassMarks({ puzzle, geo, colors }: { puzzle: GlassPuzzle; geo: Geometry; colors: GlassState['colors'] }): React.JSX.Element | null {
  if (!puzzle.vines?.length) return null;
  const k = geo.cell;
  const leaves = puzzle.vines.flat();
  return (
    <Group>
      {puzzle.vines.map(([a, b]) => {
        const p = geo.centres[a];
        const q = geo.centres[b];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const sway = Math.min(k * 0.55, len * 0.22);
        // An S: the stem leans one way, then the other.
        const c1 = { x: p.x + dx / 3 + nx * sway, y: p.y + dy / 3 + ny * sway };
        const c2 = { x: p.x + (dx * 2) / 3 - nx * sway, y: p.y + (dy * 2) / 3 - ny * sway };
        const d = `M ${p.x} ${p.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${q.x} ${q.y}`;
        const at = (t: number) => {
          const u = 1 - t;
          return {
            x: u * u * u * p.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * q.x,
            y: u * u * u * p.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * q.y,
          };
        };
        const leaflet = (t: number, side: number) => {
          const m = at(t);
          const tip = { x: m.x + (nx * side + dx / len * 0.6) * k * 0.22, y: m.y + (ny * side + dy / len * 0.6) * k * 0.22 };
          const w = k * 0.07;
          return `M ${m.x} ${m.y} Q ${(m.x + tip.x) / 2 + ny * w} ${(m.y + tip.y) / 2 - nx * w} ${tip.x} ${tip.y} Q ${(m.x + tip.x) / 2 - ny * w} ${(m.y + tip.y) / 2 + nx * w} ${m.x} ${m.y} Z`;
        };
        const green = theme.colors.glassEmerald;
        return (
          <Group key={`${a}-${b}`} opacity={0.85}>
            <Path path={d} color={shade(green, 0.6)} style="stroke" strokeWidth={k * 0.07} strokeCap="round" transform={[{ translateY: k * 0.02 }]} opacity={0.5} />
            <Path path={d} color={green} style="stroke" strokeWidth={k * 0.05} strokeCap="round" />
            <Path path={leaflet(0.36, 1)} color={green} />
            <Path path={leaflet(0.64, -1)} color={green} />
          </Group>
        );
      })}
      {leaves.map(pane => {
        const c = geo.centres[pane];
        const h = k * 0.26;
        const leaf = `M ${c.x - h * 0.75} ${c.y + h * 0.75} Q ${c.x - h * 0.9} ${c.y - h * 0.6} ${c.x + h * 0.75} ${c.y - h * 0.75} Q ${c.x + h * 0.6} ${c.y + h * 0.9} ${c.x - h * 0.75} ${c.y + h * 0.75} Z`;
        const rib = `M ${c.x - h * 0.95} ${c.y + h * 0.95} L ${c.x + h * 0.35} ${c.y - h * 0.35}`;
        const clear = colors[pane] === null;
        const ink = clear ? theme.colors.glassEmerald : theme.colors.surfaceHi;
        return (
          <Group key={`leaf-${pane}`} opacity={clear ? 0.85 : 0.6}>
            <Path path={leaf} color={ink} style={clear ? 'fill' : 'stroke'} strokeWidth={1.2} opacity={clear ? 0.35 : 1} />
            <Path path={leaf} color={ink} style="stroke" strokeWidth={1.2} />
            <Path path={rib} color={ink} style="stroke" strokeWidth={1} strokeCap="round" />
          </Group>
        );
      })}
    </Group>
  );
}

/** Twos' own paper tray: the board's light seam along the lower right,
 * and its rim in this game's colour. */
const Tray = React.memo(function TrayImpl({ size }: { size: number; archH: number }) {
  const r = 12;
  return (
    <Group>
      <Path path={`M ${r} 0 L ${size - r} 0 Q ${size} 0 ${size} ${r} L ${size} ${size - r} Q ${size} ${size} ${size - r} ${size} L ${r} ${size} Q 0 ${size} 0 ${size - r} L 0 ${r} Q 0 0 ${r} 0 Z`}>
        <LinearGradient start={vec(0, 0)} end={vec(size, size)} colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]} positions={[0, 0.55, 1]} />
      </Path>
      <Path path={`M ${size - 1.5} ${r} L ${size - 1.5} ${size - r} Q ${size - 1.5} ${size - 1.5} ${size - r} ${size - 1.5} L ${r} ${size - 1.5}`} color={inkWash(0.16)} style="stroke" strokeWidth={1.5} strokeCap="round" />
      <Path path={`M ${r} 1 L ${size - r} 1 Q ${size - 1} 1 ${size - 1} ${r} L ${size - 1} ${size - r} Q ${size - 1} ${size - 1} ${size - r} ${size - 1} L ${r} ${size - 1} Q 1 ${size - 1} 1 ${size - r} L 1 ${r} Q 1 1 ${r} 1 Z`} color={theme.colors.glassAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
});

const FILL_MS = 360;
// Lands inside the shared beat before the finish card (see
// `SOLVE_CELEBRATION_MS`): every part of it is over by about a second.
const FINISH_MS = 1000;

/**
 * One pane, and everything it does. At rest: an empty slot, or a glazed
 * tile on its side face with the glint of glass across it - flat, lighter
 * stripes at the same angle on every pane, as light through a window
 * falls; geometry, not a gradient.
 *
 * When it changes, the new glaze floods out from the finger over the old
 * one, the glint fades in with it, and a bright band of light sweeps once
 * across the pane - all on the UI thread, from this pane's first frame.
 * In the finish it lifts a little, in a wave across the window.
 */
function Glaze({
  path,
  from,
  to,
  given,
  centre,
  cell,
  origin,
  reach,
  animate,
  finish,
  wave,
}: {
  path: SkPath;
  from: GlassColor | null;
  to: GlassColor | null;
  given: boolean;
  centre: { x: number; y: number };
  cell: number;
  origin: { x: number; y: number };
  /** How far the flood must grow from `origin` to cover the whole pane. */
  reach: number;
  animate: boolean;
  finish: SharedValue<number>;
  /** 0 at the top left, 1 at the bottom right: when this pane's turn comes. */
  wave: number;
}): React.JSX.Element {
  const u = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) u.value = withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.cubic) });
  }, [animate, u]);

  const { x, y } = centre;
  const c = cell;
  const depth = c * DEPTH;
  const floodR = useDerivedValue(() => reach * u.value);
  const ringR = useDerivedValue(() => c * (0.2 + 0.7 * u.value));
  const ringO = useDerivedValue(() => (u.value >= 1 ? 0 : 0.55 * (1 - u.value)));
  // The glint arrives with the glaze, not after it.
  const glintIn = useDerivedValue(() => Math.min(1, u.value * 1.6));
  const sideIn = useDerivedValue(() => (to === null ? 1 - u.value : from === null ? Math.min(1, u.value * 2) : 1));
  // The sweep: a bright band crossing the pane, once.
  const sweep = useDerivedValue(() => {
    const v = Math.max(0, Math.min(1, (u.value - 0.15) / 0.85));
    const d = -c * 2.6 + c * 5.2 * v;
    return [{ translateX: d }, { translateY: d }];
  });
  const sweepO = useDerivedValue(() => {
    const v = Math.max(0, Math.min(1, (u.value - 0.15) / 0.85));
    return v <= 0 || v >= 1 ? 0 : 0.42 * Math.sin(Math.PI * v);
  });
  // The finish: a lift and a flash of light, in a wave across the window.
  const lift = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, (finish.value - wave * 0.38) / 0.3));
    const b = Math.sin(Math.PI * k);
    return [{ translateX: x }, { translateY: y - c * 0.05 * b }, { scale: 1 + 0.05 * b }, { translateX: -x }, { translateY: -y }];
  });
  const flash = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, (finish.value - wave * 0.38) / 0.3));
    return 0.32 * Math.sin(Math.PI * k);
  });

  const toFace = glassColor(to);
  const fromFace = glassColor(from);
  const sideColor = to !== null ? shade(toFace, 0.62) : from !== null ? shade(fromFace, 0.62) : null;
  const stripe = (k: number, w: number) => `M ${x - c * 2.2 + k} ${y + c * 1.6} L ${x - c * 2.2 + k + w} ${y + c * 1.6} L ${x + c * 1.6 + k + w} ${y - c * 2.2} L ${x + c * 1.6 + k} ${y - c * 2.2} Z`;
  const texture = useMemo(() => glassTexture(to, x, y, c * 4.5, c), [to, x, y, c]);

  return (
    <Group transform={lift}>
      {sideColor && (
        <Group transform={[{ translateY: depth }]} opacity={sideIn}>
          <Path path={path} color={sideColor} />
        </Group>
      )}
      <Path path={path} color={fromFace} />
      {from === null && <Path path={path} color={theme.colors.borderStrong} style="stroke" strokeWidth={1.2} />}
      <Group clip={path}>
        {/* The new glaze, flooding out from the finger. */}
        {(animate || from !== to) && <Circle cx={origin.x} cy={origin.y} r={floodR} color={toFace} />}
        {to !== null && (
          <Group opacity={glintIn}>
            {texture && <Path path={texture.path} color={shade(toFace, 0.78)} style={texture.style} strokeWidth={1} opacity={0.55} />}
            <Path path={stripe(0, c)} color="#FFFFFF" opacity={0.16} />
            <Path path={stripe(c * 1.3, c * 0.3)} color="#FFFFFF" opacity={0.1} />
          </Group>
        )}
        {to !== null && animate && (
          <Group transform={sweep} opacity={sweepO}>
            <Path path={stripe(c * 0.3, c * 0.55)} color="#FFFFFF" />
          </Group>
        )}
        {to !== null && <Path path={path} color="#FFFFFF" opacity={flash} />}
      </Group>
      {to !== null ? <Path path={path} color={shade(toFace, 0.8)} style="stroke" strokeWidth={1} /> : <Path path={path} color={theme.colors.borderStrong} style="stroke" strokeWidth={1.2} />}
      {to !== null && animate && <Circle cx={origin.x} cy={origin.y} r={ringR} color={theme.colors.surfaceHi} style="stroke" strokeWidth={1.5} opacity={ringO} />}
      {/* A pane set from the start wears a small inset ring, the way Twos
          marks its printed clues - set, not to be changed. */}
      {given && to !== null && <Circle cx={x} cy={y} r={c * 0.12} color={shade(toFace, 0.62)} style="stroke" strokeWidth={2} />}
    </Group>
  );
}

/** Opening: the panes come in from the top, row by row. */
/** The opening: how long after mount it starts, how far apart the set
 * panes pop in, and how long each pop takes. */
const INTRO_DELAY_MS = 120;
const POP_STAGGER_MS = 70;
const POP_MS = 360;
function introLength(givens: number): number {
  return Math.max(1, givens - 1) * POP_STAGGER_MS + POP_MS;
}

/**
 * A set pane's entrance: from nothing it springs up past its full size and
 * settles - solid the whole way, so it never looks half-drawn - in its
 * turn among the window's set panes. Every other pane is simply there.
 */
function IntroPane({ t, centre, order, givens, skip, children }: { t: SharedValue<number>; centre: { x: number; y: number }; order: number; givens: number; skip: boolean; children: React.ReactNode }): React.JSX.Element {
  const total = introLength(givens);
  const start = (order * POP_STAGGER_MS) / total;
  const share = POP_MS / total;
  const transform = useDerivedValue(() => {
    const u = Math.max(0, Math.min(1, (t.value - start) / share));
    if (u >= 1) return [{ translateX: 0 }];
    // Ease out with an overshoot: back(1.9).
    const c = 1.9;
    const e = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
    return [{ translateX: centre.x }, { translateY: centre.y }, { scale: Math.max(0, e) }, { translateX: -centre.x }, { translateY: -centre.y }];
  });
  if (skip) return <Group>{children}</Group>;
  return <Group transform={transform}>{children}</Group>;
}

/** Two touching panes alike, each ringed in red, breathing until fixed -
 * the same calm signal Twos' errors give. */
function Clash({ path }: { path: SkPath }): React.JSX.Element {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 220 }, () => {
      t.value = withRepeat(withSequence(withTiming(0.45, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
    });
  }, [t]);
  return <Path path={path} color={theme.colors.danger} style="stroke" strokeWidth={2.5} opacity={t} />;
}

/** A ring round the hinted pane, fading. */
function HintRing({ path }: { path: SkPath }): React.JSX.Element {
  const t = useSharedValue(1);
  useEffect(() => {
    t.value = 1;
    t.value = withDelay(500, withTiming(0, { duration: 900 }));
  }, [path, t]);
  return <Path path={path} color={theme.colors.accent} style="stroke" strokeWidth={3} opacity={t} />;
}

/**
 * The finished window. Light comes through: a broad band of it - three
 * stripes, soft to bright, drawn flat - sweeps across the glass from the
 * top left, each pane lifting and flashing as it passes (see `Glaze`),
 * and the lead round each pane catches it in gold as it goes by - the
 * window lit from behind, the way a real one is when the sun comes round.
 */
function FinishLight({ size, geo, t }: { size: number; geo: Geometry; t: SharedValue<number> }): React.JSX.Element {
  const glass = useMemo(() => Skia.Path.MakeFromSVGString(geo.svg.join(' ')), [geo]);
  const band = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, t.value / 0.62));
    const d = -size * 0.9 + size * 1.8 * Easing.inOut(Easing.cubic)(k);
    return [{ translateX: d }, { translateY: d }];
  });
  const bandO = useDerivedValue(() => (t.value <= 0 || t.value >= 0.62 ? 0 : 1));
  const stripe = (offset: number, w: number) => `M ${-size + offset} ${size} L ${-size + offset + w} ${size} L ${size + offset + w} ${-size} L ${size + offset} ${-size} Z`;
  if (!glass) return <Group />;
  return (
    <Group>
      <Group clip={glass} opacity={bandO}>
        <Group transform={band}>
          <Path path={stripe(size * 0.42, size * 0.34)} color="#FFFFFF" opacity={0.1} />
          <Path path={stripe(size * 0.5, size * 0.18)} color="#FFFFFF" opacity={0.16} />
          <Path path={stripe(size * 0.56, size * 0.06)} color="#FFFFFF" opacity={0.3} />
        </Group>
      </Group>
      {geo.paths.map((path, i) =>
        path ? <LeadGlow key={i} path={path} t={t} wave={(geo.centres[i].x + geo.centres[i].y) / (size * 2)} /> : null,
      )}
    </Group>
  );
}

/** One pane's lead catching the light: a gold line round it that
 * brightens as the band passes over and fades again - on the same wave
 * the pane itself lifts on (`Glaze`). */
function LeadGlow({ path, t, wave }: { path: SkPath; t: SharedValue<number>; wave: number }): React.JSX.Element {
  const o = useDerivedValue(() => {
    const k = Math.max(0, Math.min(1, (t.value - wave * 0.38) / 0.42));
    return 0.95 * Math.sin(Math.PI * k);
  });
  return <Path path={path} color={theme.colors.accent} style="stroke" strokeWidth={2.2} strokeJoin="round" opacity={o} />;
}

/** The frame's glow as the window finishes: a ring in the game's colour
 * spreading out from the tray and fading, twice. */
function RimGlow({ size, t }: { size: number; t: SharedValue<number> }): React.JSX.Element {
  return (
    <Group>
      {[0, 1].map(k => (
        <Ring key={k} size={size} t={t} at={0.1 + k * 0.2} />
      ))}
    </Group>
  );
}

function Ring({ size, t, at }: { size: number; t: SharedValue<number>; at: number }): React.JSX.Element {
  const grow = useDerivedValue(() => Math.max(0, Math.min(1, (t.value - at) / 0.5)));
  const inset = useDerivedValue(() => -10 * grow.value);
  const span = useDerivedValue(() => size + 20 * grow.value);
  const o = useDerivedValue(() => (grow.value <= 0 || grow.value >= 1 ? 0 : 0.5 * (1 - grow.value)));
  return <RoundedRect x={inset} y={inset} width={span} height={span} r={14} color={theme.colors.glassAccent} style="stroke" strokeWidth={2.5} opacity={o} />;
}

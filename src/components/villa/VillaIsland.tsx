import React, { useEffect, useMemo } from 'react';
import { Canvas, Circle, Group, Oval, Path, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { VillaPieceKind, VillaPlan } from '../../progression/villa';
import { useReducedMotion } from '../../game/rendering';
import { SkiaEntrance } from '../SkiaEntrance';

/**
 * A villa on its own floating island, drawn in isometric: every solid is
 * built from faces lit from the upper left - a bright top, a mid left
 * face, a deeper right face - so the depth is all geometry, never a
 * gradient. Buildings cast soft shadows on the stone, windows are arched
 * and shuttered, roofs are tiled in rows; by night the windows glow.
 *
 * `built` pieces of `plan` are standing; the piece at `fresh` (its index)
 * settles into place. The island fits itself to `width` x `height`.
 */
export function VillaIsland({
  plan,
  built,
  width,
  height,
  night = false,
  fresh = null,
}: {
  plan: VillaPlan;
  built: number;
  width: number;
  height: number;
  night?: boolean;
  fresh?: number | null;
}): React.JSX.Element {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t, reduced]);
  const shimmer = useDerivedValue(() => 0.35 + 0.45 * t.value);
  const glow = useDerivedValue(() => (night ? 0.4 : 0.18) + 0.15 * t.value);

  const scene = useMemo(() => drawVilla(plan, built, width, height, night), [plan, built, width, height, night]);

  return (
    <Canvas style={{ width, height }}>
      {scene.map(item => {
        const body = (
          <Group key={item.key}>
            {item.paths.map((p, i) => (
              <Path key={i} path={p.d} color={p.color} style={p.stroke ? 'stroke' : 'fill'} strokeWidth={p.stroke} strokeCap="round" opacity={p.opacity} />
            ))}
            {item.ovals?.map((o, i) => (
              <Oval key={`o${i}`} x={o.x} y={o.y} width={o.w} height={o.h} color={o.color} opacity={o.live === 'water' ? shimmer : o.live === 'glow' ? glow : o.opacity} />
            ))}
            {item.circles?.map((c, i) => (
              <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} color={c.color} opacity={c.live === 'glow' ? glow : c.opacity} />
            ))}
          </Group>
        );
        if (fresh === null || item.piece !== fresh) return body;
        return (
          <SkiaEntrance key={`${item.key}@fresh`} duration={720} overshoot={1.06} fadeShare={0.5} origin={vec(item.origin.x, item.origin.y)} reducedMotion={reduced}>
            {body}
          </SkiaEntrance>
        );
      })}
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// The drawing: plain data (paths and colours), worked out once per change.
// ---------------------------------------------------------------------------

interface Shape {
  d: string;
  color: string;
  stroke?: number;
  opacity?: number;
}
interface SceneItem {
  key: string;
  /** Which piece (its build index) this belongs to, or -1 for the island. */
  piece: number;
  origin: { x: number; y: number };
  paths: Shape[];
  ovals?: Array<{ x: number; y: number; w: number; h: number; color: string; opacity?: number; live?: 'water' | 'glow' }>;
  circles?: Array<{ cx: number; cy: number; r: number; color: string; opacity?: number; live?: 'glow' }>;
}

const N = 7;
/** How high the tallest thing reaches, and how deep the island hangs, in
 * vertical units - for fitting the drawing to its box. */
const Z_TOP = 4.4;
const Z_BOTTOM = 2.3;

type Pt = [number, number];

/** Where each style puts things, in plan space (before mirroring). */
interface Layout {
  pool: { x: number; y: number; w: number; d: number; kind: 'pool' | 'rock' | 'pond' | 'long' };
  trees: ReadonlyArray<Pt>;
  tree: 'cypress' | 'palm' | 'pine';
  garden: 'olives' | 'shrubs' | 'vines' | 'laurels';
  finale: 'fountain' | 'lamps' | 'braziers';
  lamps: ReadonlyArray<Pt>;
  walk: { x: number; y0: number; y1: number };
  pots: ReadonlyArray<Pt>;
}

const LAYOUTS: Record<string, Layout> = {
  classic: { pool: { x: 0.9, y: 3.4, w: 3.2, d: 1.8, kind: 'pool' }, trees: [[0.35, 3.3], [0.35, 4.55], [0.35, 5.8]], tree: 'cypress', garden: 'olives', finale: 'fountain', lamps: [[0.75, 3.15], [4.25, 5.45]], walk: { x: 4.75, y0: 3.1, y1: 5.8 }, pots: [[2.8, 6.2], [4.2, 6.25]] },
  courtyard: { pool: { x: 2.8, y: 2.9, w: 2.1, d: 2.1, kind: 'pool' }, trees: [[6.35, 4.0], [6.3, 6.3], [0.55, 6.35]], tree: 'palm', garden: 'olives', finale: 'fountain', lamps: [[2.6, 2.7], [5.1, 5.2]], walk: { x: 5.5, y0: 2.9, y1: 5.4 }, pots: [[2.2, 6.2], [3.6, 6.25]] },
  lighthouse: { pool: { x: 0.9, y: 3.6, w: 2.6, d: 1.8, kind: 'rock' }, trees: [[0.6, 6.1], [3.9, 6.25]], tree: 'pine', garden: 'shrubs', finale: 'lamps', lamps: [[3.9, 3.2], [3.9, 5.4], [2.0, 6.4]], walk: { x: 4.6, y0: 3.4, y1: 5.4 }, pots: [] },
  vineyard: { pool: { x: 0.9, y: 3.6, w: 2.4, d: 1.7, kind: 'pond' }, trees: [[0.35, 5.9], [1.6, 6.45], [2.9, 6.5]], tree: 'cypress', garden: 'vines', finale: 'lamps', lamps: [[3.6, 3.3], [3.6, 5.5]], walk: { x: 3.75, y0: 3.4, y1: 5.3 }, pots: [] },
  temple: { pool: { x: 1.0, y: 4.3, w: 3.6, d: 0.8, kind: 'long' }, trees: [[0.35, 4.3], [0.35, 5.6], [6.5, 6.5]], tree: 'cypress', garden: 'laurels', finale: 'braziers', lamps: [[0.75, 4.7], [4.85, 4.7]], walk: { x: 5.5, y0: 3.3, y1: 6.0 }, pots: [[2.0, 5.9], [3.4, 5.9]] },
  domed: { pool: { x: 0.9, y: 3.6, w: 3.2, d: 1.6, kind: 'pool' }, trees: [[0.4, 3.6], [0.45, 5.5], [6.3, 6.3]], tree: 'palm', garden: 'olives', finale: 'fountain', lamps: [[0.8, 3.4], [4.25, 5.4]], walk: { x: 4.75, y0: 3.2, y1: 5.8 }, pots: [[2.8, 6.2], [4.2, 6.25]] },
};

const GROUND: Record<string, string> = { classic: '#E9DCC3', courtyard: '#E6D2B0', lighthouse: '#EBDFC4', vineyard: '#9CB977', temple: '#F1EDE4', domed: '#D9A27A' };

export function drawVilla(plan: VillaPlan, built: number, W: number, H: number, night: boolean): SceneItem[] {
  // Fit: the island's diamond spans 7 tiles across; its height is half that
  // plus whatever stands on it and hangs below it.
  const zu = 0.6;
  const tw = Math.min((W * 0.94) / N, H / (N / 2 + (Z_TOP + Z_BOTTOM) * zu));
  const ZU = tw * zu;
  const total = (N / 2) * tw + (Z_TOP + Z_BOTTOM) * ZU;
  const ox = W / 2;
  const oy = (H - total) / 2 + Z_TOP * ZU;
  const P = (x: number, y: number, z: number): Pt => [ox + ((x - y) * tw) / 2, oy + ((x + y) * tw) / 4 - z * ZU];
  const poly = (...pts: Pt[]) => `M ${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')} Z`;
  const line = (a: Pt, b: Pt) => `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;

  const C = palette(night);
  const dim = (c: string, f: number) => (night ? shade(c, f) : c);
  // By night the house dims with everything else; its windows light up.
  const look = { ...plan.look, wall: dim(plan.look.wall, 0.62), roof: dim(plan.look.roof, 0.6), shutter: dim(plan.look.shutter, 0.6) };
  const style = look.style;
  const L = LAYOUTS[style];
  const has = (kind: VillaPieceKind) => plan.pieces.findIndex(p => p.kind === kind) < built;
  const indexOf = (kind: VillaPieceKind) => plan.pieces.findIndex(p => p.kind === kind);
  const win = night ? C.windowLit : C.window;
  // Mirrored villas swap the two ground axes: the same plan, turned.
  const M = (x: number, y: number): Pt => (look.mirrored ? [y, x] : [x, y]);
  const Pm = (x: number, y: number, z: number) => {
    const [a, b] = M(x, y);
    return P(a, b, z);
  };

  // ---- Primitives -----------------------------------------------------------
  // A box, in plan space: footprint (x, y, w, d), from z up h; its three
  // visible faces, lit from the upper left.
  const box = (x: number, y: number, w: number, d: number, z: number, h: number, base: string): Shape[] => {
    const [ax, ay] = M(x, y);
    const [bw, bd] = look.mirrored ? [d, w] : [w, d];
    return [
      { d: poly(P(ax, ay + bd, z), P(ax + bw, ay + bd, z), P(ax + bw, ay + bd, z + h), P(ax, ay + bd, z + h)), color: shade(base, 0.92) },
      { d: poly(P(ax + bw, ay, z), P(ax + bw, ay + bd, z), P(ax + bw, ay + bd, z + h), P(ax + bw, ay, z + h)), color: shade(base, 0.78) },
      { d: poly(P(ax, ay, z + h), P(ax + bw, ay, z + h), P(ax + bw, ay + bd, z + h), P(ax, ay + bd, z + h)), color: shade(base, 1.04) },
    ];
  };
  // Points on a footprint's two visible walls, in wall coordinates: u along
  // the wall, v up it. `alongX` is the wall at y + d; the other, at x + w.
  const alongX = (x: number, y: number, d: number) => (u: number, v: number) => Pm(x + u, y + d, v);
  const alongY = (x: number, y: number, w: number) => (u: number, v: number) => Pm(x + w, y + u, v);
  const arched = (at: (u: number, v: number) => Pt, u: number, v: number, ww: number, wh: number): string => {
    const pts: Pt[] = [at(u, v), at(u + ww, v), at(u + ww, v + wh)];
    for (let i = 1; i < 8; i += 1) {
      const a = (Math.PI * i) / 8;
      pts.push(at(u + ww / 2 + (Math.cos(a) * ww) / 2, v + wh + (Math.sin(a) * ww) / 2));
    }
    pts.push(at(u, v + wh));
    return poly(...pts);
  };
  const rect = (at: (u: number, v: number) => Pt, u: number, v: number, ww: number, wh: number) => poly(at(u, v), at(u + ww, v), at(u + ww, v + wh), at(u, v + wh));
  /** A window with its shutters. */
  const shuttered = (at: (u: number, v: number) => Pt, u: number, v: number): Shape[] => [
    { d: arched(at, u, v, 0.4, 0.38), color: win },
    { d: rect(at, u - 0.14, v, 0.12, 0.55), color: look.shutter },
    { d: rect(at, u + 0.42, v, 0.12, 0.55), color: look.shutter },
  ];
  // Round things: a plan circle of radius r is an ellipse on screen.
  const ellipse = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Pt[] =>
    Array.from({ length: n + 1 }, (_v, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
    });
  const radii = (r: number) => [r * tw * 0.7071, r * tw * 0.3536] as const;
  const cylinder = (x: number, y: number, z0: number, z1: number, r: number, base: string, top = true): Shape[] => {
    const [cx, y0] = Pm(x, y, z0);
    const [, y1] = Pm(x, y, z1);
    const [rx, ry] = radii(r);
    const body = poly([cx - rx, y1], [cx + rx, y1], ...ellipse(cx, y0, rx, ry, 0, Math.PI));
    const shadeSide = poly([cx + rx * 0.15, y1], [cx + rx, y1], ...ellipse(cx, y0, rx, ry, 0, Math.PI * 0.45));
    return [
      { d: body, color: shade(base, 0.94) },
      { d: shadeSide, color: shade(base, 0.78) },
      ...(top ? [{ d: poly(...ellipse(cx, y1, rx, ry, 0, Math.PI * 2, 20)), color: shade(base, 1.05) }] : []),
    ];
  };
  const cone = (x: number, y: number, z: number, r: number, h: number, base: string): Shape[] => {
    const [cx, by] = Pm(x, y, z);
    const [, ay] = Pm(x, y, z + h);
    const [rx, ry] = radii(r);
    return [
      { d: poly([cx, ay], ...ellipse(cx, by, rx, ry, Math.PI, 0)), color: shade(base, 0.82) },
      { d: poly([cx, ay], ...ellipse(cx, by, rx, ry, 0, Math.PI)), color: base },
      { d: poly([cx, ay], [cx + rx, by], ...ellipse(cx, by, rx, ry, 0, Math.PI * 0.45)), color: shade(base, 0.78) },
    ];
  };
  const dome = (x: number, y: number, z: number, r: number, base: string): Shape[] => {
    const [cx, by] = Pm(x, y, z);
    const [rx, ry] = radii(r);
    const hd = rx * 0.95;
    const cap = ellipse(cx, by, rx, hd, Math.PI, Math.PI * 2, 18);
    return [
      { d: poly(...ellipse(cx, by, rx, ry, 0, Math.PI), ...cap), color: base },
      { d: poly([cx + rx * 0.2, by - hd * 0.98], ...ellipse(cx, by, rx, hd, Math.PI * 1.55, Math.PI * 2, 8), ...ellipse(cx, by, rx, ry, 0, Math.PI * 0.4, 6)), color: shade(base, 0.8) },
      { d: poly(...ellipse(cx - rx * 0.35, by - hd * 0.55, rx * 0.16, hd * 0.2, 0, Math.PI * 2, 10)), color: shade(base, 1.25) },
      { d: line([cx, by - hd], [cx, by - hd - tw * 0.14]), color: C.bronze, stroke: 1.4 },
    ];
  };
  // A pitched roof along x (ridge at mid y), with rows of tiles.
  const gableX = (x: number, y: number, w: number, d: number, h: number, rise: number, over: number, roof = look.roof, wall = look.wall): Shape[] => {
    const mid = y + d / 2;
    const a = Pm(x - over, mid, h + rise);
    const b = Pm(x + w + over, mid, h + rise);
    const shapes: Shape[] = [
      { d: poly(Pm(x - over, y - over, h), Pm(x + w + over, y - over, h), b, a), color: shade(roof, 0.82) },
      { d: poly(Pm(x - over, y + d + over, h), Pm(x + w + over, y + d + over, h), b, a), color: roof },
      { d: poly(Pm(x + w, y, h), Pm(x + w, y + d, h), Pm(x + w, mid, h + rise)), color: shade(wall, 0.78) },
    ];
    const rows = Math.round(w / 0.28);
    for (let i = 1; i < rows; i += 1) {
      const u = x - over + ((w + over * 2) * i) / rows;
      shapes.push({ d: line(Pm(u, y + d + over, h), Pm(u, mid, h + rise)), color: shade(roof, 0.8), stroke: 0.8 });
    }
    shapes.push({ d: line(a, b), color: shade(roof, 0.65), stroke: 1.4 });
    return shapes;
  };
  // The same roof turned: ridge along y.
  const gableY = (x: number, y: number, w: number, d: number, h: number, rise: number, over: number): Shape[] => {
    const mid = x + w / 2;
    const a = Pm(mid, y - over, h + rise);
    const b = Pm(mid, y + d + over, h + rise);
    const shapes: Shape[] = [
      { d: poly(Pm(x - over, y - over, h), Pm(x - over, y + d + over, h), b, a), color: shade(look.roof, 0.82) },
      { d: poly(Pm(x + w + over, y - over, h), Pm(x + w + over, y + d + over, h), b, a), color: shade(look.roof, 0.86) },
      { d: poly(Pm(x, y + d, h), Pm(x + w, y + d, h), Pm(mid, y + d, h + rise)), color: shade(look.wall, 0.92) },
    ];
    const rows = Math.round(d / 0.28);
    for (let i = 1; i < rows; i += 1) {
      const u = y - over + ((d + over * 2) * i) / rows;
      shapes.push({ d: line(Pm(x + w + over, u, h), Pm(mid, u, h + rise)), color: shade(look.roof, 0.72), stroke: 0.8 });
    }
    shapes.push({ d: line(a, b), color: shade(look.roof, 0.65), stroke: 1.4 });
    return shapes;
  };
  const pyramid = (x: number, y: number, w: number, d: number, h: number, rise: number, over: number, roof = look.roof): Shape[] => {
    const apex = Pm(x + w / 2, y + d / 2, h + rise);
    const a = Pm(x - over, y + d + over, h);
    const b = Pm(x + w + over, y + d + over, h);
    const c = Pm(x + w + over, y - over, h);
    return [
      { d: poly(Pm(x - over, y - over, h), c, apex), color: shade(roof, 0.8) },
      { d: poly(a, b, apex), color: roof },
      { d: poly(b, c, apex), color: shade(roof, 0.78) },
      { d: line(b, apex), color: shade(roof, 0.62), stroke: 1.2 },
    ];
  };
  // A soft shadow on the ground, cast toward the lower right.
  const shadowOf = (x: number, y: number, w: number, d: number, h: number): Shape => {
    const k = Math.min(1.2, h * 0.45);
    return { d: poly(Pm(x + w, y, 0.005), Pm(x + w + k, y + k * 0.25, 0.005), Pm(x + w + k, y + d + k * 0.25, 0.005), Pm(x + k * 0.6, y + d + k * 0.15, 0.005), Pm(x, y + d, 0.005)), color: C.shadow, opacity: 0.16 };
  };
  const roundShadow = (x: number, y: number, r: number, h: number): Shape => {
    const [cx, cy] = Pm(x, y, 0);
    const [rx, ry] = radii(r);
    const k = Math.min(1.3, h * 0.4) * tw * 0.5;
    return { d: poly(...ellipse(cx + k, cy + k * 0.2, rx * 1.15, ry * 1.2, 0, Math.PI * 2, 16)), color: C.shadow, opacity: 0.15 };
  };

  const items: SceneItem[] = [];
  const origin = (x: number, y: number, z = 0) => {
    const [px, py] = Pm(x, y, z);
    return { x: px, y: py };
  };

  // ---- The island ------------------------------------------------------------
  const paved = has('terrace');
  const ground = paved ? dim(GROUND[style], 0.6) : C.grass;
  const edge: Pt[] = [P(0, N, -0.7), P(1.5, N, -1.3), P(3, N, -1.0), P(4.6, N, -1.7), P(6, N, -1.5), P(N, N, -2.3), P(N, 5.6, -1.6), P(N, 4.1, -1.9), P(N, 2.6, -1.2), P(N, 1.2, -1.5), P(N, 0, -0.7)];
  const joints = style === 'lighthouse' ? shade(ground, 0.93) : style === 'domed' ? shade(ground, 0.84) : shade(ground, 0.9);
  const islandPaths: Shape[] = [
    { d: poly(P(0, N, -0.7), ...edge.slice(1, -1), P(N, 0, -0.7), P(N, N, -0.7)), color: C.rockDeep },
    { d: poly(P(0, N, -0.7), P(1.5, N, -1.0), P(3, N, -0.85), P(4.6, N, -1.2), P(N, N, -1.4), P(N, N, -0.7)), color: C.rock },
    { d: poly(P(N, N, -0.7), P(N, N, -1.4), P(N, 4.1, -1.15), P(N, 1.2, -1.0), P(N, 0, -0.7)), color: shade(C.rock, 0.85) },
    { d: poly(P(0, N, 0), P(N, N, 0), P(N, N, -0.7), P(0, N, -0.7)), color: C.earth },
    { d: poly(P(N, 0, 0), P(N, N, 0), P(N, N, -0.7), P(N, 0, -0.7)), color: shade(C.earth, 0.82) },
    { d: poly(P(0, N, 0), P(N, N, 0), P(N, N, -0.16), P(0, N, -0.16)), color: shade(C.grass, 0.88) },
    { d: poly(P(N, 0, 0), P(N, N, 0), P(N, N, -0.16), P(N, 0, -0.16)), color: shade(C.grass, 0.74) },
    { d: poly(P(0, 0, 0), P(N, 0, 0), P(N, N, 0), P(0, N, 0)), color: ground },
  ];
  if (paved && style === 'vineyard') {
    // Grass stays; a gravel path runs from the front edge to the door.
    islandPaths.push({ d: poly(Pm(1.9, 2.6, 0.003), Pm(2.5, 2.6, 0.003), Pm(3.4, N, 0.003), Pm(2.6, N, 0.003)), color: dim('#DCCDB0', 0.6) });
  } else if (paved) {
    const step = style === 'temple' ? 1.75 : 1;
    for (let i = step; i < N - 0.1; i += step) {
      islandPaths.push({ d: line(P(i, 0.3, 0), P(i, N - 0.3, 0)), color: joints, stroke: 0.7 });
      islandPaths.push({ d: line(P(0.3, i, 0), P(N - 0.3, i, 0)), color: joints, stroke: 0.7 });
    }
    islandPaths.push({ d: poly(P(0, 0, 0), P(N, 0, 0), P(N, 0.3, 0), P(0, 0.3, 0)), color: C.grass });
    islandPaths.push({ d: poly(P(0, 0, 0), P(0.3, 0, 0), P(0.3, N, 0), P(0, N, 0)), color: C.grass });
  } else {
    for (const [x, y] of [
      [2, 2],
      [4.8, 4.4],
      [3.1, 5.2],
    ]) {
      islandPaths.push({ d: poly(P(x, y, 0), P(x + 0.55, y + 0.1, 0), P(x + 0.45, y + 0.5, 0), P(x - 0.05, y + 0.4, 0)), color: C.stone });
    }
  }
  items.push({ key: 'island', piece: -1, origin: { x: ox, y: oy }, paths: islandPaths });

  // ---- Water -----------------------------------------------------------------
  if (has('pool')) {
    const { x, y, w, d, kind } = L.pool;
    const paths: Shape[] = [];
    const ovals: SceneItem['ovals'] = [];
    const circles: SceneItem['circles'] = [];
    if (kind === 'rock' || kind === 'pond') {
      // An irregular basin: a rim of stone (or a grassy bank), water inside.
      const ring = (inset: number) => Array.from({ length: 12 }, (_v, i) => {
        const a = (Math.PI * 2 * i) / 12;
        const wobble = 1 + 0.08 * Math.sin(i * 2.3 + plan.index);
        return Pm(x + w / 2 + Math.cos(a) * (w / 2 - inset) * wobble, y + d / 2 + Math.sin(a) * (d / 2 - inset) * wobble, 0.01);
      });
      paths.push({ d: poly(...ring(0)), color: kind === 'rock' ? dim('#B8AE9E', 0.6) : shade(C.grass, 0.85) });
      paths.push({ d: poly(...ring(0.22)), color: kind === 'pond' ? dim('#6FA59A', 0.6) : C.water });
      if (kind === 'pond') {
        for (const [px, py] of [
          [x + w * 0.3, y + d * 0.4],
          [x + w * 0.6, y + d * 0.65],
          [x + w * 0.7, y + d * 0.35],
        ]) {
          const [cx, cy] = Pm(px, py, 0.02);
          ovals.push({ x: cx - tw * 0.16, y: cy - tw * 0.07, w: tw * 0.32, h: tw * 0.14, color: dim('#7FA85A', 0.6) });
        }
        const [fx, fy] = Pm(x + w * 0.6, y + d * 0.65, 0.03);
        circles.push({ cx: fx, cy: fy - tw * 0.02, r: tw * 0.04, color: '#F2B6C6' });
      }
    } else {
      paths.push({ d: poly(Pm(x, y, 0.01), Pm(x + w, y, 0.01), Pm(x + w, y + d, 0.01), Pm(x, y + d, 0.01)), color: C.rim });
      paths.push({ d: poly(Pm(x + 0.18, y + 0.18, 0.01), Pm(x + w - 0.18, y + 0.18, 0.01), Pm(x + w - 0.18, y + d - 0.18, 0.01), Pm(x + 0.18, y + d - 0.18, 0.01)), color: C.water });
      paths.push({ d: poly(Pm(x + 0.18, y + 0.18, 0.01), Pm(x + w - 0.18, y + 0.18, 0.01), Pm(x + w - 0.24, y + 0.32, 0.01), Pm(x + 0.24, y + 0.32, 0.01)), color: C.waterDeep });
      paths.push({ d: poly(Pm(x + 0.18, y + 0.18, 0.01), Pm(x + 0.32, y + 0.24, 0.01), Pm(x + 0.32, y + d - 0.24, 0.01), Pm(x + 0.18, y + d - 0.18, 0.01)), color: C.waterDeep });
    }
    const [cx, cy] = Pm(x + w * 0.55, y + d * 0.55, 0.01);
    ovals.push({ x: cx - tw * 0.6, y: cy - tw * 0.07, w: tw * 1.2, h: tw * 0.14, color: C.waterLight, live: 'water' });
    items.push({ key: 'pool', piece: indexOf('pool'), origin: origin(x + w / 2, y + d / 2), paths, ovals, circles });
  }

  const solids: Array<{ depth: number; item: SceneItem }> = [];
  const add = (dx: number, dy: number, item: SceneItem) => solids.push({ depth: dx + dy, item });

  // ---- The main building -----------------------------------------------------
  if (has('house')) {
    const piece = indexOf('house');
    if (style === 'classic' || style === 'vineyard') {
      const [x, y, w, d, h] = style === 'vineyard' ? [0.7, 0.7, 3.0, 1.9, 1.5] : [0.6, 0.7, look.houseLength, 2.0, 1.45];
      const front = alongX(x, y, d);
      const side = alongY(x, y, w);
      const paths: Shape[] = [
        shadowOf(x, y, w, d, h),
        ...box(x, y, w, d, 0, h, look.wall),
        { d: arched(front, w / 2 - 0.22, 0, 0.44, 0.55), color: C.door },
        ...shuttered(front, 0.45, 0.5),
        ...shuttered(front, w - 0.85, 0.5),
        { d: arched(side, d / 2 - 0.2, 0.55, 0.4, 0.38), color: win },
        { d: rect(front, 0, h - 0.12, w, 0.06), color: shade(look.wall, 0.82) },
        ...gableX(x, y, w, d, h, style === 'vineyard' ? 0.85 : 0.95, 0.18),
      ];
      if (style === 'vineyard') paths.push(...box(x + w * 0.72, y + d * 0.55, 0.3, 0.3, h + 0.2, 0.9, dim('#B98A5E', 0.6)), ...box(x + w * 0.7, y + d * 0.53, 0.34, 0.34, h + 1.1, 0.08, dim('#8C6A4E', 0.6)));
      add(x + w / 2, y + d / 2, { key: 'house', piece, origin: origin(x + w / 2, y + d), paths });
    } else if (style === 'courtyard') {
      // Two wings in an L: the back one along x, the near one along y.
      const a: [number, number, number, number, number] = [0.6, 0.6, 4.0, 1.5, 1.4];
      const b: [number, number, number, number, number] = [0.6, 2.1, 1.5, 2.9, 1.4];
      const pa: Shape[] = [shadowOf(...a), ...box(...a.slice(0, 4) as [number, number, number, number], 0, a[4], look.wall), ...shuttered(alongX(a[0], a[1], a[3]), 2.0, 0.5), ...shuttered(alongX(a[0], a[1], a[3]), 3.0, 0.5), { d: arched(alongX(a[0], a[1], a[3]), 1.65, 0, 0.44, 0.55), color: C.door }, ...gableX(a[0], a[1], a[2], a[3], a[4], 0.8, 0.16)];
      const pb: Shape[] = [shadowOf(...b), ...box(...b.slice(0, 4) as [number, number, number, number], 0, b[4], look.wall), ...shuttered(alongY(b[0], b[1], b[2]), 0.5, 0.5), ...shuttered(alongY(b[0], b[1], b[2]), 1.7, 0.5), { d: arched(alongX(b[0], b[1], b[3]), 0.55, 0.5, 0.4, 0.38), color: win }, ...gableY(b[0], b[1], b[2], b[3], b[4], 0.8, 0.16)];
      add(2.6, 1.35, { key: 'wingA', piece, origin: origin(2.6, 2.1), paths: pa });
      add(1.35, 3.55, { key: 'wingB', piece, origin: origin(1.35, 5.0), paths: pb });
    } else if (style === 'lighthouse') {
      const [x, y, w, d, h] = [0.7, 0.8, 2.6, 1.8, 1.2];
      const front = alongX(x, y, d);
      const paths: Shape[] = [
        shadowOf(x, y, w, d, h),
        ...box(x, y, w, d, 0, h, look.wall),
        // A flat roof behind a low parapet.
        { d: poly(Pm(x + 0.12, y + 0.12, h), Pm(x + w - 0.12, y + 0.12, h), Pm(x + w - 0.12, y + d - 0.12, h), Pm(x + 0.12, y + d - 0.12, h)), color: shade(look.wall, 0.86) },
        { d: rect(front, w / 2 - 0.2, 0, 0.4, 0.75), color: look.shutter },
        { d: rect(front, 0.4, 0.45, 0.42, 0.42), color: win },
        { d: rect(front, w - 0.82, 0.45, 0.42, 0.42), color: win },
        { d: rect(alongY(x, y, w), d / 2 - 0.21, 0.45, 0.42, 0.42), color: win },
        ...box(x + w * 0.65, y + 0.3, 0.28, 0.28, h, 0.45, look.wall),
      ];
      add(x + w / 2, y + d / 2, { key: 'house', piece, origin: origin(x + w / 2, y + d), paths });
    } else if (style === 'temple') {
      const [x, y, w, d] = [0.5, 0.5, 4.2, 2.8];
      const paths: Shape[] = [shadowOf(x, y, w, d, 1.9), ...box(x, y, w, d, 0, 0.18, look.wall), ...box(x + 0.2, y + 0.2, w - 0.4, d - 0.4, 0.18, 0.18, shade(look.wall, 0.98))];
      // The cella behind, then the columns in front, then the roof.
      paths.push(...box(x + 0.7, y + 0.5, w - 1.4, d - 1.3, 0.36, 1.3, dim('#E8D9BD', 0.6)));
      for (let i = 0; i < 6; i += 1) paths.push(...box(x + 0.3 + i * ((w - 0.84) / 5), y + d - 0.55, 0.24, 0.24, 0.36, 1.3, look.wall));
      for (let i = 0; i < 3; i += 1) paths.push(...box(x + w - 0.55, y + 0.35 + i * ((d - 0.9) / 2), 0.24, 0.24, 0.36, 1.3, look.wall));
      paths.push(...box(x + 0.2, y + 0.2, w - 0.4, d - 0.4, 1.66, 0.22, look.wall));
      paths.push(...gableX(x + 0.2, y + 0.2, w - 0.4, d - 0.4, 1.88, 0.55, 0.06, look.roof, look.wall));
      add(x + w / 2, y + d / 2, { key: 'house', piece, origin: origin(x + w / 2, y + d), paths });
    } else {
      // Domed: a white cube with a dome the colour of the sea.
      const [x, y, w, d, h] = [0.7, 0.7, 2.8, 2.2, 1.5];
      const front = alongX(x, y, d);
      const paths: Shape[] = [
        shadowOf(x, y, w, d, h + 1),
        ...box(x, y, w, d, 0, h, look.wall),
        { d: arched(front, w / 2 - 0.22, 0, 0.44, 0.6), color: look.shutter },
        { d: arched(front, 0.4, 0.55, 0.36, 0.36), color: win },
        { d: arched(front, w - 0.76, 0.55, 0.36, 0.36), color: win },
        { d: arched(alongY(x, y, w), d / 2 - 0.18, 0.55, 0.36, 0.36), color: win },
        ...cylinder(x + w / 2, y + d / 2, h, h + 0.25, 0.85, look.wall),
        ...dome(x + w / 2, y + d / 2, h + 0.25, 0.85, look.roof),
      ];
      add(x + w / 2, y + d / 2, { key: 'house', piece, origin: origin(x + w / 2, y + d), paths });
    }
  }

  // ---- The tower -------------------------------------------------------------
  if (has('tower')) {
    const piece = indexOf('tower');
    if (style === 'classic' || style === 'courtyard') {
      const storeys = style === 'courtyard' ? 1 : look.towerStoreys;
      const [x, y, w, d] = style === 'courtyard' ? [5.3, 0.8, 0.95, 0.95] : [4.7, 0.7, 1.3, 1.3];
      const h = 1.05 * storeys + 0.35;
      const front = alongX(x, y, d);
      const side = alongY(x, y, w);
      const paths: Shape[] = [shadowOf(x, y, w, d, h), ...box(x, y, w, d, 0, h, look.wall)];
      for (let i = 0; i < storeys; i += 1) paths.push({ d: arched(front, w / 2 - 0.17, 0.35 + i * 1.05, 0.34, 0.34), color: win }, { d: arched(side, d / 2 - 0.17, 0.35 + i * 1.05, 0.34, 0.34), color: win });
      if (style === 'courtyard') for (let i = 0; i < 3; i += 1) paths.push({ d: arched(front, 0.18 + i * 0.25, h - 0.32, 0.1, 0.08), color: C.door });
      paths.push({ d: rect(front, -0.04, h - 0.18, w + 0.04, 0.1), color: shade(look.wall, 0.85) }, ...pyramid(x, y, w, d, h, style === 'courtyard' ? 0.7 : 1.0, 0.16));
      add(x + w / 2, y + d / 2, { key: 'tower', piece, origin: origin(x + w / 2, y + d), paths });
    } else if (style === 'lighthouse') {
      const [x, y, r] = [5.1, 1.7, 0.6];
      const paths: Shape[] = [roundShadow(x, y, r, 4)];
      const bands = 5;
      for (let i = 0; i < bands; i += 1) paths.push(...cylinder(x, y, (i * 3.2) / bands, ((i + 1) * 3.2) / bands, r - i * 0.03, i % 2 === 0 ? look.wall : look.roof, i === bands - 1));
      paths.push(...cylinder(x, y, 3.2, 3.3, 0.75, dim('#3B3530', 0.6)));
      paths.push(...cylinder(x, y, 3.3, 3.85, 0.4, night ? '#F7D27A' : '#E9F0E6'));
      paths.push(...cone(x, y, 3.85, 0.5, 0.5, look.roof));
      const [lx, ly] = Pm(x, y, 3.58);
      add(x, y, { key: 'tower', piece, origin: origin(x, y), paths, circles: [{ cx: lx, cy: ly, r: tw * 0.75, color: C.glow, live: 'glow' }] });
    } else if (style === 'vineyard') {
      const [x, y, r] = [5.2, 1.5, 0.68];
      const paths: Shape[] = [roundShadow(x, y, r, 2.6), ...cylinder(x, y, 0, 2.3, r, dim('#CDBB9C', 0.6))];
      const [cx, cy] = Pm(x, y, 0);
      const [rx] = radii(r);
      for (const [dz, dx] of [
        [0.7, -0.3],
        [1.5, 0.25],
      ]) {
        paths.push({ d: poly(...ellipse(cx + dx * rx, cy - dz * ZU, rx * 0.16, rx * 0.26, 0, Math.PI * 2, 10)), color: win });
      }
      paths.push(...cone(x, y, 2.3, r + 0.12, 1.0, look.roof));
      add(x, y, { key: 'tower', piece, origin: origin(x, y), paths });
    } else if (style === 'temple') {
      const [x, y] = [5.5, 1.2];
      const paths: Shape[] = [shadowOf(x, y, 0.42, 0.42, 3), ...box(x - 0.15, y - 0.15, 0.72, 0.72, 0, 0.25, look.wall), ...box(x, y, 0.42, 0.42, 0.25, 2.6, look.wall), ...pyramid(x, y, 0.42, 0.42, 2.85, 0.5, 0, dim('#D9B65E', 0.6))];
      add(x, y, { key: 'tower', piece, origin: origin(x, y), paths });
    } else {
      const [x, y, r] = [5.3, 1.3, 0.34];
      const paths: Shape[] = [roundShadow(x, y, r, 3.4), ...cylinder(x, y, 0, 2.9, r, look.wall), ...cylinder(x, y, 2.2, 2.32, r + 0.14, shade(look.wall, 0.9)), ...dome(x, y, 2.9, r + 0.02, look.roof)];
      const [cx, cy] = Pm(x, y, 1.4);
      add(x, y, { key: 'tower', piece, origin: origin(x, y), paths, circles: [{ cx: cx - tw * 0.05, cy, r: tw * 0.06, color: win }] });
    }
  }

  // ---- The walk: colonnade, arcade or pergola --------------------------------
  if (has('colonnade')) {
    const { x, y0, y1 } = L.walk;
    const h = 1.3;
    const count = style === 'temple' ? 5 : 3;
    const postColor = look.pergola ? C.timber : C.column;
    const paths: Shape[] = [];
    const circles: SceneItem['circles'] = [];
    for (let i = 0; i < count; i += 1) paths.push(...box(x, y0 + (i * (y1 - y0 - 0.22)) / (count - 1), 0.22, 0.22, 0, h, postColor));
    if (look.pergola) {
      paths.push(...box(x - 0.1, y0 - 0.1, 0.42, y1 - y0 + 0.1, h, 0.1, C.timber));
      for (let i = 0; i < 9; i += 1) {
        const [cx, cy] = Pm(x + 0.1 + (i % 2) * 0.12, y0 + 0.1 + i * ((y1 - y0) / 9), h + 0.16);
        circles.push({ cx, cy, r: tw * 0.16, color: i % 3 === 0 ? C.vineDark : C.vine });
        if (style === 'vineyard' && i % 2 === 1) circles.push({ cx: cx + tw * 0.06, cy: cy + tw * 0.12, r: tw * 0.05, color: dim('#6B3E78', 0.6) });
      }
    } else {
      paths.push(...box(x - 0.08, y0 - 0.08, 0.38, y1 - y0 + 0.06, h, 0.16, C.column));
    }
    add(x, (y0 + y1) / 2, { key: 'walk', piece: indexOf('colonnade'), origin: origin(x, y1), paths, circles });
  }

  // ---- Trees -----------------------------------------------------------------
  if (has('cypresses')) {
    for (const [i, [tx, ty]] of L.trees.entries()) {
      const [bx, by] = Pm(tx, ty, 0);
      const key = `tree${i}`;
      const piece = indexOf('cypresses');
      if (L.tree === 'cypress') {
        const [, top] = Pm(tx, ty, 2.5 - (i % 2) * 0.35);
        const half = tw * 0.17;
        const mid = (by + top) / 2;
        add(tx, ty, {
          key,
          piece,
          origin: { x: bx, y: by },
          paths: [
            { d: `M ${bx - half} ${by - tw * 0.05} Q ${bx - half * 1.45} ${mid} ${bx} ${top} Q ${bx + half * 1.45} ${mid} ${bx + half} ${by - tw * 0.05} Z`, color: C.cypress },
            { d: `M ${bx} ${top} Q ${bx + half * 1.45} ${mid} ${bx + half} ${by - tw * 0.05} L ${bx} ${by - tw * 0.05} Z`, color: shade(C.cypress, 0.78) },
          ],
          ovals: [{ x: bx - half * 1.3, y: by - tw * 0.06, w: half * 2.6, h: tw * 0.14, color: C.shadow, opacity: 0.18 }],
        });
      } else if (L.tree === 'palm') {
        const lean = (i % 2 === 0 ? 1 : -1) * tw * 0.22;
        const [, top] = Pm(tx, ty, 2.6 - (i % 2) * 0.3);
        const tx2 = bx + lean;
        const fronds: Shape[] = [];
        for (let f = 0; f < 7; f += 1) {
          const a = (Math.PI * 2 * f) / 7 + 0.3;
          const len = tw * 0.75;
          const ex = tx2 + Math.cos(a) * len;
          const ey = top + Math.sin(a) * len * 0.45 + tw * 0.22;
          const mx = (tx2 + ex) / 2;
          const my = (top + ey) / 2 - tw * 0.22;
          fronds.push({ d: `M ${tx2} ${top} Q ${mx - Math.sin(a) * tw * 0.12} ${my} ${ex} ${ey} Q ${mx + Math.sin(a) * tw * 0.12} ${my + tw * 0.08} ${tx2} ${top} Z`, color: f % 2 === 0 ? C.palm : shade(C.palm, 0.8) });
        }
        add(tx, ty, {
          key,
          piece,
          origin: { x: bx, y: by },
          paths: [{ d: `M ${bx} ${by} Q ${bx + lean * 0.2} ${(by + top) / 2} ${tx2} ${top}`, color: C.palmTrunk, stroke: tw * 0.09 }, ...fronds],
          ovals: [{ x: bx - tw * 0.3, y: by - tw * 0.05, w: tw * 0.6, h: tw * 0.12, color: C.shadow, opacity: 0.18 }],
          circles: [{ cx: tx2, cy: top + tw * 0.04, r: tw * 0.06, color: dim('#7A5A2E', 0.6) }],
        });
      } else {
        const [, top] = Pm(tx, ty, 2.1);
        const lean = tw * 0.25;
        add(tx, ty, {
          key,
          piece,
          origin: { x: bx, y: by },
          paths: [{ d: `M ${bx} ${by} Q ${bx + lean * 0.2} ${(by + top) / 2} ${bx + lean} ${top}`, color: C.trunk, stroke: tw * 0.08 }],
          ovals: [
            { x: bx - tw * 0.35, y: by - tw * 0.05, w: tw * 0.7, h: tw * 0.12, color: C.shadow, opacity: 0.18 },
            { x: bx + lean - tw * 0.62, y: top - tw * 0.22, w: tw * 1.24, h: tw * 0.36, color: shade(C.pine, 0.8) },
            { x: bx + lean - tw * 0.5, y: top - tw * 0.32, w: tw * 1.0, h: tw * 0.3, color: C.pine },
          ],
        });
      }
    }
  }

  // ---- The garden ------------------------------------------------------------
  if (has('olives')) {
    const piece = indexOf('olives');
    if (L.garden === 'olives') {
      const [ox2, oy2] = style === 'courtyard' ? [4.4, 6.1] : [5.9, 5.9];
      const [bx, by] = Pm(ox2, oy2, 0);
      const r = tw * 0.36;
      add(ox2, oy2, {
        key: 'olive',
        piece,
        origin: { x: bx, y: by },
        paths: [{ d: `M ${bx - tw * 0.05} ${by} Q ${bx - tw * 0.12} ${by - r * 1.2} ${bx} ${by - r * 1.9} L ${bx + tw * 0.05} ${by - r * 1.8} Q ${bx} ${by - r} ${bx + tw * 0.06} ${by} Z`, color: C.trunk }],
        ovals: [{ x: bx - r * 1.4, y: by - tw * 0.08, w: r * 2.8, h: tw * 0.18, color: C.shadow, opacity: 0.18 }],
        circles: [
          { cx: bx - r * 0.7, cy: by - r * 2.0, r: r * 0.8, color: C.olive },
          { cx: bx + r * 0.6, cy: by - r * 2.2, r: r * 0.85, color: C.oliveDark },
          { cx: bx, cy: by - r * 2.7, r: r * 0.85, color: C.olive },
          { cx: bx - r * 0.2, cy: by - r * 2.1, r: r * 0.55, color: C.oliveLight },
        ],
      });
    } else if (L.garden === 'vines') {
      for (let i = 0; i < 6; i += 1) {
        const y = 3.2 + i * 0.6;
        const grapes: SceneItem['circles'] = [];
        for (let g = 0; g < 4; g += 1) {
          const [gx, gy] = Pm(4.7 + g * 0.5, y + 0.2, 0.22);
          grapes.push({ cx: gx, cy: gy, r: tw * 0.045, color: dim('#6B3E78', 0.6) });
        }
        add(5.6, y, { key: `vine${i}`, piece, origin: origin(5.6, y), paths: box(4.5, y, 2.2, 0.18, 0, 0.42, C.vine), circles: grapes });
      }
    } else {
      // Shrubs on the shore, or clipped laurels in pots.
      const spots: Pt[] = L.garden === 'laurels' ? [...L.pots] : [[5.9, 5.8], [4.7, 6.35], [6.4, 4.4]];
      for (const [i, [sx, sy]] of spots.entries()) {
        const [cx, cy] = Pm(sx + 0.2, sy + 0.2, L.garden === 'laurels' ? 0.4 : 0);
        const paths = L.garden === 'laurels' ? box(sx, sy, 0.42, 0.42, 0, 0.36, C.terracotta) : [];
        add(sx, sy, {
          key: `shrub${i}`,
          piece,
          origin: origin(sx, sy),
          paths,
          circles:
            L.garden === 'laurels'
              ? [
                  { cx, cy: cy - tw * 0.28, r: tw * 0.3, color: C.laurel },
                  { cx: cx + tw * 0.08, cy: cy - tw * 0.25, r: tw * 0.22, color: shade(C.laurel, 0.82) },
                ]
              : [
                  { cx: cx - tw * 0.18, cy: cy - tw * 0.12, r: tw * 0.22, color: C.shrub },
                  { cx: cx + tw * 0.12, cy: cy - tw * 0.16, r: tw * 0.26, color: shade(C.shrub, 0.82) },
                  { cx, cy: cy - tw * 0.3, r: tw * 0.2, color: shade(C.shrub, 1.1) },
                ],
        });
      }
    }
    if (L.garden === 'olives') {
      for (const [i, [px, py]] of L.pots.entries()) {
        const [cx, cy] = Pm(px + 0.2, py + 0.2, 0.42);
        add(px, py, {
          key: `pot${i}`,
          piece,
          origin: origin(px, py),
          paths: box(px, py, 0.42, 0.42, 0, 0.36, C.terracotta),
          circles: [
            { cx, cy: cy - tw * 0.1, r: tw * 0.2, color: C.leaf },
            { cx: cx + tw * 0.07, cy: cy - tw * 0.12, r: tw * 0.05, color: C.lemon },
            { cx: cx - tw * 0.08, cy: cy - tw * 0.05, r: tw * 0.045, color: C.lemon },
          ],
        });
      }
    }
  }

  // ---- The finishing touch: fountain, lanterns or braziers -------------------
  if (has('fountain')) {
    const piece = indexOf('fountain');
    if (L.finale === 'fountain') {
      const [fx, fy] = Pm(6.0, 2.9, 0);
      const R = tw * 0.62;
      add(6.0, 2.9, {
        key: 'fountain',
        piece,
        origin: { x: fx, y: fy },
        paths: [
          { d: `M ${fx - R} ${fy - R * 0.05} L ${fx - R} ${fy - R * 0.3} L ${fx + R} ${fy - R * 0.3} L ${fx + R} ${fy - R * 0.05} Z`, color: shade(C.column, 0.86) },
          { d: `M ${fx - tw * 0.07} ${fy - R * 0.3} L ${fx + tw * 0.07} ${fy - R * 0.3} L ${fx + tw * 0.05} ${fy - R * 1.05} L ${fx - tw * 0.05} ${fy - R * 1.05} Z`, color: C.column },
        ],
        ovals: [
          { x: fx - R, y: fy - R * 0.55, w: R * 2, h: R * 0.5, color: C.column },
          { x: fx - R * 0.82, y: fy - R * 0.5, w: R * 1.64, h: R * 0.38, color: C.water },
          { x: fx - R * 0.5, y: fy - R * 0.45, w: R, h: R * 0.18, color: C.waterLight, live: 'water' },
          { x: fx - R * 0.42, y: fy - R * 1.2, w: R * 0.84, h: R * 0.26, color: C.column },
        ],
        circles: [{ cx: fx, cy: fy - R * 1.32, r: tw * 0.07, color: C.waterLight }],
      });
    }
    for (const [i, [lx, ly]] of L.lamps.entries()) {
      const [bx, by] = Pm(lx, ly, 0);
      if (L.finale === 'braziers') {
        const [, ty] = Pm(lx, ly, 0.75);
        add(lx, ly, {
          key: `fire${i}`,
          piece,
          origin: { x: bx, y: by },
          paths: [
            { d: line([bx - tw * 0.14, by], [bx, ty]), color: C.bronze, stroke: 1.4 },
            { d: line([bx + tw * 0.14, by], [bx, ty]), color: C.bronze, stroke: 1.4 },
            { d: `M ${bx - tw * 0.2} ${ty} Q ${bx} ${ty + tw * 0.2} ${bx + tw * 0.2} ${ty} Z`, color: C.bronze },
            { d: `M ${bx - tw * 0.12} ${ty} Q ${bx - tw * 0.06} ${ty - tw * 0.3} ${bx} ${ty - tw * 0.42} Q ${bx + tw * 0.08} ${ty - tw * 0.26} ${bx + tw * 0.12} ${ty} Z`, color: '#F29A3E' },
          ],
          circles: [{ cx: bx, cy: ty - tw * 0.1, r: tw * 0.42, color: C.glow, live: 'glow' }],
        });
      } else {
        const [, ty] = Pm(lx, ly, 1.15);
        add(lx, ly, {
          key: `lamp${i}`,
          piece,
          origin: { x: bx, y: by },
          paths: [{ d: `M ${bx - tw * 0.025} ${by} L ${bx + tw * 0.025} ${by} L ${bx + tw * 0.025} ${ty} L ${bx - tw * 0.025} ${ty} Z`, color: C.iron }],
          circles: [
            { cx: bx, cy: ty, r: tw * 0.32, color: C.glow, live: 'glow' },
            { cx: bx, cy: ty, r: tw * 0.07, color: C.flame },
          ],
        });
      }
    }
  }

  solids.sort((a, b) => a.depth - b.depth);
  items.push(...solids.map(s => s.item));
  return items;
}

function palette(night: boolean) {
  const day = {
    grass: '#9CB977',
    paving: '#E9DCC3',
    joint: '#D6C5A6',
    earth: '#B98A5E',
    rock: '#8C7A68',
    rockDeep: '#6E5F52',
    stone: '#CFC2A8',
    rim: '#F1E8D6',
    water: '#5DA6C6',
    waterDeep: '#3F87A8',
    waterLight: '#D6F0F7',
    door: '#5B3B2C',
    window: '#3E4B57',
    windowLit: '#F3C766',
    column: '#F4EFE4',
    timber: '#8A5C3B',
    vine: '#7FA85A',
    vineDark: '#5E8A44',
    cypress: '#3F6B45',
    olive: '#8EA36B',
    oliveDark: '#77905A',
    oliveLight: '#A9BB86',
    trunk: '#6B4A33',
    leaf: '#6A9152',
    lemon: '#F2C94C',
    terracotta: '#BE6A3E',
    iron: '#3B3530',
    flame: '#FFD98A',
    glow: '#FFD26B',
    shadow: '#2E2418',
    bronze: '#8C6A2C',
    palm: '#5E9A4E',
    palmTrunk: '#9C7A52',
    pine: '#3F6B45',
    shrub: '#6E9A58',
    laurel: '#4F7E46',
  };
  if (!night) return day;
  return {
    ...day,
    grass: '#4F6A48',
    paving: '#8A7F6C',
    joint: '#776D5C',
    earth: '#6A5240',
    rock: '#4E4740',
    rockDeep: '#3A3530',
    stone: '#77705F',
    rim: '#A39985',
    water: '#2F5E78',
    waterDeep: '#22495F',
    waterLight: '#8DB6CA',
    column: '#B9B2A4',
    cypress: '#26402C',
    olive: '#566747',
    oliveDark: '#475939',
    oliveLight: '#68794F',
    leaf: '#3F5A34',
    shadow: '#000000',
    palm: '#365C2E',
    palmTrunk: '#5C4A34',
    pine: '#26402C',
    shrub: '#3F5A34',
    laurel: '#2F4A29',
  };
}

/** Lightens (>1) or darkens (<1) a hex colour. */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

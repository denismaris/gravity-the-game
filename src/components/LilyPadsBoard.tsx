/* eslint-disable react-native/no-inline-styles -- geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, LinearGradient, Oval, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import {
  Easing,
  runOnUI,
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Cell, DIRECTIONS, LilyPuzzle, LilyState, padCell } from '../game/lilypads';
import { DealIn, dealDelay, shade, useDealing, useReducedMotion } from '../game/rendering';
import { inkWash, theme } from '../theme';

/**
 * The pond, in the same hand as every other board: Twos' paper tray with
 * its light seam and an accent rim, and inside it still water. Each pad is
 * a round leaf with its notch, standing on a darker side face (depth by
 * shape, never a gradient), its veins drawn in.
 *
 * The frog lives: it breathes, and blinks now and then. A hop is a crouch,
 * an arc - its shadow staying on the water - and a landing that dips the
 * pad and sends out a ring; the pad it left sinks in a ripple. Pads in
 * reach wear a pale ring that breathes; a pad cut off pulses red; a
 * stranded frog shakes its head. A cleared pond ripples out from the last
 * pad, a water lily opens under the frog, and it hops for joy.
 */
const PAD = 0.32; // tray margin, in cells
export const HOP_MS = 420;

export interface LilyGeo {
  readonly cell: number;
  readonly inset: number;
  readonly centre: (row: number, col: number) => { x: number; y: number };
}

export function lilyGeometry(size: number, cells: number): LilyGeo {
  const inset = (size / (cells + PAD * 2)) * PAD;
  const cell = (size - inset * 2) / cells;
  return { cell, inset, centre: (row, col) => ({ x: inset + col * cell + cell / 2, y: inset + row * cell + cell / 2 }) };
}

/** A leaf: a disc with a wedge cut to its centre. */
function leafPath(x: number, y: number, r: number, turn: number): string {
  const a1 = turn - 0.3;
  const a2 = turn + 0.3;
  const p1 = { x: x + Math.cos(a1) * r, y: y + Math.sin(a1) * r };
  const p2 = { x: x + Math.cos(a2) * r, y: y + Math.sin(a2) * r };
  return `M ${x + Math.cos(turn) * r * 0.1} ${y + Math.sin(turn) * r * 0.1} L ${p1.x} ${p1.y} A ${r} ${r} 0 1 0 ${p2.x} ${p2.y} Z`;
}

/** Each pad's notch faces its own way, fixed by where it sits. */
function notchTurn(row: number, col: number): number {
  return (((row * 7 + col * 13) % 8) / 8) * Math.PI * 2 + 0.4;
}

export function LilyPadsBoard({
  puzzle,
  state,
  size,
  solved,
  reach,
  cutOff,
  stranded,
  onHop,
  onRefused,
  glow,
  trail = [],
}: {
  puzzle: LilyPuzzle;
  state: LilyState;
  size: number;
  solved: boolean;
  /** Pads in reach, ringed. */
  reach: ReadonlyArray<number>;
  /** Pads that can never be reached again, pulsing red. */
  cutOff: ReadonlyArray<number>;
  stranded: boolean;
  onHop: (pad: number) => void;
  /** A tap or swipe that leads nowhere. */
  onRefused?: () => void;
  /** A pad ringed steadily (a hint, a lesson's "here"). */
  glow?: number | null;
  /** The pads the frog has sat on, oldest first, ending where it is: its
   * last few hops are drawn as a faint dotted trail over the water. */
  trail?: ReadonlyArray<number>;
}): React.JSX.Element {
  const dealing = useDealing();
  const geo = useMemo(() => lilyGeometry(size, puzzle.size), [size, puzzle.size]);
  const reduced = useReducedMotion();
  const r = geo.cell * 0.42;
  // Where each pad is now: drifting pads move, so never `puzzle.pads`.
  const cellOf = (i: number) => padCell(puzzle, state, i);

  // Pads that just sank, kept a moment to go under.
  const before = useRef(state.afloat);
  const [sinking, setSinking] = useState<Array<{ pad: number; key: number }>>([]);
  if (before.current !== state.afloat) {
    const was = before.current;
    before.current = state.afloat;
    const gone = was.length === state.afloat.length ? state.afloat.map((a, i) => (was[i] && !a ? i : -1)).filter(i => i >= 0) : [];
    if (!reduced && gone.length > 0 && gone.length < 3) setSinking(s => [...s, ...gone.map(pad => ({ pad, key: Date.now() + pad }))]);
  }
  // Lotus flowers that just went under, their pads left floating.
  const lotusBefore = useRef(state.lotus);
  const [falling, setFalling] = useState<Array<{ pad: number; key: number }>>([]);
  if (lotusBefore.current !== state.lotus) {
    const was = lotusBefore.current;
    lotusBefore.current = state.lotus;
    const gone = was && state.lotus && was.length === state.lotus.length ? state.lotus.map((l, i) => (was[i] && !l ? i : -1)).filter(i => i >= 0) : [];
    if (!reduced && gone.length > 0) setFalling(f => [...f, ...gone.map(pad => ({ pad, key: Date.now() + pad }))]);
  }
  useEffect(() => {
    if (falling.length === 0) return;
    const id = setTimeout(() => setFalling([]), HOP_MS + 900);
    return () => clearTimeout(id);
  }, [falling]);
  useEffect(() => {
    if (sinking.length === 0) return;
    const id = setTimeout(() => setSinking([]), HOP_MS + 900);
    return () => clearTimeout(id);
  }, [sinking]);

  // The frog: from, to and how far along the hop; set together on the UI
  // thread, so it never shows at the new pad before the hop begins.
  const start = geo.centre(cellOf(state.at).row, cellOf(state.at).col);
  const fromX = useSharedValue(start.x);
  const fromY = useSharedValue(start.y);
  const toX = useSharedValue(start.x);
  const toY = useSharedValue(start.y);
  const t = useSharedValue(1);
  const lastAt = useRef(state.at);
  // Where the frog last sat, kept as a point: the pad it left may drift on.
  const lastSpot = useRef(start);
  const [landing, setLanding] = useState<{ pad: number; key: number } | null>(null);
  useEffect(() => {
    const prev = lastAt.current;
    lastAt.current = state.at;
    const here = padCell(puzzle, state, state.at);
    const target = geo.centre(here.row, here.col);
    const was = lastSpot.current;
    lastSpot.current = target;
    if (prev === state.at) {
      // The board resized: the frog simply sits where it is.
      runOnUI((tx: number, ty: number) => {
        'worklet';
        fromX.value = tx;
        fromY.value = ty;
        toX.value = tx;
        toY.value = ty;
      })(target.x, target.y);
      return;
    }
    const origin = prev < puzzle.pads.length ? was : target;
    runOnUI((ox: number, oy: number, tx: number, ty: number, run: boolean) => {
      'worklet';
      fromX.value = ox;
      fromY.value = oy;
      toX.value = tx;
      toY.value = ty;
      if (run) {
        t.value = 0;
        t.value = withTiming(1, { duration: HOP_MS, easing: Easing.inOut(Easing.quad) });
      } else {
        t.value = 1;
      }
    })(origin.x, origin.y, target.x, target.y, !reduced);
    if (!reduced) setLanding({ pad: state.at, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a hop is a change of pad; drifting alone never moves the frog
  }, [state.at, puzzle, geo, reduced, fromX, fromY, toX, toY, t]);

  // Breathing, blinking, shaking, and a joyful hop at the end.
  const breath = useSharedValue(0);
  const blink = useSharedValue(1);
  const shake = useSharedValue(0);
  const joy = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) })), -1, false);
    blink.value = withRepeat(withSequence(withDelay(2600, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 90 })), -1, false);
  }, [reduced, breath, blink]);
  useEffect(() => {
    if (!stranded || reduced) return;
    shake.value = withDelay(HOP_MS, withSequence(withTiming(1, { duration: 60 }), withTiming(-1, { duration: 90 }), withTiming(0.6, { duration: 80 }), withTiming(0, { duration: 70 })));
  }, [stranded, reduced, shake]);
  useEffect(() => {
    if (!solved || reduced) {
      joy.value = 0;
      return;
    }
    joy.value = withDelay(HOP_MS + 380, withSequence(withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
  }, [solved, reduced, joy]);

  const frogTransform = useDerivedValue(() => {
    const u = t.value;
    const dist = Math.hypot(toX.value - fromX.value, toY.value - fromY.value);
    const arc = Math.sin(Math.PI * u);
    const lift = arc * Math.min(geo.cell * 0.9, dist * 0.35) + joy.value * geo.cell * 0.3;
    const x = fromX.value + (toX.value - fromX.value) * u + shake.value * geo.cell * 0.05;
    const y = fromY.value + (toY.value - fromY.value) * u - lift;
    // A crouch as it leaves, a stretch in the air, a breath at rest.
    const squash = u < 0.15 ? 1 - (0.15 - u) * 0.8 : 1;
    const s = (1 + arc * 0.2 + breath.value * 0.025 + joy.value * 0.08) * squash;
    const facing = dist < 1 ? 0 : Math.atan2(toY.value - fromY.value, toX.value - fromX.value) + Math.PI / 2;
    return [{ translateX: x }, { translateY: y }, { rotate: facing + shake.value * 0.12 }, { scale: s }];
  });
  const shadowTransform = useDerivedValue(() => {
    const u = t.value;
    const x = fromX.value + (toX.value - fromX.value) * u;
    const y = fromY.value + (toY.value - fromY.value) * u;
    const s = 1 - Math.sin(Math.PI * u) * 0.35 - joy.value * 0.2;
    return [{ translateX: x }, { translateY: y + geo.cell * 0.07 }, { scale: s }];
  });

  // A finger: a tap on a pad, or a swipe toward one.
  const down = useRef<{ x: number; y: number } | null>(null);
  const release = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    const from = down.current;
    down.current = null;
    if (!from) return;
    const dx = x - from.x;
    const dy = y - from.y;
    if (Math.hypot(dx, dy) > geo.cell * 0.4) {
      const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      const frog = cellOf(state.at);
      const pad = reach.find(p => Math.sign(cellOf(p).row - frog.row) === DIRECTIONS[d].row && Math.sign(cellOf(p).col - frog.col) === DIRECTIONS[d].col);
      if (pad !== undefined) onHop(pad);
      else onRefused?.();
      return;
    }
    const col = Math.floor((x - geo.inset) / geo.cell);
    const row = Math.floor((y - geo.inset) / geo.cell);
    const pad = puzzle.pads.findIndex((_p, i) => state.afloat[i] && cellOf(i).row === row && cellOf(i).col === col);
    if (pad < 0 || pad === state.at) return;
    if (reach.includes(pad)) onHop(pad);
    else onRefused?.();
  };

  const frogPad = cellOf(state.at);
  const home = geo.centre(frogPad.row, frogPad.col);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <PondTray size={size} inset={geo.inset} puzzle={puzzle} geo={geo} />
        {sinking.map(s => (
          <Sinking key={s.key} geo={geo} pad={cellOf(s.pad)} r={r} />
        ))}
        {solved && !reduced && <Ripples x={home.x} y={home.y} reach={size * 0.75} />}
        <Trail points={trail.slice(-7).map(i => geo.centre(cellOf(i).row, cellOf(i).col))} lift={geo.cell * 0.35} />
        {puzzle.pads.map((p, i) => {
          if (!state.afloat[i] || i === state.at) return null;
          const c = cellOf(i);
          const at = geo.centre(c.row, c.col);
          // Dealt onto the pond as it opens, corner to corner.
          return (
            <DealIn key={i} x={at.x} y={at.y} delay={dealDelay(Math.max(c.row, c.col), puzzle.size - 1)} dealing={dealing}>
              {state.stones?.[i] ? <Stone geo={geo} row={c.row} col={c.col} r={r} /> : <Leaf geo={geo} row={c.row} col={c.col} r={r} lotus={state.lotus?.[i] ?? false} />}
            </DealIn>
          );
        })}
        {falling.map(f => {
          const c = geo.centre(cellOf(f.pad).row, cellOf(f.pad).col);
          return <LotusFall key={f.key} x={c.x} y={c.y} r={r} />;
        })}
        {/* The frog's own pad dips as it lands. */}
        {state.stones?.[state.at] ? (
          <Stone geo={geo} row={frogPad.row} col={frogPad.col} r={r} />
        ) : (
          <LivePad key={`live${state.at}`} geo={geo} row={frogPad.row} col={frogPad.col} turnOf={puzzle.pads[state.at]} r={r} dip={landing?.pad === state.at && !reduced} lotus={state.lotus?.[state.at] ?? false} />
        )}
        {landing && landing.pad === state.at && !reduced && <Splash key={landing.key} x={home.x} y={home.y} r={r} />}
        {!solved && <ReachRings geo={geo} pads={reach.map(i => cellOf(i))} r={r} reduced={reduced} />}
        {cutOff.map(i => {
          const c = geo.centre(cellOf(i).row, cellOf(i).col);
          return <CutOffRing key={`c${i}`} x={c.x} y={c.y} r={r} reduced={reduced} />;
        })}
        {glow !== null && glow !== undefined && state.afloat[glow] && (
          <Circle cx={geo.centre(cellOf(glow).row, cellOf(glow).col).x} cy={geo.centre(cellOf(glow).row, cellOf(glow).col).y + r * 0.07} r={r + 5} color={theme.colors.accent} style="stroke" strokeWidth={3} />
        )}
        {solved && <Bloom x={home.x} y={home.y} r={r} reduced={reduced} />}
        <Group transform={shadowTransform}>
          <Oval x={-geo.cell * 0.21} y={-geo.cell * 0.12} width={geo.cell * 0.42} height={geo.cell * 0.24} color={inkWash(0.2)} />
        </Group>
        <Group transform={frogTransform}>
          <Frog cell={geo.cell} blink={blink} />
        </Group>
      </Canvas>
      <View
        style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={e => {
          down.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        }}
        onResponderRelease={release}
        onResponderTerminate={() => {
          down.current = null;
        }}
        accessible
        accessibilityLabel={`Pond with ${state.afloat.filter(Boolean).length} pads afloat`}
      />
    </View>
  );
}

/**
 * Twos' paper tray, its rim in this game's colour, with the pond in it:
 * still water, a lighter band at the near bank, a few fixed ripples in
 * open water, and reeds at two corners - off the grid, so none can be
 * mistaken for a pad.
 */
export const PondTray = React.memo(function PondTrayImpl({ size, inset, puzzle, geo }: { size: number; inset: number; puzzle: LilyPuzzle; geo: LilyGeo }) {
  const r = 12;
  const w = inset * 0.5;
  // Light on still water: two long, shallow strokes, one under the other.
  const ripple = (x: number, y: number, k: number) => `M ${x} ${y} q ${k * 1.6} ${-k * 0.28} ${k * 3.2} 0 M ${x + k * 0.9} ${y + k * 0.62} q ${k} ${-k * 0.2} ${k * 2} 0`;
  const marks = useMemo(() => {
    const taken = new Set(puzzle.pads.map(p => `${p.row},${p.col}`));
    const out: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < puzzle.size && out.length < 4; row += 1) {
      for (let col = (row * 3 + 1) % puzzle.size; col < puzzle.size && out.length < 4; col += 3) {
        if (!taken.has(`${row},${col}`)) out.push(geo.centre(row, col));
      }
    }
    return out;
  }, [puzzle, geo]);
  return (
    <Group>
      <RoundedRect x={0} y={0} width={size} height={size} r={r}>
        <LinearGradient start={vec(0, 0)} end={vec(size, size)} colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]} positions={[0, 0.55, 1]} />
      </RoundedRect>
      <RoundedRect x={w} y={w} width={size - w * 2} height={size - w * 2} r={r * 0.75} color={theme.colors.pondWater} />
      <RoundedRect x={w} y={w} width={size - w * 2} height={geo.cell * 0.12} r={r * 0.75} color={theme.colors.pondRipple} opacity={0.7} />
      {marks.map((m, i) => (
        <Path key={i} path={ripple(m.x - geo.cell * 0.3, m.y + geo.cell * 0.04, geo.cell * 0.19)} color={theme.colors.pondRipple} style="stroke" strokeWidth={1.8} strokeCap="round" />
      ))}
      {/* Reeds grow only in a corner no pad sits in. */}
      {!puzzle.pads.some(p => p.row === puzzle.size - 1 && p.col === 0) && <Reeds x={w + geo.cell * 0.12} y={size - w - 2} h={geo.cell * 0.55} />}
      {!puzzle.pads.some(p => p.row === 0 && p.col === puzzle.size - 1) && <Reeds x={size - w - geo.cell * 0.14} y={w + geo.cell * 0.62} h={geo.cell * 0.42} flip />}
      <Path path={`M ${size - 1.5} ${r} L ${size - 1.5} ${size - r} Q ${size - 1.5} ${size - 1.5} ${size - r} ${size - 1.5} L ${r} ${size - 1.5}`} color={inkWash(0.16)} style="stroke" strokeWidth={1.5} strokeCap="round" />
      <RoundedRect x={1} y={1} width={size - 2} height={size - 2} r={r} color={theme.colors.lilyAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
});

function Reeds({ x, y, h, flip = false }: { x: number; y: number; h: number; flip?: boolean }): React.JSX.Element {
  const s = flip ? -1 : 1;
  return (
    <Group>
      {[0, 1, 2].map(k => (
        <Path
          key={k}
          path={`M ${x + s * k * h * 0.14} ${y} Q ${x + s * (k * h * 0.14 + h * 0.08)} ${y - h * 0.55} ${x + s * (k * h * 0.2 - h * 0.05)} ${y - h * (0.8 + k * 0.15)}`}
          color={theme.colors.lilyPadEdge}
          style="stroke"
          strokeWidth={2.2}
          strokeCap="round"
        />
      ))}
      <Oval x={x + s * h * 0.12 - h * 0.05} y={y - h * 0.95} width={h * 0.1} height={h * 0.3} color={theme.colors.lilyFrogDark} />
    </Group>
  );
}

/** A pad at rest: its side face, its leaf, its veins - and its lotus, if
 * it still has one. */
export const Leaf = React.memo(function LeafImpl({ geo, row, col, r, lotus = false }: { geo: LilyGeo; row: number; col: number; r: number; lotus?: boolean }) {
  const { x, y } = geo.centre(row, col);
  return (
    <Group>
      <LeafAt x={x} y={y} r={r} turn={notchTurn(row, col)} />
      {lotus && <Lotus x={x} y={y} r={r} />}
    </Group>
  );
});

/**
 * A lotus pad's flower: pointed petals in two rings round a gold heart,
 * set to one side of the pad so the frog can sit beside it. While it
 * blooms, the pad survives the frog's first departure.
 */
export function Lotus({ x, y, r }: { x: number; y: number; r: number }): React.JSX.Element {
  const cx = x + r * 0.3;
  const cy = y + r * 0.22;
  const petal = (a: number, len: number, w: number) => {
    const tip = { x: cx + Math.cos(a) * len, y: cy + Math.sin(a) * len };
    const l = { x: cx + Math.cos(a - 1.57) * w, y: cy + Math.sin(a - 1.57) * w };
    const rr = { x: cx + Math.cos(a + 1.57) * w, y: cy + Math.sin(a + 1.57) * w };
    return `M ${l.x} ${l.y} Q ${l.x + Math.cos(a) * len * 0.8} ${l.y + Math.sin(a) * len * 0.8} ${tip.x} ${tip.y} Q ${rr.x + Math.cos(a) * len * 0.8} ${rr.y + Math.sin(a) * len * 0.8} ${rr.x} ${rr.y} Z`;
  };
  return (
    <Group>
      <Circle cx={cx} cy={cy + r * 0.06} r={r * 0.36} color={inkWash(0.14)} />
      {Array.from({ length: 6 }, (_v, i) => (
        <Path key={`o${i}`} path={petal((i / 6) * Math.PI * 2 - Math.PI / 2, r * 0.48, r * 0.14)} color={theme.colors.lilyBloom} />
      ))}
      {Array.from({ length: 5 }, (_v, i) => (
        <Path key={`i${i}`} path={petal((i / 5) * Math.PI * 2 - Math.PI / 2 + 0.3, r * 0.3, r * 0.1)} color="#FFFFFF" opacity={0.8} />
      ))}
      <Circle cx={cx} cy={cy} r={r * 0.1} color="#F6D46A" />
    </Group>
  );
}

/** A lotus going under as the frog leaves it the first time: it folds,
 * sinks into its pad and a small ring spreads. */
function LotusFall({ x, y, r }: { x: number; y: number; r: number }): React.JSX.Element {
  const u = useSharedValue(0);
  useEffect(() => {
    u.value = withDelay(HOP_MS * 0.3, withTiming(1, { duration: 650, easing: Easing.in(Easing.quad) }));
  }, [u]);
  const cx = x + r * 0.3;
  const cy = y + r * 0.22;
  const fold = useDerivedValue(() => [{ translateX: cx }, { translateY: cy + r * 0.1 * u.value }, { scale: 1 - 0.75 * u.value }, { translateX: -cx }, { translateY: -cy }]);
  const o = useDerivedValue(() => 1 - u.value);
  const ringR = useDerivedValue(() => r * (0.2 + 0.5 * u.value));
  const ringO = useDerivedValue(() => (u.value < 0.4 ? 0 : 0.8 * (1 - u.value)));
  return (
    <Group>
      <Group transform={fold} opacity={o}>
        <Lotus x={x} y={y} r={r} />
      </Group>
      <Circle cx={cx} cy={cy} r={ringR} color={theme.colors.lilyBloom} style="stroke" strokeWidth={2} opacity={ringO} />
    </Group>
  );
}

/** A leaf's veins: ribs from the heart out toward the rim, each bowing
 * gently away from the notch - mirrored either side of it, as a real
 * leaf's are, so it reads as grown rather than ruled. */
function veinsPath(x: number, y: number, r: number, turn: number): string {
  const ribs = [-2.45, -1.75, -1.1, -0.6, 0.6, 1.1, 1.75, 2.45, Math.PI];
  return ribs
    .map(a => {
      const ang = turn + a;
      const end = r * (a === Math.PI ? 0.8 : 0.74);
      const ex = x + Math.cos(ang) * end;
      const ey = y + Math.sin(ang) * end;
      // The bow: away from the notch, a little, at the rib's middle.
      const bend = a === Math.PI ? 0 : r * 0.045 * Math.sign(a);
      const mx = x + Math.cos(ang) * end * 0.5 + Math.cos(ang + Math.PI / 2) * bend;
      const my = y + Math.sin(ang) * end * 0.5 + Math.sin(ang + Math.PI / 2) * bend;
      return `M ${x + Math.cos(ang) * r * 0.08} ${y + Math.sin(ang) * r * 0.08} Q ${mx} ${my} ${ex} ${ey}`;
    })
    .join(' ');
}

function LeafAt({ x, y, r, turn }: { x: number; y: number; r: number; turn: number }): React.JSX.Element {
  const depth = r * 0.14;
  const leafClip = useMemo(() => Skia.Path.MakeFromSVGString(leafPath(x, y, r, turn)) ?? Skia.Path.Make(), [x, y, r, turn]);
  return (
    <Group>
      {/* Where the leaf sits on the water: a darker patch of pond just
          beneath it, so it floats on the surface rather than over it. */}
      <Path path={leafPath(x + r * 0.05, y + depth + r * 0.1, r * 1.02, turn)} color={shade(theme.colors.pondWater, 0.9)} />
      <Path path={leafPath(x, y + depth, r, turn)} color={theme.colors.lilyPadEdge} />
      <Path path={leafPath(x, y, r, turn)} color={theme.colors.lilyPad} />
      {/* The leaf cups a little toward its heart. */}
      <Path path={leafPath(x, y, r * 0.64, turn)} color={shade(theme.colors.lilyPad, 0.94)} />
      {/* A lighter lip on the far side, where the light falls - kept to
          the leaf, so it never shows across the notch. */}
      <Group clip={leafClip}>
        <Path path={`M ${x - r * 0.66} ${y - r * 0.52} A ${r * 0.86} ${r * 0.86} 0 0 1 ${x + r * 0.52} ${y - r * 0.66}`} color={theme.colors.lilyVein} style="stroke" strokeWidth={1.6} strokeCap="round" opacity={0.6} />
      </Group>
      <Path path={veinsPath(x, y, r, turn)} color={theme.colors.lilyVein} style="stroke" strokeWidth={1.1} strokeCap="round" opacity={0.75} />
      <Circle cx={x} cy={y} r={r * 0.07} color={theme.colors.lilyVein} />
    </Group>
  );
}

/** The frog's pad: it dips under the landing frog and springs back. A
 * drifting pad keeps the notch it started with (`turnOf`). */
function LivePad({ geo, row, col, r, dip, lotus, turnOf }: { geo: LilyGeo; row: number; col: number; r: number; dip: boolean; lotus: boolean; turnOf?: Cell }): React.JSX.Element {
  const { x, y } = geo.centre(row, col);
  const s = useSharedValue(1);
  useEffect(() => {
    if (!dip) return;
    s.value = withDelay(HOP_MS - 30, withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 220 })));
  }, [dip, s]);
  const transform = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { scale: s.value }, { translateX: -x }, { translateY: -y }]);
  return (
    <Group transform={transform}>
      <LeafAt x={x} y={y} r={r} turn={notchTurn(turnOf?.row ?? row, turnOf?.col ?? col)} />
      {lotus && <Lotus x={x} y={y} r={r} />}
    </Group>
  );
}

/**
 * A stepping stone: a flat grey stone sitting low in the water, standing on
 * its own darker side, a lighter rim where the light falls and two flecks.
 * Never sinks, so it never dips or ripples.
 */
export function Stone({ geo, row, col, r }: { geo: LilyGeo; row: number; col: number; r: number }): React.JSX.Element {
  const { x, y } = geo.centre(row, col);
  const w = r * 1.62;
  const h = r * 1.34;
  const depth = r * 0.16;
  const face = theme.colors.pondStone;
  const blob = (oy: number) =>
    `M ${x - w * 0.5} ${y + oy} C ${x - w * 0.52} ${y + oy - h * 0.42} ${x - w * 0.1} ${y + oy - h * 0.52} ${x + w * 0.12} ${y + oy - h * 0.48} C ${x + w * 0.42} ${y + oy - h * 0.44} ${x + w * 0.54} ${y + oy - h * 0.1} ${x + w * 0.5} ${y + oy + h * 0.08} C ${x + w * 0.46} ${y + oy + h * 0.42} ${x + w * 0.06} ${y + oy + h * 0.5} ${x - w * 0.16} ${y + oy + h * 0.46} C ${x - w * 0.42} ${y + oy + h * 0.42} ${x - w * 0.5} ${y + oy + h * 0.2} ${x - w * 0.5} ${y + oy} Z`;
  return (
    <Group>
      <Path path={blob(depth + r * 0.1)} color={shade(theme.colors.pondWater, 0.9)} />
      <Path path={blob(depth)} color={shade(face, 0.68)} />
      <Path path={blob(0)} color={face} />
      <Path path={`M ${x - w * 0.36} ${y - h * 0.22} Q ${x - w * 0.08} ${y - h * 0.44} ${x + w * 0.26} ${y - h * 0.34}`} color="#FFFFFF" style="stroke" strokeWidth={1.6} strokeCap="round" opacity={0.35} />
      <Circle cx={x + w * 0.16} cy={y + h * 0.1} r={r * 0.06} color={shade(face, 0.75)} />
      <Circle cx={x - w * 0.12} cy={y + h * 0.2} r={r * 0.045} color={shade(face, 0.75)} />
    </Group>
  );
}

/**
 * The way the frog came: an arc over the water for each of its last hops,
 * dotted, the oldest faintest - so the route so far is plain to see.
 */
function Trail({ points, lift }: { points: ReadonlyArray<{ x: number; y: number }>; lift: number }): React.JSX.Element {
  if (points.length < 2) return <Group />;
  const n = points.length - 1;
  return (
    <Group>
      {points.slice(1).map((b, i) => {
        const a = points[i];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - Math.min(lift * 1.6, Math.hypot(b.x - a.x, b.y - a.y) * 0.3);
        return (
          <Path key={i} path={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} color="#FFFFFF" style="stroke" strokeWidth={2} strokeCap="round" opacity={0.12 + (0.38 * (i + 1)) / n}>
            <DashPathEffect intervals={[2, 6]} />
          </Path>
        );
      })}
    </Group>
  );
}

/** A ring of water where the frog lands. */
function Splash({ x, y, r }: { x: number; y: number; r: number }): React.JSX.Element {
  const u = useSharedValue(0);
  useEffect(() => {
    u.value = withDelay(HOP_MS - 30, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [u]);
  const ringR = useDerivedValue(() => r * (1 + 0.55 * u.value));
  const ringO = useDerivedValue(() => (u.value === 0 ? 0 : 0.8 * (1 - u.value)));
  return <Circle cx={x} cy={y} r={ringR} color={theme.colors.pondRipple} style="stroke" strokeWidth={2.5} opacity={ringO} />;
}

/** Rings round every pad in reach, breathing together. */
function ReachRings({ geo, pads, r, reduced }: { geo: LilyGeo; pads: ReadonlyArray<{ row: number; col: number }>; r: number; reduced: boolean }): React.JSX.Element {
  const b = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    b.value = withDelay(HOP_MS, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1, false));
  }, [b, reduced]);
  const opacity = useDerivedValue(() => 0.45 + 0.35 * b.value);
  return (
    <Group opacity={opacity}>
      {pads.map(p => {
        const c = geo.centre(p.row, p.col);
        return <Circle key={`${p.row},${p.col}`} cx={c.x} cy={c.y + r * 0.07} r={r + 4.5} color="#FFFFFF" style="stroke" strokeWidth={2.5} />;
      })}
    </Group>
  );
}

/** A pad nothing can reach any more: a red ring, pulsing. */
function CutOffRing({ x, y, r, reduced }: { x: number; y: number; r: number; reduced: boolean }): React.JSX.Element {
  const b = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    b.value = withDelay(HOP_MS, withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.35, { duration: 700 })), -1, false));
  }, [b, reduced]);
  return <Circle cx={x} cy={y + r * 0.07} r={r + 4.5} color={theme.colors.danger} style="stroke" strokeWidth={3} opacity={b} />;
}

/** A pad going under: it shrinks and darkens while a ring spreads. */
function Sinking({ geo, pad, r }: { geo: LilyGeo; pad: { row: number; col: number }; r: number }): React.JSX.Element {
  const { x, y } = geo.centre(pad.row, pad.col);
  const u = useSharedValue(0);
  useEffect(() => {
    u.value = withDelay(HOP_MS * 0.35, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [u]);
  const leaf = useDerivedValue(() => [{ translateX: x }, { translateY: y + r * 0.1 * u.value }, { scale: 1 - 0.5 * u.value }, { translateX: -x }, { translateY: -y }]);
  const leafO = useDerivedValue(() => 1 - u.value);
  const ringR = useDerivedValue(() => r * (0.6 + 0.9 * u.value));
  const ringO = useDerivedValue(() => 0.75 * (1 - u.value));
  const bubbleY = useDerivedValue(() => y - r * 0.5 * u.value);
  const bubbleO = useDerivedValue(() => (u.value < 0.3 ? 0 : 0.8 * (1 - u.value)));
  return (
    <Group>
      <Group transform={leaf} opacity={leafO}>
        <Path path={leafPath(x, y, r, notchTurn(pad.row, pad.col))} color={theme.colors.lilyPadEdge} />
      </Group>
      <Circle cx={x} cy={y} r={ringR} color={theme.colors.pondRipple} style="stroke" strokeWidth={2.5} opacity={ringO} />
      <Circle cx={x + r * 0.2} cy={bubbleY} r={r * 0.09} color={theme.colors.pondRipple} style="stroke" strokeWidth={1.5} opacity={bubbleO} />
    </Group>
  );
}

/** The cleared pond's rings, spreading out from the last pad. */
function Ripples({ x, y, reach }: { x: number; y: number; reach: number }): React.JSX.Element {
  return (
    <Group>
      {[0, 1, 2].map(k => (
        <Ripple key={k} x={x} y={y} reach={reach} delay={HOP_MS + k * 260} />
      ))}
    </Group>
  );
}

function Ripple({ x, y, reach, delay }: { x: number; y: number; reach: number; delay: number }): React.JSX.Element {
  const u = useSharedValue(0);
  useEffect(() => {
    u.value = withDelay(delay, withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
  }, [u, delay]);
  const rr = useDerivedValue(() => reach * u.value);
  const o = useDerivedValue(() => (u.value === 0 ? 0 : 0.7 * (1 - u.value)));
  return <Circle cx={x} cy={y} r={rr} color={theme.colors.pondRipple} style="stroke" strokeWidth={3} opacity={o} />;
}

/** The frog from above: round back, two eyes up front, folded legs. */
export function Frog({ cell, blink }: { cell: number; blink?: SharedValue<number> }): React.JSX.Element {
  const b = cell * 0.24;
  const fallback = useSharedValue(1);
  const lids = blink ?? fallback;
  const eyes = useDerivedValue(() => [{ scaleY: lids.value }]);
  return (
    <Group>
      {/* Hind legs, folded, and the front feet. */}
      <Oval x={-b * 1.18} y={b * 0.1} width={b * 0.78} height={b * 1.0} color={theme.colors.lilyFrogDark} />
      <Oval x={b * 0.4} y={b * 0.1} width={b * 0.78} height={b * 1.0} color={theme.colors.lilyFrogDark} />
      <Oval x={-b * 0.95} y={-b * 0.62} width={b * 0.4} height={b * 0.34} color={theme.colors.lilyFrogDark} />
      <Oval x={b * 0.55} y={-b * 0.62} width={b * 0.4} height={b * 0.34} color={theme.colors.lilyFrogDark} />
      <Oval x={-b * 0.85} y={-b * 0.9} width={b * 1.7} height={b * 1.9} color={theme.colors.lilyFrog} />
      {/* A paler band across its back, and two spots. */}
      <Oval x={-b * 0.45} y={-b * 0.55} width={b * 0.9} height={b * 0.5} color="#FFFFFF" opacity={0.14} />
      <Circle cx={-b * 0.3} cy={b * 0.35} r={b * 0.16} color={theme.colors.lilyFrogDark} opacity={0.7} />
      <Circle cx={b * 0.32} cy={b * 0.1} r={b * 0.12} color={theme.colors.lilyFrogDark} opacity={0.7} />
      {[-1, 1].map(side => (
        <Group key={side}>
          <Circle cx={side * b * 0.5} cy={-b * 0.75} r={b * 0.34} color={theme.colors.lilyFrog} />
          <Group transform={eyes} origin={vec(side * b * 0.5, -b * 0.8)}>
            <Circle cx={side * b * 0.5} cy={-b * 0.8} r={b * 0.22} color="#FFFFFF" />
            <Circle cx={side * b * 0.5} cy={-b * 0.84} r={b * 0.11} color="#2A2A2A" />
          </Group>
        </Group>
      ))}
    </Group>
  );
}

/** The cleared pond's reward: a water lily opening under the frog. */
function Bloom({ x, y, r, reduced }: { x: number; y: number; r: number; reduced: boolean }): React.JSX.Element {
  const t = useSharedValue(reduced ? 1 : 0);
  const sway = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(HOP_MS, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.6)) }));
    sway.value = withDelay(HOP_MS + 700, withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1, false));
  }, [t, sway, reduced]);
  const petals = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: sway.value * 0.08 }, { scale: t.value }]);
  return (
    <Group transform={petals}>
      <WaterLily r={r} />
    </Group>
  );
}

/** Two rings of petals round a gold heart, drawn at the origin. */
export function WaterLily({ r }: { r: number }): React.JSX.Element {
  return (
    <Group>
      {Array.from({ length: 8 }, (_v, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <Oval key={`o${i}`} x={Math.cos(a) * r * 0.6 - r * 0.28} y={Math.sin(a) * r * 0.6 - r * 0.28} width={r * 0.56} height={r * 0.56} color={theme.colors.lilyBloom} />;
      })}
      {Array.from({ length: 6 }, (_v, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return <Oval key={`i${i}`} x={Math.cos(a) * r * 0.32 - r * 0.2} y={Math.sin(a) * r * 0.32 - r * 0.2} width={r * 0.4} height={r * 0.4} color="#FFFFFF" opacity={0.75} />;
      })}
      <Circle cx={0} cy={0} r={r * 0.22} color="#F6D46A" />
    </Group>
  );
}

/**
 * The pond drawn still, for pictures that only show it (the help
 * carousel): pads, the frog on its pad, and optional rings and a lily.
 */
export function LilyStill({
  puzzle,
  state,
  size,
  reach = [],
  cutOff = [],
  bloom = false,
  sunk = [],
}: {
  puzzle: LilyPuzzle;
  state: LilyState;
  size: number;
  reach?: ReadonlyArray<number>;
  cutOff?: ReadonlyArray<number>;
  bloom?: boolean;
  /** Pads to show just gone under, as rings on the water. */
  sunk?: ReadonlyArray<number>;
}): React.JSX.Element {
  const geo = lilyGeometry(size, puzzle.size);
  const r = geo.cell * 0.42;
  const cellOf = (i: number) => padCell(puzzle, state, i);
  const frog = geo.centre(cellOf(state.at).row, cellOf(state.at).col);
  return (
    <Group>
      <PondTray size={size} inset={geo.inset} puzzle={puzzle} geo={geo} />
      {sunk.map(i => {
        const c = geo.centre(cellOf(i).row, cellOf(i).col);
        return (
          <Group key={`s${i}`}>
            <Circle cx={c.x} cy={c.y} r={r * 0.9} color={theme.colors.pondRipple} style="stroke" strokeWidth={2} opacity={0.8} />
            <Circle cx={c.x} cy={c.y} r={r * 0.5} color={theme.colors.pondRipple} style="stroke" strokeWidth={1.5} opacity={0.6} />
          </Group>
        );
      })}
      {puzzle.pads.map((p, i) => {
        if (!state.afloat[i]) return null;
        const c = cellOf(i);
        if (state.stones?.[i]) return <Stone key={i} geo={geo} row={c.row} col={c.col} r={r} />;
        return <Leaf key={i} geo={geo} row={c.row} col={c.col} r={r} lotus={state.lotus?.[i] ?? false} />;
      })}
      {reach.map(i => {
        const c = geo.centre(cellOf(i).row, cellOf(i).col);
        return <Circle key={`r${i}`} cx={c.x} cy={c.y + r * 0.07} r={r + 3} color="#FFFFFF" style="stroke" strokeWidth={2} opacity={0.75} />;
      })}
      {cutOff.map(i => {
        const c = geo.centre(cellOf(i).row, cellOf(i).col);
        return <Circle key={`c${i}`} cx={c.x} cy={c.y + r * 0.07} r={r + 3} color={theme.colors.danger} style="stroke" strokeWidth={2.5} />;
      })}
      {bloom && (
        <Group transform={[{ translateX: frog.x }, { translateY: frog.y }]}>
          <WaterLily r={r} />
        </Group>
      )}
      <Group transform={[{ translateX: frog.x }, { translateY: frog.y }]}>
        <Frog cell={geo.cell} />
      </Group>
    </Group>
  );
}

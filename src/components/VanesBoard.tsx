/* eslint-disable react-native/no-inline-styles -- geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, LinearGradient, Line, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, SharedValue, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Dir, loops, STEP, targets, troubles, VanePuzzle, VaneState } from '../game/vanes';
import { shade, useReducedMotion } from '../game/rendering';
import { inkWash, theme } from '../theme';

/**
 * The roof, in the same hand as every other board: Twos' paper tray with
 * its light seam and an accent rim, faint slate courses across it, and a
 * dot where no vane stands. Each vane is an arrow on a post - the post a
 * small disc on its side face, the arrow casting a soft offset shadow,
 * its tail feathers in the game's colour; a vane set from the start sits
 * on a plate of that colour.
 *
 * From each vane its wind runs to the vane it points at: faint and dashed
 * while the loop is still open, red when it blows into open air, crowds a
 * vane or doubles back, and once a loop closes, solid and flowing, with a
 * glow round the loop's vanes. A turn is a quarter on a spring, with a
 * small ring; the set roof sends a gust round, every vane spinning once.
 */
const PAD = 0.32;

export interface VaneGeo {
  readonly size: number;
  readonly inset: number;
  readonly cell: number;
  readonly centre: (row: number, col: number) => { x: number; y: number };
}

export function vaneGeometry(size: number, cells: number): VaneGeo {
  const inset = (size / (cells + PAD * 2)) * PAD;
  const cell = (size - inset * 2) / cells;
  return { size, inset, cell, centre: (row, col) => ({ x: inset + col * cell + cell / 2, y: inset + row * cell + cell / 2 }) };
}

export function VanesBoard({
  puzzle,
  state,
  size,
  solved,
  onTurn,
  glow,
  touched,
}: {
  puzzle: VanePuzzle;
  state: VaneState;
  size: number;
  solved: boolean;
  onTurn: (vane: number) => void;
  glow?: number | null;
  /** Vanes the player has turned; the rest stay quiet (see `VanesRoof`). */
  touched?: ReadonlyArray<boolean>;
}): React.JSX.Element {
  const geo = useMemo(() => vaneGeometry(size, puzzle.size), [size, puzzle.size]);
  const at = useMemo(() => new Map(puzzle.vanes.map((v, i) => [`${v.row},${v.col}`, i])), [puzzle]);
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <VanesRoof puzzle={puzzle} state={state} geo={geo} solved={solved} glow={glow} touched={touched} live />
      </Canvas>
      <View
        style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}
        onStartShouldSetResponder={() => true}
        onResponderRelease={e => {
          const col = Math.floor((e.nativeEvent.locationX - geo.inset) / geo.cell);
          const row = Math.floor((e.nativeEvent.locationY - geo.inset) / geo.cell);
          const vane = at.get(`${row},${col}`);
          if (vane !== undefined) onTurn(vane);
        }}
        accessible
        accessibilityLabel={`Roof with ${puzzle.vanes.length} weathervanes`}
      />
    </View>
  );
}

/**
 * Everything drawn on the roof, for the live board and for the help
 * pictures alike (`live` false: nothing moves).
 */
export function VanesRoof({
  puzzle,
  state,
  geo,
  solved,
  glow,
  touched,
  live = false,
}: {
  puzzle: VanePuzzle;
  state: VaneState;
  geo: VaneGeo;
  solved: boolean;
  glow?: number | null;
  /** Vanes the player has turned. An untouched vane is quiet - its wind
   * faint and grey, never red - so a fresh roof reads as calm, not as a
   * page of mistakes; absent, every vane speaks. */
  touched?: ReadonlyArray<boolean>;
  live?: boolean;
}): React.JSX.Element {
  const reducedPref = useReducedMotion();
  const reduced = reducedPref || !live;
  const { cell, centre } = geo;
  const t = useMemo(() => targets(puzzle, state), [puzzle, state]);
  const rawTrouble = useMemo(() => troubles(puzzle, state), [puzzle, state]);
  const quiet = (i: number) => !!touched && !touched[i];
  const trouble = useMemo(() => rawTrouble.map((t, i) => (quiet(i) ? null : t)), [rawTrouble, touched, puzzle]); // eslint-disable-line react-hooks/exhaustive-deps
  const reached = useMemo(() => new Set(t.filter(x => x >= 0)), [t]);
  const at = useMemo(() => new Set([...puzzle.vanes, ...(puzzle.chimneys ?? [])].map(v => `${v.row},${v.col}`)), [puzzle]);

  // Loops whose every vane is in order: their wind runs solid.
  const closed = useMemo(() => loops(puzzle, state).filter(l => l.length >= 3 && l.every(i => trouble[i] === null)), [puzzle, state, trouble]);
  const inClosed = useMemo(() => new Set(closed.flat()), [closed]);

  // A loop that has just closed glows once.
  const seen = useRef<Set<string>>(new Set(closed.map(l => [...l].sort((a, b) => a - b).join(','))));
  const [fresh, setFresh] = useState<Array<{ key: string; vanes: number[] }>>([]);
  useEffect(() => {
    const now = closed.map(l => ({ key: [...l].sort((a, b) => a - b).join(','), vanes: l }));
    const added = now.filter(l => !seen.current.has(l.key));
    seen.current = new Set(now.map(l => l.key));
    if (added.length > 0 && !reduced) setFresh(added.map(l => ({ ...l, key: `${l.key}@${Date.now()}` })));
  }, [closed, reduced]);
  useEffect(() => {
    if (fresh.length === 0) return;
    const id = setTimeout(() => setFresh([]), 1100);
    return () => clearTimeout(id);
  }, [fresh]);

  // The wind's flow along closed loops.
  const flow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    flow.value = 0;
    flow.value = withRepeat(withTiming(-32, { duration: 1100, easing: Easing.linear }), -1, false);
  }, [reduced, flow]);

  return (
    <Group>
      <RoofTray size={geo.size} />
      {/* A dot where no vane stands. */}
      {Array.from({ length: puzzle.size * puzzle.size }, (_v, k) => {
        const row = Math.floor(k / puzzle.size);
        const col = k % puzzle.size;
        if (at.has(`${row},${col}`)) return null;
        const c = centre(row, col);
        return <Circle key={k} cx={c.x} cy={c.y} r={cell * 0.045} color={theme.colors.borderStrong} />;
      })}
      {(puzzle.chimneys ?? []).map(c => {
        const p = centre(c.row, c.col);
        return <Chimney key={`ch${c.row},${c.col}`} x={p.x} y={p.y} cell={cell} live={!reduced} />;
      })}
      {/* The wind, under the vanes. */}
      {puzzle.vanes.map((v, i) => {
        const a = centre(v.row, v.col);
        const bad = trouble[i] !== null;
        if (t[i] < 0) {
          const d = STEP[state.dirs[i]];
          return (
            <Path key={`w${i}`} path={`M ${a.x + d.col * cell * 0.32} ${a.y + d.row * cell * 0.32} L ${a.x + d.col * cell * 0.78} ${a.y + d.row * cell * 0.78}`} color={quiet(i) ? theme.colors.borderStrong : theme.colors.danger} style="stroke" strokeWidth={2.5} strokeCap="round" opacity={0.75}>
              <DashPathEffect intervals={[5, 6]} />
            </Path>
          );
        }
        const b = centre(puzzle.vanes[t[i]].row, puzzle.vanes[t[i]].col);
        return <Wind key={`w${i}`} a={a} b={b} cell={cell} kind={bad ? 'bad' : inClosed.has(i) ? 'closed' : quiet(i) ? 'quiet' : 'open'} flow={flow} />;
      })}
      {fresh.map(l => (
        <LoopGlow key={l.key} points={l.vanes.map(i => centre(puzzle.vanes[i].row, puzzle.vanes[i].col))} cell={cell} />
      ))}
      {puzzle.vanes.map((v, i) => {
        const c = centre(v.row, v.col);
        return (
          <Vane
            key={i}
            x={c.x}
            y={c.y}
            cell={cell}
            dir={state.dirs[i]}
            fixed={puzzle.fixed[i] !== null}
            reached={reached.has(i) && trouble[i] !== 'pair'}
            trouble={trouble[i] !== null}
            looped={inClosed.has(i)}
            gust={solved && !reduced}
            delay={(v.row + v.col) * 60}
            reduced={reduced}
          />
        );
      })}
      {glow !== null && glow !== undefined && (
        <Circle cx={centre(puzzle.vanes[glow].row, puzzle.vanes[glow].col).x} cy={centre(puzzle.vanes[glow].row, puzzle.vanes[glow].col).y} r={cell * 0.44} color={theme.colors.accent} style="stroke" strokeWidth={3} />
      )}
    </Group>
  );
}

/** One vane's wind, from just past its post to just short of the next. */
function Wind({ a, b, cell, kind, flow }: { a: { x: number; y: number }; b: { x: number; y: number }; cell: number; kind: 'quiet' | 'open' | 'closed' | 'bad'; flow: SharedValue<number> }): React.JSX.Element {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const from = { x: a.x + ux * cell * 0.3, y: a.y + uy * cell * 0.3 };
  const to = { x: b.x - ux * cell * 0.36, y: b.y - uy * cell * 0.36 };
  const color = kind === 'bad' ? theme.colors.danger : kind === 'quiet' ? theme.colors.borderStrong : theme.colors.vaneWind;
  const chevron = `M ${to.x - ux * 5 - uy * 4} ${to.y - uy * 5 + ux * 4} L ${to.x} ${to.y} L ${to.x - ux * 5 + uy * 4} ${to.y - uy * 5 - ux * 4}`;
  return (
    <Group>
      {kind === 'closed' && <Line p1={vec(from.x, from.y)} p2={vec(to.x, to.y)} color={color} strokeWidth={6} opacity={0.18} strokeCap="round" />}
      {/* Solid, so where each vane points can be read at a glance - the
          whole puzzle is reading it. Only a closed loop's wind moves. */}
      <Path path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} color={color} style="stroke" strokeWidth={kind === 'closed' ? 3 : kind === 'quiet' ? 1.6 : 2.2} strokeCap="round" opacity={kind === 'quiet' ? 0.55 : kind === 'open' ? 0.8 : 0.95}>
        {kind === 'closed' && <DashPathEffect intervals={[12, 6]} phase={flow} />}
      </Path>
      <Path path={chevron} color={color} style="stroke" strokeWidth={kind === 'quiet' ? 1.6 : 2.2} strokeCap="round" strokeJoin="round" opacity={kind === 'quiet' ? 0.6 : 0.95} />
    </Group>
  );
}

/**
 * A chimney: a small brick stack on its own shadow, a darker cap, and a
 * slow curl of smoke. Wind does not pass it.
 */
export function Chimney({ x, y, cell, live }: { x: number; y: number; cell: number; live: boolean }): React.JSX.Element {
  const w = cell * 0.4;
  const h = cell * 0.36;
  const brick = shade(theme.colors.vaneAccent, 0.85);
  const smoke = useSharedValue(0);
  useEffect(() => {
    if (!live) return;
    smoke.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, [live, smoke]);
  return (
    <Group>
      {[0, 1, 2].map(k => (
        <Puff key={k} k={k} x={x} top={y - h * 0.55} cell={cell} smoke={smoke} live={live} />
      ))}
      <RoundedRect x={x - w / 2 + cell * 0.03} y={y - h / 2 + cell * 0.05} width={w} height={h} r={cell * 0.05} color={inkWash(0.16)} />
      <RoundedRect x={x - w / 2} y={y - h / 2} width={w} height={h} r={cell * 0.05} color={brick} />
      {/* Brick courses. */}
      <Line p1={vec(x - w / 2, y)} p2={vec(x + w / 2, y)} color={shade(brick, 0.75)} strokeWidth={1} />
      <Line p1={vec(x, y - h / 2 + h * 0.18)} p2={vec(x, y)} color={shade(brick, 0.75)} strokeWidth={1} />
      <Line p1={vec(x - w * 0.22, y)} p2={vec(x - w * 0.22, y + h / 2)} color={shade(brick, 0.75)} strokeWidth={1} />
      <Line p1={vec(x + w * 0.22, y)} p2={vec(x + w * 0.22, y + h / 2)} color={shade(brick, 0.75)} strokeWidth={1} />
      <RoundedRect x={x - w / 2 - cell * 0.03} y={y - h / 2 - cell * 0.04} width={w + cell * 0.06} height={cell * 0.09} r={cell * 0.03} color={shade(brick, 0.7)} />
    </Group>
  );
}

/** One puff of a chimney's smoke, a third of the way behind the last. */
function Puff({ k, x, top, cell, smoke, live }: { k: number; x: number; top: number; cell: number; smoke: SharedValue<number>; live: boolean }): React.JSX.Element {
  const cy = useDerivedValue(() => top - cell * 0.32 * ((smoke.value + k / 3) % 1));
  const cx = useDerivedValue(() => x + cell * 0.08 * Math.sin(((smoke.value + k / 3) % 1) * Math.PI * 2));
  const r = useDerivedValue(() => cell * (0.05 + 0.06 * ((smoke.value + k / 3) % 1)));
  const o = useDerivedValue(() => (live ? 0.35 * (1 - ((smoke.value + k / 3) % 1)) : k === 0 ? 0.3 : 0));
  return <Circle cx={cx} cy={cy} r={r} color={theme.colors.textTertiary} opacity={o} />;
}

/** A loop that has just closed: a ring of light from each of its vanes. */
function LoopGlow({ points, cell }: { points: ReadonlyArray<{ x: number; y: number }>; cell: number }): React.JSX.Element {
  const u = useSharedValue(0);
  useEffect(() => {
    u.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [u]);
  const r = useDerivedValue(() => cell * (0.2 + 0.4 * u.value));
  const o = useDerivedValue(() => 0.8 * (1 - u.value));
  return (
    <Group>
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={r} color={theme.colors.vaneWind} style="stroke" strokeWidth={3} opacity={o} />
      ))}
    </Group>
  );
}

/** Twos' paper tray, its rim in this game's colour - plain, so the vanes and
 * their wind are the only lines on it. */
const RoofTray = React.memo(function RoofTrayImpl({ size }: { size: number }) {
  const r = 12;
  return (
    <Group>
      <RoundedRect x={0} y={0} width={size} height={size} r={r}>
        <LinearGradient start={vec(0, 0)} end={vec(size, size)} colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]} positions={[0, 0.55, 1]} />
      </RoundedRect>
      <Path path={`M ${size - 1.5} ${r} L ${size - 1.5} ${size - r} Q ${size - 1.5} ${size - 1.5} ${size - r} ${size - 1.5} L ${r} ${size - 1.5}`} color={inkWash(0.16)} style="stroke" strokeWidth={1.5} strokeCap="round" />
      <RoundedRect x={1} y={1} width={size - 2} height={size - 2} r={r} color={theme.colors.vaneAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
});

/**
 * One vane. Its angle only ever grows - each turn a quarter more,
 * clockwise - so the spring never takes the long way round.
 */
function Vane({
  x,
  y,
  cell,
  dir,
  fixed,
  reached,
  trouble,
  looped,
  gust,
  delay,
  reduced,
}: {
  x: number;
  y: number;
  cell: number;
  dir: Dir;
  fixed: boolean;
  reached: boolean;
  trouble: boolean;
  looped: boolean;
  gust: boolean;
  delay: number;
  reduced: boolean;
}): React.JSX.Element {
  const turns = useRef<number>(dir);
  const last = useRef(dir);
  if (last.current !== dir) {
    turns.current += (dir - last.current + 4) % 4 || 4;
    last.current = dir;
  }
  const angle = useSharedValue(dir * (Math.PI / 2));
  const spin = useSharedValue(0);
  const tick = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    const target = turns.current * (Math.PI / 2);
    if (reduced) {
      angle.value = target;
      return;
    }
    angle.value = withSpring(target, { damping: 11, stiffness: 170, mass: 0.7 });
    if (first.current) {
      first.current = false;
      return;
    }
    tick.value = 0;
    tick.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [dir, angle, tick, reduced]);
  useEffect(() => {
    if (gust) spin.value = withDelay(250 + delay, withSequence(withTiming(Math.PI * 2 + 0.25, { duration: 850, easing: Easing.inOut(Easing.cubic) }), withSpring(Math.PI * 2, { damping: 8 })));
    else spin.value = 0;
  }, [gust, delay, spin]);
  const transform = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: angle.value + spin.value }]);
  const shadow = useDerivedValue(() => [{ translateX: x + cell * 0.03 }, { translateY: y + cell * 0.05 }, { rotate: angle.value + spin.value }]);
  const tickR = useDerivedValue(() => cell * (0.18 + 0.2 * tick.value));
  const tickO = useDerivedValue(() => (tick.value === 0 || tick.value === 1 ? 0 : 0.6 * (1 - tick.value)));

  const L = cell * 0.37;
  const plate = cell * 0.4;
  const metal = theme.colors.vaneMetal;
  // A weathervane's arrow, cast in metal: a lancet head with swept-back
  // barbs, a thin rod, and a swallowtail banner for a tail - a shape that
  // can never be read as a second head. A light edge down one side and
  // the ball at the pivot give it its depth (geometry, not gradient).
  const arrow = (fill: string, edge?: string, tail?: string) => (
    <Group>
      {/* The rod. */}
      <Path path={`M 0 ${L * 0.5} L 0 ${-L * 0.6}`} color={fill} style="stroke" strokeWidth={cell * 0.028} strokeCap="round" />
      {/* The head: a lancet with barbs swept back from its waist. */}
      <Path path={`M 0 ${-L * 1.1} C ${L * 0.08} ${-L * 0.92} ${L * 0.17} ${-L * 0.74} ${L * 0.24} ${-L * 0.52} L ${L * 0.06} ${-L * 0.61} L 0 ${-L * 0.54} L ${-L * 0.06} ${-L * 0.61} L ${-L * 0.24} ${-L * 0.52} C ${-L * 0.17} ${-L * 0.74} ${-L * 0.08} ${-L * 0.92} 0 ${-L * 1.1} Z`} color={fill} />
      {/* The tail: a swallowtail banner, the wind's own flag - light,
          and only outlined in the metal, so the solid head is the one
          bold end and which way it points is never in doubt. */}
      {tail && <Path path={`M ${-L * 0.05} ${L * 0.4} L ${-L * 0.24} ${L * 0.46} L ${-L * 0.26} ${L * 0.9} L 0 ${L * 0.74} L ${L * 0.26} ${L * 0.9} L ${L * 0.24} ${L * 0.46} L ${L * 0.05} ${L * 0.4} Z`} color={tail} />}
      <Path path={`M ${-L * 0.05} ${L * 0.4} L ${-L * 0.24} ${L * 0.46} L ${-L * 0.26} ${L * 0.9} L 0 ${L * 0.74} L ${L * 0.26} ${L * 0.9} L ${L * 0.24} ${L * 0.46} L ${L * 0.05} ${L * 0.4} Z`} color={fill} style="stroke" strokeWidth={cell * 0.022} strokeJoin="round" />
      {edge && (
        <Group>
          <Path path={`M ${-L * 0.03} ${-L * 0.98} C ${-L * 0.1} ${-L * 0.84} ${-L * 0.18} ${-L * 0.7} ${-L * 0.24} ${-L * 0.54}`} color={edge} style="stroke" strokeWidth={cell * 0.016} strokeCap="round" opacity={0.85} />
        </Group>
      )}
    </Group>
  );
  return (
    <Group>
      {looped && <Circle cx={x} cy={y} r={cell * 0.22} color={theme.colors.vaneWind} opacity={0.18} />}
      {fixed ? (
        <Group>
          {/* Set from the start: bolted to a square copper plate, two
              rivets showing, and the whole arrow cast in copper. Square
              and solid where a turning vane is round and light, so the
              two can never be mistaken at a glance. */}
          <RoundedRect x={x - plate / 2} y={y - plate / 2 + cell * 0.035} width={plate} height={plate} r={cell * 0.06} color={inkWash(0.18)} />
          <RoundedRect x={x - plate / 2} y={y - plate / 2} width={plate} height={plate} r={cell * 0.06} color={theme.colors.vaneGold} opacity={0.22} />
          <RoundedRect x={x - plate / 2} y={y - plate / 2} width={plate} height={plate} r={cell * 0.06} color={reached ? theme.colors.vaneWind : theme.colors.vaneGold} style="stroke" strokeWidth={reached ? 2.5 : 1.6} />
          {[-1, 1].map(k => (
            <Circle key={k} cx={x + k * plate * 0.32} cy={y + k * plate * 0.32} r={cell * 0.022} color={theme.colors.vaneGold} />
          ))}
        </Group>
      ) : (
        <Group>
          {/* Free to turn: a round swivel post. */}
          <Circle cx={x} cy={y + cell * 0.035} r={cell * 0.165} color={inkWash(0.16)} />
          <Circle cx={x} cy={y} r={cell * 0.16} color={theme.colors.surface} />
          <Circle cx={x} cy={y} r={cell * 0.16} color={reached ? theme.colors.vaneWind : theme.colors.borderStrong} style="stroke" strokeWidth={reached ? 2.5 : 1.2} />
        </Group>
      )}
      <Circle cx={x} cy={y} r={tickR} color={theme.colors.vaneAccent} style="stroke" strokeWidth={2} opacity={tickO} />
      <Group transform={shadow} opacity={0.22}>
        {arrow('#000000')}
      </Group>
      {/* In trouble, the whole arrow says so - not just its tail. */}
      {/* Fixed vanes are polished gold, catching a bright shine; the ones
          that turn are fine blued steel with a cool light along one edge. */}
      <Group transform={transform}>{arrow(fixed ? theme.colors.vaneGold : trouble ? theme.colors.danger : metal, fixed ? '#FFF6D8' : trouble ? shade(theme.colors.danger, 1.9) : theme.colors.vaneMetalLight, theme.colors.surfaceHi)}</Group>
      <Circle cx={x} cy={y} r={cell * (fixed ? 0.06 : 0.045)} color={fixed ? shade(theme.colors.vaneGold, 0.72) : theme.colors.vaneMetalLight} />
    </Group>
  );
}

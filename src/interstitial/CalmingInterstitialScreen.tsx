import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEquipped } from '../progression';
import { AccessibilityActionEvent, Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { ConfettiBurst, GeometricRule, PageBloom, PressableScale, directionForAccessibilityAction, useSwipeGesture } from '../components';
import { Direction } from '../game/engine';
import { Heading, MazeShape, Point, RollPlan, RollTiming, hasOpenEdge, planRoll, pointAt, relaxBreakMazes, rollTiming } from '../game/maze';
import { playHapticEvents, shade, stopHaptics, triggerFeedback, useReducedMotion } from '../game/rendering';
import { theme, themedStyles, inkWash } from '../theme';
import { BreatherIntro } from './BreatherIntro';
import { MAZE_PAINTS, mazeColors } from './mazePalette';

export interface CalmingInterstitialScreenProps {
  /** Called once, after the last maze is painted or the player skips - the
   * caller (App.tsx) treats the two identically: move on to the next
   * level's first puzzle. */
  onDone: () => void;
}

/**
 * The calming break between level batches.
 *
 * It opens on a cut screen (`BreatherIntro`) - a breath, and a picture of
 * what's coming - and only starts when the player taps Begin. Then a few
 * small mazes: swipe, and the ball rolls until it meets a wall, painting
 * every square it crosses. Paint them all and the next maze arrives.
 *
 * The mazes are dealt fresh every break (`relaxBreakMazes`), each one
 * guaranteed finishable from wherever the ball comes to rest - see
 * `relaxMazeStats`'s `trapFree`.
 */
const MAZE_TARGET_COUNT = 3;
/** A fallback for a break nobody engages with - measured from Begin. */
const SAFETY_DURATION_MS = 180000;

/** The channel's far wall, as a share of one square. Only the far (top)
 * wall of each square shows - the board is seen from slightly in front. */
const TOP_FACE_RATIO = 0.22;
const LIP_PX = 2;
const FOOT_PX = 2;
const SEAM_WIDTH = 1.5;
/** The paper slab the channel is carved into: margin around the maze, as
 * a share of a square, and how far its side face drops. */
const SLAB_PAD_RATIO = 0.45;
const SLAB_SIDE_PX = 7;
const SLAB_RADIUS = 18;
/** The smallest grid a maze's squares are sized against, so a compact
 * maze comes out larger but never as a few giant slabs. */
const MIN_FIT_COLS = 6;
const MIN_FIT_ROWS = 8;

/** The ball's radius, in squares. */
const BALL_RADIUS = 0.38;
/** Top rolling speed, in squares per second, and how far a ball starting
 * from rest takes to reach it - it gathers pace, then lands with weight. */
const ROLL_SPEED = 30;
const ROLL_RAMP = 0.55;
const CELEBRATE_PAUSE_MS = 1200;
/** How far past a square's centre a swiped turn may still be taken there,
 * as a share of a square. Past it, the turn waits for the next opening. */
const TURN_GRACE = 0.3;

type Paint = readonly [string, string, string];

/** A fresh seed for each break, so no two breaks deal the same mazes. */
function breakSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff) + (Date.now() % 1000003);
}

interface CellInfo {
  readonly key: string;
  readonly col: number;
  readonly row: number;
  readonly northOpen: boolean;
  readonly southOpen: boolean;
  readonly eastOpen: boolean;
}

// ---------------------------------------------------------------------------
// Static board layers - each memoised, so only paint events redraw them.
// ---------------------------------------------------------------------------

/** The paper slab: a flat top standing on an offset side face, with a
 * hairline rim in the maze's paint and a rivet in each corner. */
const MazeSlab = React.memo(function MazeSlabImpl({ width, height, paint }: { width: number; height: number; paint: Paint }): React.JSX.Element {
  const top = height - SLAB_SIDE_PX;
  const inset = 11;
  return (
    <>
      <RoundedRect x={0} y={SLAB_SIDE_PX} width={width} height={top} r={SLAB_RADIUS} color={mazeColors.slabSide} />
      <RoundedRect x={0} y={0} width={width} height={top} r={SLAB_RADIUS} color={mazeColors.slab} />
      <RoundedRect x={1} y={1} width={width - 2} height={top - 2} r={SLAB_RADIUS - 1} color={paint[1]} style="stroke" strokeWidth={1.5} opacity={0.45} />
      {[
        [inset, inset],
        [width - inset, inset],
        [inset, top - inset],
        [width - inset, top - inset],
      ].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={3} color={mazeColors.slabSide} />
      ))}
    </>
  );
});

function floorTile({ key: k, col, row, eastOpen, southOpen }: CellInfo, cellSize: number, floor: string, seam: string, lip?: string): React.JSX.Element {
  const x = col * cellSize;
  const y = row * cellSize;
  return (
    <Group key={`floor-${k}`}>
      <Rect x={x} y={y} width={cellSize} height={cellSize} color={floor} />
      {lip && <Rect x={x} y={y} width={cellSize} height={2} color={lip} opacity={0.75} />}
      {eastOpen && <Rect x={x + cellSize - SEAM_WIDTH / 2} y={y} width={SEAM_WIDTH} height={cellSize} color={seam} />}
      {southOpen && <Rect x={x} y={y + cellSize - SEAM_WIDTH / 2} width={cellSize} height={SEAM_WIDTH} color={seam} />}
    </Group>
  );
}

const MazeFloorBase = React.memo(function MazeFloorBaseImpl({ cells, cellSize }: { cells: ReadonlyArray<CellInfo>; cellSize: number }): React.JSX.Element {
  return <>{cells.map(cell => floorTile(cell, cellSize, mazeColors.socket, mazeColors.socketSeam))}</>;
});

/** Only the painted squares, over the base - one paint event redraws a
 * handful of squares, not the whole floor. */
const MazePaintedFloor = React.memo(function MazePaintedFloorImpl({
  cells,
  cellSize,
  paintedRef,
  paint,
}: {
  cells: ReadonlyArray<CellInfo>;
  cellSize: number;
  paintedRef: React.RefObject<Set<string>>;
  paint: Paint;
  // Only read to invalidate the memo on a paint event.
  paintedVersion: number;
}): React.JSX.Element {
  const seam = shade(paint[1], 0.9);
  return <>{cells.filter(cell => paintedRef.current?.has(cell.key) ?? false).map(cell => floorTile(cell, cellSize, paint[1], seam, paint[0]))}</>;
});

/** The channel's far walls: a flat band above every square with no floor
 * above it. Drawn after the floor, so they stand over it. */
const MazeWallFaces = React.memo(function MazeWallFacesImpl({ cells, cellSize }: { cells: ReadonlyArray<CellInfo>; cellSize: number }): React.JSX.Element {
  const face = Math.round(cellSize * TOP_FACE_RATIO);
  return (
    <>
      {cells.map(({ key: k, col, row, northOpen }) => {
        if (northOpen) return null;
        const x = col * cellSize;
        const y = row * cellSize - face;
        return (
          <Group key={`wall-${k}`}>
            <Rect x={x} y={y} width={cellSize} height={face} color={mazeColors.wallFace} />
            <Rect x={x} y={y} width={cellSize} height={LIP_PX} color={mazeColors.wallLip} />
            <Rect x={x} y={y + face - FOOT_PX} width={cellSize} height={FOOT_PX} color={mazeColors.wallFoot} />
          </Group>
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Chrome around the board - memoised, so the per-frame board render never
// re-renders it.
// ---------------------------------------------------------------------------

const BreakHeader = React.memo(function BreakHeaderImpl({
  index,
  count,
  paints,
  celebrating,
}: {
  index: number;
  count: number;
  paints: ReadonlyArray<Paint>;
  celebrating: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.headerCenter}>
      <Text style={styles.kicker}>A LITTLE PAUSE</Text>
      <Text style={styles.title}>{celebrating ? 'Beautifully done' : `Maze ${index + 1} of ${count}`}</Text>
      <View style={styles.dots}>
        {paints.map((paint, i) => {
          const done = i < index || (i === index && celebrating);
          const current = i === index && !celebrating;
          return (
            <View
              key={i}
              style={[styles.dot, done && { backgroundColor: paint[1], borderColor: paint[1] }, current && [styles.dotCurrent, { borderColor: paint[1] }]]}
            />
          );
        })}
      </View>
    </View>
  );
});

const BreakProgress = React.memo(function BreakProgressImpl({ painted, total, paint }: { painted: number; total: number; paint: Paint }): React.JSX.Element {
  const share = total > 0 ? painted / total : 0;
  return (
    <View style={styles.progress}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(share * 100)}%`, backgroundColor: paint[1] }]} />
      </View>
      <Text style={styles.progressCaption}>
        SWIPE TO ROLL · {painted} OF {total} TILES
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function CalmingInterstitialScreen({ onDone }: CalmingInterstitialScreenProps): React.JSX.Element {
  const mazes = useMemo(() => relaxBreakMazes(breakSeed(), MAZE_TARGET_COUNT), []);
  const paints = useMemo(() => {
    const offset = Math.floor(Math.random() * MAZE_PAINTS.length);
    return mazes.map((_m, i) => MAZE_PAINTS[(offset + i) % MAZE_PAINTS.length]);
  }, [mazes]);
  const [phase, setPhase] = useState<'intro' | 'play'>('intro');
  const doneRef = useRef(false);
  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };
  const bloom = useMemo(() => <PageBloom />, []);

  return (
    <View style={styles.container}>
      {bloom}
      {phase === 'intro' ? (
        <BreatherIntro paint={paints[0]} mazeCount={mazes.length} onBegin={() => setPhase('play')} onSkip={finish} />
      ) : (
        <MazeBreak mazes={mazes} paints={paints} onDone={finish} />
      )}
    </View>
  );
}

type HapticStep = { time: number; type: 'transient' | 'continuous'; duration?: number; intensity: number; sharpness: number };

/**
 * The roll, felt: a Core Haptics pattern built from the roll's own path
 * and timing, played the instant the ball sets off so it stays in step
 * with the native glide.
 *
 * iOS layers a low continuous rumble that builds as the ball gathers pace,
 * a soft click at every tile seam, and a heavy thud at the wall - a ball
 * rolling inside the phone. Android's motor plays one waveform at a time,
 * so there the rumble and clicks alternate, ending on the same thud.
 */
function rollHaptics(plan: RollPlan, timing: RollTiming): HapticStep[] {
  const end = timing.durationMs;
  const seams = plan.entries.map(entry => timing.timeAt(entry.at));
  const events: HapticStep[] = [];
  if (Platform.OS === 'ios') {
    const marks = [0, ...seams, end];
    for (let i = 0; i < marks.length - 1; i += 1) {
      const duration = marks[i + 1] - marks[i];
      if (duration <= 1) continue;
      events.push({ time: marks[i], type: 'continuous', duration, intensity: Math.min(0.55, 0.26 + i * 0.06), sharpness: 0.06 });
    }
    seams.forEach((time, i) => events.push({ time, type: 'transient', intensity: Math.min(0.6, 0.34 + i * 0.05), sharpness: 0.35 }));
    if (plan.hitsWall) {
      events.push({ time: end, type: 'transient', intensity: 1, sharpness: 0.6 });
      events.push({ time: end, type: 'continuous', duration: 80, intensity: 0.7, sharpness: 0.08 });
    }
  } else {
    const TICK = 12;
    let from = 0;
    seams.forEach(time => {
      if (time - TICK - from > 4) events.push({ time: from, type: 'continuous', duration: time - TICK - from, intensity: 0.18, sharpness: 0.1 });
      events.push({ time: Math.max(from, time - TICK), type: 'continuous', duration: TICK, intensity: 0.55, sharpness: 0.3 });
      from = time;
    });
    if (end - from > 4) events.push({ time: from, type: 'continuous', duration: end - from, intensity: 0.22, sharpness: 0.1 });
    if (plan.hitsWall) events.push({ time: end, type: 'continuous', duration: 50, intensity: 1, sharpness: 0.6 });
  }
  return events;
}

/** The ball dropping onto the board at the start of a maze - one firm
 * landing and a small second bounce. */
const DROP_HAPTICS: HapticStep[] = [
  { time: 0, type: 'transient', intensity: 0.95, sharpness: 0.55 },
  { time: 0, type: 'continuous', duration: 60, intensity: 0.6, sharpness: 0.08 },
  { time: 200, type: 'transient', intensity: 0.4, sharpness: 0.4 },
];

interface ActiveRoll {
  readonly plan: RollPlan;
  readonly progress: Animated.Value;
  readonly listener: string;
  /** A turn swiped that the path never reached - tried off the wall. */
  readonly queued: Heading | null;
  painted: number;
}

interface BallNodes {
  readonly x: Animated.AnimatedInterpolation<number> | Animated.Value;
  readonly y: Animated.AnimatedInterpolation<number> | Animated.Value;
  /** The trail's positions - the ball's path, a little behind it. */
  readonly trail: ReadonlyArray<{ x: Animated.AnimatedInterpolation<number> | Animated.Value; y: Animated.AnimatedInterpolation<number> | Animated.Value }>;
}

/** Trail ghosts: how far behind the ball (squares), size, strength. */
const TRAIL = [
  { lag: 0.28, size: 0.82, alpha: 0.42 },
  { lag: 0.56, size: 0.64, alpha: 0.26 },
  { lag: 0.86, size: 0.46, alpha: 0.14 },
];

/** Paint flecks thrown back off a wall: angle off the rebound direction,
 * distance and size as shares of the ball's radius. */
const FLECKS = [
  { angle: -1.05, dist: 1.5, size: 0.22 },
  { angle: -0.45, dist: 1.9, size: 0.16 },
  { angle: 0.1, dist: 1.6, size: 0.2 },
  { angle: 0.6, dist: 2.0, size: 0.14 },
  { angle: 1.1, dist: 1.45, size: 0.18 },
];

/**
 * The ball: a glazed violet marble, drawn once and moved by the native
 * driver.
 *
 * Shaded in flat steps, not gradients: a rim of reflected paint light
 * along its lower right, the dark ink body, a lit upper body, a brighter
 * core, a soft gloss and a hard specular point - the highlights fixed to
 * the light, so they stay put while the surface turns under them. Two thin
 * paint bands slide across its face as it travels (fading in at the back
 * edge, out at the front), which is what makes it read as a sphere turning
 * over rather than a disc sliding. A contact shadow sits beneath it, and
 * a fading trail of paint follows it while it rolls.
 */
const MarbleBall = React.memo(function MarbleBallImpl({
  radius,
  paint,
  nodes,
  squashX,
  squashY,
  breathe,
  lift,
  motion,
  marble,
}: {
  radius: number;
  /** The marble's colours, from the shop: [rim, body, core, band]. */
  marble: ReadonlyArray<string>;
  paint: Paint;
  nodes: BallNodes;
  squashX: Animated.Value;
  squashY: Animated.Value;
  breathe: Animated.Value;
  lift: Animated.Value;
  motion: Animated.Value;
}): React.JSX.Element {
  const size = radius * 2;
  const period = Math.PI * radius;
  const band = radius * 0.26;
  const slide = (node: BallNodes['x'], offset: number) => {
    const phase = Animated.modulo(Animated.add(node, offset * period), period);
    return {
      translate: phase.interpolate({ inputRange: [0, period], outputRange: [-radius * 1.2, radius * 1.2] }),
      opacity: phase.interpolate({ inputRange: [0, period * 0.25, period * 0.5, period * 0.75, period], outputRange: [0, 0.5, 0.62, 0.5, 0] }),
    };
  };
  const across = slide(nodes.x, 0.3);
  const down = slide(nodes.y, 0.72);
  const circle = (d: number) => ({ width: d, height: d, borderRadius: d / 2 });
  const raised = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -radius * 3] });

  return (
    <>
      {TRAIL.map((ghost, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ball,
            circle(size * ghost.size),
            {
              left: -radius * ghost.size,
              top: -radius * ghost.size,
              backgroundColor: paint[1],
              opacity: Animated.multiply(motion, ghost.alpha),
              transform: [{ translateX: nodes.trail[i].x }, { translateY: nodes.trail[i].y }],
            },
          ]}
        />
      ))}
      <Animated.View pointerEvents="none" style={[styles.ball, { left: -radius, top: -radius, width: size, height: size, transform: [{ translateX: nodes.x }, { translateY: nodes.y }] }]}>
        <Animated.View
          style={[
            styles.ballShadow,
            { width: size * 1.02, height: size * 0.5, borderRadius: radius, left: -radius * 0.01, top: radius * 1.28 },
            {
              opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }),
              transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            circle(size),
            {
              transform: [
                { translateY: raised },
                { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) },
                { scaleX: squashX },
                { scaleY: squashY },
                { scale: breathe },
              ],
            },
          ]}
        >
          <View style={[circle(size), styles.ballClip, { backgroundColor: paint[0] }]}>
            <View style={[styles.layer, circle(size), { left: -radius * 0.08, top: -radius * 0.08, backgroundColor: marble[0] ?? mazeColors.ball }]} />
            <View style={[styles.layer, circle(size * 0.84), { left: radius * 0.02, top: radius * 0.0, backgroundColor: marble[1] ?? shade(mazeColors.ball, 1.5) }]} />
            <View style={[styles.layer, circle(size * 0.5), { left: radius * 0.22, top: radius * 0.18, backgroundColor: marble[2] ?? shade(mazeColors.ball, 1.95) }]} />
            <Animated.View style={[styles.layer, styles.bandAcross, { left: radius - band / 2, width: band, height: size, backgroundColor: paint[0], opacity: across.opacity, transform: [{ translateX: across.translate }] }]} />
            <Animated.View style={[styles.layer, styles.bandDown, { top: radius - band / 2, height: band, width: size, backgroundColor: paint[0], opacity: down.opacity, transform: [{ translateY: down.translate }] }]} />
          </View>
          <View style={[styles.layer, styles.ballGloss, { width: radius * 0.66, height: radius * 0.4, borderRadius: radius * 0.2, left: radius * 0.34, top: radius * 0.36 }]} />
          <View style={[styles.layer, styles.ballSpecular, circle(radius * 0.2), { left: radius * 0.5, top: radius * 0.46 }]} />
        </Animated.View>
      </Animated.View>
    </>
  );
});

function MazeBreak({ mazes, paints, onDone }: { mazes: ReadonlyArray<MazeShape>; paints: ReadonlyArray<Paint>; onDone: () => void }): React.JSX.Element {
  // The marble the player wears (see the shop) - violet by default.
  const marble = useEquipped('ball');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  // The box the board may fill, once the header above and the progress
  // line below have their room.
  const boxWidth = width - theme.spacing.lg * 2 - STAGE_PAD * 2;
  const boxHeight = Math.max(220, height - insets.top - insets.bottom - 330);
  const fitCell = (maze: MazeShape): number => {
    const cols = Math.max(maze.cols, MIN_FIT_COLS) + SLAB_PAD_RATIO * 2;
    const rows = Math.max(maze.rows, MIN_FIT_ROWS) + SLAB_PAD_RATIO * 2 + TOP_FACE_RATIO;
    return Math.floor(Math.min(boxWidth / cols, (boxHeight - SLAB_SIDE_PX) / rows));
  };

  const [level, setLevel] = useState(0);
  const maze = mazes[level % mazes.length];
  const paint = paints[level % paints.length];
  const cellSize = fitCell(maze);
  const cellRef = useRef(cellSize);
  cellRef.current = cellSize;
  const mazeRef = useRef(maze);
  mazeRef.current = maze;

  const startPoint = (m: MazeShape): Point => ({ x: m.start.col + 0.5, y: m.start.row + 0.5 });
  // Empty until the ball lands: the first square is painted by the ball
  // dropping onto it, not handed over pre-coloured - a painted square
  // under a ball that had not moved yet read as a bug.
  const paintedRef = useRef<Set<string>>(new Set());
  const [paintedVersion, setPaintedVersion] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  /** Swipes wait until the ball has landed, and stop once a maze is done. */
  const readyRef = useRef(false);
  /** Where the ball rests, in squares - valid whenever no roll is live. */
  const restRef = useRef<Point>(startPoint(maze));
  const rollRef = useRef<ActiveRoll | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const squashX = useRef(new Animated.Value(1)).current;
  const squashY = useRef(new Animated.Value(1)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(1)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const impact = useRef(new Animated.Value(1)).current;
  const boardIn = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const [impactAt, setImpactAt] = useState<{ x: number; y: number; dc: number; dr: number; n: number } | null>(null);

  const restingNodes = (p: Point, cell: number): BallNodes => {
    const x = new Animated.Value(p.x * cell);
    const y = new Animated.Value(p.y * cell);
    return { x, y, trail: TRAIL.map(() => ({ x, y })) };
  };
  const [nodes, setNodes] = useState<BallNodes>(() => restingNodes(startPoint(maze), cellSize));

  // A slow breath while the ball rests - alive, not paused. Native, and
  // held still while it rolls.
  const breathingRef = useRef<Animated.CompositeAnimation | null>(null);
  const startBreathing = (): void => {
    breathingRef.current?.stop();
    const depth = reducedMotion ? 1.008 : 1.03;
    breathingRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: depth, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathingRef.current.start();
  };
  const stopBreathing = (): void => {
    breathingRef.current?.stop();
    breathingRef.current = null;
    breathe.setValue(1);
  };

  const paintKey = (key: string): void => {
    if (paintedRef.current.has(key)) return;
    paintedRef.current.add(key);
    setPaintedVersion(v => v + 1);
  };

  const showImpact = (x: number, y: number, dc: number, dr: number): void => {
    if (reducedMotion) return;
    setImpactAt(prev => ({ x, y, dc, dr, n: (prev?.n ?? 0) + 1 }));
    impact.setValue(0);
    Animated.timing(impact, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const squash = (alongX: boolean, depth: number): void => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(alongX ? squashX : squashY, { toValue: 1 - depth, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(alongX ? squashY : squashX, { toValue: 1 + depth * 0.8, duration: 55, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(squashX, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }),
        Animated.spring(squashY, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }),
      ]),
    ]).start();
  };

  /** The ball drops onto the start square: it falls in, lands with a thud
   * that paints the square, and settles with one small bounce. */
  const dropIn = (m: MazeShape): void => {
    readyRef.current = false;
    const key = `${m.start.col}:${m.start.row}`;
    const land = (): void => {
      paintKey(key);
      playHapticEvents(DROP_HAPTICS);
      const p = startPoint(m);
      showImpact(p.x, p.y + BALL_RADIUS, 0, 1);
      squash(false, 0.2);
      readyRef.current = true;
      startBreathing();
    };
    if (reducedMotion) {
      lift.setValue(0);
      land();
      return;
    }
    lift.setValue(1);
    Animated.timing(lift, { toValue: 0, duration: 340, delay: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      land();
      Animated.sequence([
        Animated.timing(lift, { toValue: 0.1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    });
  };

  const enterBoard = (): void => {
    boardIn.setValue(reducedMotion ? 1 : 0);
    Animated.timing(boardIn, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  useEffect(() => {
    enterBoard();
    dropIn(maze);
    const timers = timersRef.current;
    const safety = setTimeout(onDone, SAFETY_DURATION_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(safety);
      rollRef.current?.progress.removeAllListeners();
      breathingRef.current?.stop();
      stopHaptics();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMaze = (next: number): void => {
    const m = mazes[next % mazes.length];
    const cell = fitCell(m);
    paintedRef.current = new Set();
    restRef.current = startPoint(m);
    rollRef.current = null;
    cellRef.current = cell;
    setLevel(next);
    setCelebrating(false);
    setImpactAt(null);
    setNodes(restingNodes(startPoint(m), cell));
    enterBoard();
    dropIn(m);
  };

  /** Paints every square the live roll has entered by distance `upTo`. */
  const paintUpTo = (roll: ActiveRoll, upTo: number): void => {
    while (roll.painted < roll.plan.entries.length && roll.plan.entries[roll.painted].at <= upTo + 1e-6) {
      paintKey(roll.plan.entries[roll.painted].key);
      roll.painted += 1;
    }
  };

  const endRoll = (roll: ActiveRoll): void => {
    roll.progress.removeListener(roll.listener);
    Animated.timing(motion, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const land = (roll: ActiveRoll): void => {
    rollRef.current = null;
    endRoll(roll);
    paintUpTo(roll, roll.plan.length);
    restRef.current = roll.plan.end;
    const { plan } = roll;

    if (plan.hitsWall) {
      squash(plan.heading.dc !== 0, 0.24);
      showImpact(plan.end.x + plan.heading.dc * BALL_RADIUS, plan.end.y + plan.heading.dr * BALL_RADIUS, plan.heading.dc, plan.heading.dr);
    }

    if (paintedRef.current.size >= mazeRef.current.active.size) {
      readyRef.current = false;
      setCelebrating(true);
      triggerFeedback('mazeSolve');
      const last = level + 1 >= mazes.length;
      timersRef.current.push(setTimeout(() => (last ? onDone() : startMaze(level + 1)), CELEBRATE_PAUSE_MS));
      return;
    }

    // A turn swiped on the way in that the path never reached: taken off
    // the wall, as soon as the ball lands.
    const queued = roll.queued;
    if (queued && (queued.dc !== plan.heading.dc || queued.dr !== plan.heading.dr)) {
      const at = plan.end;
      if (hasOpenEdge(mazeRef.current, { col: Math.floor(at.x), row: Math.floor(at.y) }, queued.dc, queued.dr)) {
        rollFrom(at, queued, null, true);
        return;
      }
    }
    startBreathing();
  };

  /** Sets the ball off along a planned path. */
  const rollFrom = (from: Point, heading: Heading, queued: Heading | null, fromRest: boolean): void => {
    const plan = planRoll(mazeRef.current, from, heading, queued, BALL_RADIUS);
    if (plan.length < 0.02) {
      // Blocked where it stands: a small nudge against the wall, felt.
      restRef.current = plan.end;
      if (fromRest) {
        squash(heading.dc !== 0, 0.1);
        triggerFeedback('mazeContact');
      }
      startBreathing();
      return;
    }
    stopBreathing();
    const cell = cellRef.current;
    const timing = rollTiming(plan.length, ROLL_SPEED, ROLL_RAMP, fromRest);
    const progress = new Animated.Value(0);
    const along = (lag: number) => {
      const behind = lag > 0 ? Animated.subtract(progress, lag) : progress;
      const range = (values: number[]) => ({ inputRange: [...plan.distances], outputRange: values, extrapolate: 'clamp' as const });
      return {
        x: (behind as Animated.Value).interpolate<number>(range(plan.points.map(p => p.x * cell))),
        y: (behind as Animated.Value).interpolate<number>(range(plan.points.map(p => p.y * cell))),
      };
    };
    // Paint follows the ball's real, native position - not a JS clock that
    // runs ahead of it while the native animation is still starting.
    const roll: ActiveRoll = { plan, progress, queued, painted: 0, listener: '' };
    (roll as { listener: string }).listener = progress.addListener(({ value }) => paintUpTo(roll, value));
    rollRef.current = roll;
    const head = along(0);
    setNodes({ ...head, trail: TRAIL.map(ghost => along(ghost.lag)) });
    motion.setValue(1);
    Animated.timing(progress, { toValue: plan.length, duration: timing.durationMs, easing: timing.easing, useNativeDriver: true }).start(({ finished }) => {
      if (finished && rollRef.current === roll) land(roll);
    });
    stopHaptics();
    playHapticEvents(rollHaptics(plan, timing));
  };

  /** A swipe: set off from rest, or - mid-roll - reverse, or turn. */
  const swipe = (heading: Heading): void => {
    if (!readyRef.current) return;
    const live = rollRef.current;
    if (!live) {
      rollFrom(restRef.current, heading, null, true);
      return;
    }

    live.progress.stopAnimation(distance => {
      if (rollRef.current !== live) return;
      paintUpTo(live, distance);
      // Which way it is going right now: the path segment it is on.
      const { points, distances } = live.plan;
      const i = Math.max(1, distances.findIndex(d => d >= distance));
      const a = points[i - 1];
      const b = points[Math.min(i, points.length - 1)];
      const current: Heading = { dc: Math.sign(b.x - a.x), dr: Math.sign(b.y - a.y) };
      const here = pointAt(live.plan, distance);
      rollRef.current = null;
      live.progress.removeListener(live.listener);
      stopHaptics();
      if (current.dc === heading.dc && current.dr === heading.dr) {
        // Same way: carry on, at speed, from here.
        rollFrom(here, heading, live.queued, false);
        return;
      }
      if (current.dc === -heading.dc && current.dr === -heading.dr) {
        rollFrom(here, heading, null, true);
        return;
      }
      // A turn: right here if the ball is at, or only just past, this
      // square's centre; otherwise at the next square that opens that way.
      const col = Math.floor(here.x);
      const row = Math.floor(here.y);
      const past = current.dc !== 0 ? (here.x - (col + 0.5)) * current.dc : (here.y - (row + 0.5)) * current.dr;
      if (past >= 0 && past <= TURN_GRACE && hasOpenEdge(mazeRef.current, { col, row }, heading.dc, heading.dr)) {
        rollFrom({ x: col + 0.5, y: row + 0.5 }, heading, null, false);
        return;
      }
      rollFrom(here, current, heading, false);
    });
  };

  const handleDirection = (direction: Direction): void => {
    if (direction === 'up') swipe({ dc: 0, dr: -1 });
    else if (direction === 'down') swipe({ dc: 0, dr: 1 });
    else if (direction === 'left') swipe({ dc: -1, dr: 0 });
    else swipe({ dc: 1, dr: 0 });
  };
  // Read across the whole screen, fired mid-drag - see `useSwipeGesture`.
  const swipeHandlers = useSwipeGesture(handleDirection);
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const direction = directionForAccessibilityAction(event.nativeEvent.actionName);
    if (direction) handleDirection(direction);
  };

  const topFacePx = Math.round(cellSize * TOP_FACE_RATIO);
  const pad = Math.round(cellSize * SLAB_PAD_RATIO);
  const slabWidth = cellSize * maze.cols + pad * 2;
  const slabHeight = cellSize * maze.rows + topFacePx + pad * 2 + SLAB_SIDE_PX;
  const radius = cellSize * BALL_RADIUS;

  const activeCells = useMemo<CellInfo[]>(
    () =>
      Array.from(maze.active).map(k => {
        const [col, row] = k.split(':').map(Number);
        return {
          key: k,
          col,
          row,
          northOpen: hasOpenEdge(maze, { col, row }, 0, -1),
          southOpen: hasOpenEdge(maze, { col, row }, 0, 1),
          eastOpen: hasOpenEdge(maze, { col, row }, 1, 0),
        };
      }),
    [maze],
  );

  const rule = useMemo(() => <GeometricRule variant="stage" style={styles.stageRule} />, []);

  return (
    <View style={[styles.play, { paddingTop: insets.top + theme.spacing.sm }]} {...swipeHandlers}>
      <View style={styles.topBar}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Skip the break"
          onPress={onDone}
          style={({ pressed }) => [styles.skipPill, pressed && styles.skipPillPressed]}
        >
          <Text style={styles.skipPillLabel}>Skip</Text>
        </PressableScale>
      </View>

      <BreakHeader index={level} count={mazes.length} paints={paints} celebrating={celebrating} />

      <View style={styles.stage}>
        {rule}
        <Animated.View
          style={{
            width: slabWidth,
            height: slabHeight,
            opacity: boardIn.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scale: boardIn.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Maze"
          accessibilityValue={{ text: `${paintedRef.current.size} of ${maze.active.size} tiles painted` }}
          accessibilityActions={ACCESSIBILITY_ACTIONS}
          onAccessibilityAction={onAccessibilityAction}
        >
          <Canvas style={StyleSheet.absoluteFill}>
            <MazeSlab width={slabWidth} height={slabHeight} paint={paint} />
            <Group transform={[{ translateX: pad }, { translateY: pad + topFacePx }]}>
              <MazeFloorBase cells={activeCells} cellSize={cellSize} />
              <MazePaintedFloor cells={activeCells} cellSize={cellSize} paintedRef={paintedRef} paint={paint} paintedVersion={paintedVersion} />
              <MazeWallFaces cells={activeCells} cellSize={cellSize} />
            </Group>
          </Canvas>
          <View pointerEvents="none" style={[styles.ballLayer, { left: pad, top: pad + topFacePx }]}>
            {impactAt && (
              <React.Fragment key={impactAt.n}>
                <Animated.View
                  style={[
                    styles.ripple,
                    {
                      left: impactAt.x * cellSize - radius,
                      top: impactAt.y * cellSize - radius,
                      width: radius * 2,
                      height: radius * 2,
                      borderRadius: radius,
                      borderColor: paint[1],
                      opacity: impact.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
                      transform: [{ scale: impact.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.8] }) }],
                    },
                  ]}
                />
                {FLECKS.map((fleck, i) => {
                  // Thrown back off the wall, fanned either side of straight back.
                  const back = Math.atan2(-impactAt.dr, -impactAt.dc) + fleck.angle;
                  const d = radius * fleck.dist;
                  const s = radius * fleck.size * 2;
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.fleck,
                        {
                          left: impactAt.x * cellSize - s / 2,
                          top: impactAt.y * cellSize - s / 2,
                          width: s,
                          height: s,
                          borderRadius: s / 2,
                          backgroundColor: paint[2],
                          opacity: impact.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.7, 0] }),
                          transform: [
                            { translateX: impact.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(back) * d] }) },
                            { translateY: impact.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(back) * d] }) },
                            { scale: impact.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) },
                          ],
                        },
                      ]}
                    />
                  );
                })}
              </React.Fragment>
            )}
            <MarbleBall radius={radius} marble={marble.colors} paint={paint} nodes={nodes} squashX={squashX} squashY={squashY} breathe={breathe} lift={lift} motion={motion} />
          </View>
        </Animated.View>
      </View>

      <BreakProgress painted={paintedRef.current.size} total={maze.active.size} paint={paint} />

      {celebrating && <ConfettiBurst />}
    </View>
  );
}

const STAGE_PAD = theme.spacing.md;
const ACCESSIBILITY_ACTIONS = [
  { name: 'up', label: 'Roll up' },
  { name: 'down', label: 'Roll down' },
  { name: 'left', label: 'Roll left' },
  { name: 'right', label: 'Roll right' },
];

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  play: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  topBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipPill: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skipPillPressed: { backgroundColor: theme.colors.surfaceAlt },
  skipPillLabel: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.secondary,
  },
  title: {
    marginTop: 2,
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    lineHeight: theme.typography.lineHeights.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  dotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
  },
  // The same plinth every board sits on - see `GameScreen`'s stage.
  stage: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 28,
    paddingHorizontal: STAGE_PAD,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
  },
  stageRule: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.md,
  },
  progress: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  progressTrack: {
    width: 180,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  ballLayer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  ball: {
    position: 'absolute',
  },
  ballShadow: {
    position: 'absolute',
    backgroundColor: inkWash(0.2),
  },
  ballClip: {
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
  },
  ballGloss: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ rotate: '-32deg' }],
  },
  ballSpecular: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  bandAcross: { top: 0 },
  bandDown: { left: 0 },
  fleck: {
    position: 'absolute',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 3,
  },
  progressCaption: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textSecondary,
  },
}));

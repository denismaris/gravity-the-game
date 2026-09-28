import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

export interface CardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AlmanacBackdropProps {
  readonly width: number;
  readonly height: number;
  /** Where Home's card sits on screen. The composition is built around it:
   * the blossoms grow from *behind* the card, so the card is part of the
   * picture rather than a panel dropped on top of one. */
  readonly card: CardRect;
}

/**
 * Home's ground: the `bloom` poster (`android/design-reference`, the same
 * print this whole palette was measured from) set around the card.
 *
 * An earlier version scattered twenty-odd small bars, rings and crosses at
 * 6-11% alpha, placed by a seeded random walk. That read as noise - even
 * texture with no subject, and exactly the "evenly sprinkled decoration"
 * look that gives a screen away as generated. The poster works the other
 * way round: a few *large* shapes in full-strength flat ink, cropped hard
 * by the edge of the sheet, overlapping one another. So this draws the
 * poster's own vocabulary at the poster's own scale:
 *
 * - terracotta blossoms with scalloped, slightly irregular lobes (each lobe
 *   a true circular arc, so the edge is cut-paper round rather than
 *   petal-pointed), rising over the card's top edge and spilling out from
 *   under its foot;
 * - violet stems and leaves crossing down to the bottom of the sheet;
 * - the half-dome on stacked rules and the loose disc from the poster's
 *   bottom-right corner, bleeding off the right edge.
 *
 * All flat ink - no gradient, no blur (see the depth-vs-flat note in this
 * app's history). Depth comes from overlap alone: the card sits over the
 * flowers, the flowers over their stems.
 *
 * Everything is placed relative to the card and the screen edges, never at
 * absolute coordinates, and nothing is drawn into the masthead band or the
 * page-tally row between the card and the bottom.
 */
export function AlmanacBackdrop({ width, height, card }: AlmanacBackdropProps): React.JSX.Element | null {
  const art = useMemo(() => composeBloom(width, height, card), [width, height, card]);
  const reducedMotion = useReducedMotion();
  if (!art) return null;

  const ink = theme.colors.primary;
  const bloom = theme.colors.secondary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* The still parts - stems, dome, rules, discs - in one canvas, drawn
          once. They are the anchor the moving pieces sway against. */}
      <Canvas style={StyleSheet.absoluteFill}>
        {art.stems.map((d, i) => (
          <Path key={`stem-${i}`} path={d} color={ink} style="stroke" strokeWidth={art.stemWidth} strokeCap="round" />
        ))}
        <Group>
          <Path path={art.dome} color={ink} />
          {art.rules.map((r, i) => (
            <Rect key={`rule-${i}`} x={r.x} y={r.y} width={r.width} height={r.height} color={ink} />
          ))}
          {art.discs.map((d, i) => (
            <Circle key={`disc-${i}`} cx={d.cx} cy={d.cy} r={d.r} color={ink} />
          ))}
        </Group>
      </Canvas>

      {/* Leaves rock on their stalks; blossoms (over them) sway and
          breathe. Each has its own period and phase so nothing moves in
          lockstep - a garden, not a metronome. */}
      {art.leaves.map((leaf, i) => {
        const pad = leaf.halfWidth * 2.4;
        const box = {
          x: Math.min(leaf.bx, leaf.tx) - pad,
          y: Math.min(leaf.by, leaf.ty) - pad,
          w: Math.abs(leaf.tx - leaf.bx) + pad * 2,
          h: Math.abs(leaf.ty - leaf.by) + pad * 2,
        };
        return (
          <Swaying
            key={`leaf-${i}`}
            box={box}
            pivot={{ x: leaf.bx, y: leaf.by }}
            swayDegrees={6}
            breathe={0}
            periodMs={7200 + i * 1900}
            enterDelayMs={260 + i * 120}
            enterTurnDegrees={-24}
            still={reducedMotion}
          >
            <Path path={leaf.path} color={ink} />
          </Swaying>
        );
      })}
      {art.blossoms.map((b, i) => {
        const reach = b.r * 1.25;
        return (
          <Swaying
            key={`bloom-${i}`}
            box={{ x: b.cx - reach, y: b.cy - reach, w: reach * 2, h: reach * 2 }}
            pivot={{ x: b.cx, y: b.cy }}
            swayDegrees={3.5}
            breathe={0.025}
            periodMs={9000 + i * 1700}
            enterDelayMs={80 + i * 140}
            enterTurnDegrees={-18}
            still={reducedMotion}
          >
            <Path path={b.path} color={bloom} />
          </Swaying>
        );
      })}
    </View>
  );
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * One moving piece of the print. Its artwork is drawn once, into a canvas
 * just big enough to hold it, and everything after that - the entrance and
 * the endless sway - is a native-driver transform on the view around it:
 * zero JavaScript per frame, so Home stays perfectly smooth however long
 * it sits open, and costs nothing while a puzzle loads behind it.
 */
function Swaying({
  box,
  pivot,
  swayDegrees,
  breathe,
  periodMs,
  enterDelayMs,
  enterTurnDegrees,
  still,
  children,
}: {
  box: Box;
  /** The screen point it turns about - a blossom's centre, a leaf's base. */
  pivot: { x: number; y: number };
  swayDegrees: number;
  /** Scale swing either side of 1 while swaying. */
  breathe: number;
  periodMs: number;
  enterDelayMs: number;
  /** How far it is turned before the entrance unfurls it. */
  enterTurnDegrees: number;
  still: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const enter = useRef(new Animated.Value(still ? 1 : 0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      enter.setValue(1);
      sway.setValue(0);
      return;
    }
    const opening = Animated.sequence([
      Animated.delay(enterDelayMs),
      Animated.spring(enter, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 90, mass: 1 }),
    ]);
    // Out to one side, back through rest to the other, and home - a sine
    // ease on each leg, so it never visibly stops at the ends.
    const quarter = periodMs / 4;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: quarter, easing: ease, useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: quarter * 2, easing: ease, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: quarter, easing: ease, useNativeDriver: true }),
      ]),
    );
    opening.start();
    loop.start();
    return () => {
      opening.stop();
      loop.stop();
    };
  }, [still, enter, sway, enterDelayMs, periodMs]);

  const rotate = Animated.add(
    sway.interpolate({ inputRange: [-1, 1], outputRange: [-swayDegrees, swayDegrees] }),
    enter.interpolate({ inputRange: [0, 1], outputRange: [enterTurnDegrees, 0] }),
  ).interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] });
  const scale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
    sway.interpolate({ inputRange: [-1, 0, 1], outputRange: [1 - breathe, 1, 1 + breathe] }),
  );

  return (
    <Animated.View
      style={{
        ...styles.piece,
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        opacity: enter.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
        transformOrigin: [pivot.x - box.x, pivot.y - box.y, 0],
        transform: [{ rotate }, { scale }],
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: -box.x }, { translateY: -box.y }]}>{children}</Group>
      </Canvas>
    </Animated.View>
  );
}

/** A blossom, with the centre it sways and breathes about. */
export interface BloomBlossom {
  readonly path: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** A leaf, with the base it pivots on and the tip it reaches to. */
export interface BloomLeaf {
  readonly path: string;
  readonly bx: number;
  readonly by: number;
  readonly tx: number;
  readonly ty: number;
  readonly halfWidth: number;
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});

interface BloomArt {
  readonly blossoms: ReadonlyArray<BloomBlossom>;
  readonly stems: ReadonlyArray<string>;
  readonly leaves: ReadonlyArray<BloomLeaf>;
  readonly stemWidth: number;
  readonly dome: string;
  readonly rules: ReadonlyArray<{ x: number; y: number; width: number; height: number }>;
  readonly discs: ReadonlyArray<{ cx: number; cy: number; r: number }>;
}

/** Lays the composition out around `card`. Exported for its tests. */
export function composeBloom(width: number, height: number, card: CardRect): BloomArt | null {
  if (width <= 0 || height <= 0 || card.width <= 0 || card.height <= 0) return null;

  const left = card.x;
  const right = card.x + card.width;
  const top = card.y;
  const foot = card.y + card.height;
  // One unit for every size here, so the picture scales with the phone
  // rather than being tuned to one screen.
  const u = card.width / 354;

  const blossom = (cx: number, cy: number, r: number, lobes: number, seed: number, rotation: number): BloomBlossom => ({
    path: blossomPath(cx, cy, r, lobes, seed, rotation),
    cx,
    cy,
    r,
  });
  const blossoms = [
    // The big one, rising over the card's top-right corner.
    blossom(right - 40 * u, top - 26 * u, 74 * u, 7, 11, -0.3),
    // A smaller one on the left, only its crown showing.
    blossom(left + 44 * u, top - 4 * u, 46 * u, 6, 23, 0.4),
    // Spilling out from under the card's foot, cut by the left edge.
    blossom(left + 6 * u, foot + 92 * u, 60 * u, 7, 37, 0.1),
  ];

  // Two stems leaving the card's foot and crossing on the way down to the
  // bottom of the sheet - the poster's crossed stalks.
  const stems = [
    `M ${left + 96 * u} ${foot - 10} C ${left + 92 * u} ${foot + 70 * u}, ${left + 40 * u} ${foot + 120 * u}, ${left + 62 * u} ${height + 10}`,
    `M ${left + 70 * u} ${foot - 10} C ${left + 84 * u} ${foot + 80 * u}, ${left + 136 * u} ${foot + 110 * u}, ${left + 118 * u} ${height + 10}`,
  ];

  const leaf = (bx: number, by: number, tx: number, ty: number, halfWidth: number): BloomLeaf => ({
    path: leafPath(bx, by, tx, ty, halfWidth),
    bx,
    by,
    tx,
    ty,
    halfWidth,
  });
  const leaves = [
    // Off the stalks just under the card, reaching right - kept high and
    // short so it never reaches the page tally further down.
    leaf(left + 92 * u, foot + 34 * u, left + 150 * u, foot + 18 * u, 13 * u),
    // Between the two top blossoms, rising from behind the card.
    leaf(left + 132 * u, top + 8, left + 104 * u, top - 84 * u, 15 * u),
  ];

  const domeR = 40 * u;
  const domeCx = width - 26 * u;
  const domeBase = foot + 104 * u;
  const dome = `M ${domeCx - domeR} ${domeBase} A ${domeR} ${domeR} 0 0 1 ${domeCx + domeR} ${domeBase} Z`;
  const ruleH = 6 * u;
  const rules = [0, 1, 2].map(i => ({
    x: domeCx - domeR - 34 * u,
    y: domeBase + 8 * u + i * (ruleH + 7 * u),
    width: width - (domeCx - domeR - 34 * u) + 10,
    height: ruleH,
  }));
  const discs = [
    { cx: domeCx - domeR - 26 * u, cy: domeBase - 20 * u, r: 10 * u },
    // The poster's lone disc in the upper field, in the open ground
    // between the leaf and the big blossom.
    { cx: left + 196 * u, cy: top - 46 * u, r: 9 * u },
  ];

  return { blossoms, stems, leaves, stemWidth: Math.max(4, 6 * u), dome, rules, discs };
}

/**
 * A cut-paper blossom: `lobes` circular arcs around a centre, each one
 * bulging out between two notches. Lobe size and spacing are nudged by a
 * seeded stream so no two blossoms - and no two lobes - are the same,
 * which is most of the difference between a printed flower and a
 * generated rosette.
 */
export function blossomPath(cx: number, cy: number, radius: number, lobes: number, seed: number, rotation: number): string {
  const random = seeded(seed);
  const step = (Math.PI * 2) / lobes;
  const tipAngles: number[] = [];
  const tipRadii: number[] = [];
  for (let i = 0; i < lobes; i += 1) {
    tipAngles.push(rotation + i * step + (random() - 0.5) * step * 0.28);
    tipRadii.push(radius * (0.9 + random() * 0.16));
  }
  // Notch i sits between tip i and tip i + 1.
  const notches: Array<[number, number]> = [];
  for (let i = 0; i < lobes; i += 1) {
    const a0 = tipAngles[i];
    let a1 = tipAngles[(i + 1) % lobes];
    if (a1 <= a0) a1 += Math.PI * 2;
    const a = (a0 + a1) / 2;
    const r = radius * (0.66 + random() * 0.08);
    notches.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }

  let d = `M ${fmt(notches[lobes - 1][0])} ${fmt(notches[lobes - 1][1])}`;
  for (let i = 0; i < lobes; i += 1) {
    const [x1, y1] = notches[(i + lobes - 1) % lobes];
    const [x2, y2] = notches[i];
    const tx = cx + Math.cos(tipAngles[i]) * tipRadii[i];
    const ty = cy + Math.sin(tipAngles[i]) * tipRadii[i];
    // The circle through both notches and the tip: chord, then sagitta
    // (the tip's distance from the chord), then radius from those two.
    const chord = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / chord;
    const ny = (x2 - x1) / chord;
    const sagitta = Math.abs((tx - x1) * nx + (ty - y1) * ny);
    const arcR = (chord * chord) / 4 / (2 * sagitta) + sagitta / 2;
    const large = sagitta > chord / 2 ? 1 : 0;
    // Notches run clockwise on screen, so sweep 1 bulges outward.
    d += ` A ${fmt(arcR)} ${fmt(arcR)} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)}`;
  }
  return `${d} Z`;
}

/** A pointed leaf from `base` to `tip`, `halfWidth` at its widest. */
export function leafPath(bx: number, by: number, tx: number, ty: number, halfWidth: number): string {
  const len = Math.hypot(tx - bx, ty - by);
  const nx = -(ty - by) / len;
  const ny = (tx - bx) / len;
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  // Quadratic control points sit at twice the wanted width, since a
  // quadratic only reaches half-way to its control point.
  const w = halfWidth * 2;
  return `M ${fmt(bx)} ${fmt(by)} Q ${fmt(mx + nx * w)} ${fmt(my + ny * w)} ${fmt(tx)} ${fmt(ty)} Q ${fmt(mx - nx * w)} ${fmt(my - ny * w)} ${fmt(bx)} ${fmt(by)} Z`;
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function seeded(seed: number): () => number {
  let state = (seed % 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { accentColorForKind, GameKind } from '../game/journey';
import { hexToRgb } from '../game/rendering';
import { motion, theme } from '../theme';

export interface GameEmblemProps {
  readonly kind: GameKind;
  /** Outer square size in pixels. Every mark inside is derived from this,
   * so one emblem set works at card size and at summary-row size. */
  readonly size?: number;
}

const DEFAULT_SIZE = 64;

/** `hex` at `alpha` - the accents are all `#rrggbb` literals, and a tinted
 * plate needs real transparency rather than `shade`'s opaque tone, so the
 * plate keeps working over the card's paper *and* over a dimmed board. */
function tint(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * One emblem per game - a small, flat, geometric mark on a tinted plate in
 * that game's own accent colour.
 *
 * Each mark is taken from the thing the game actually asks you to look at,
 * not from an arbitrary icon set: Skyscrapers is a skyline of rising bars,
 * Binairo is its own two fillable symbols side by side, Mirror Maze is a
 * beam turning a corner off a mirror, Tents and Trees is a tent beside a
 * tree, Gravity is a piece falling to its target ring. A player who has
 * played the game should recognise its emblem without being told.
 *
 * Deliberately flat and square-cornered inside a rounded plate, in one
 * colour: these sit next to each other in the batch summary, and five
 * marks competing with gradients and highlights would read as clutter
 * rather than as a set.
 */
export function GameEmblem({ kind, size = DEFAULT_SIZE }: GameEmblemProps): React.JSX.Element {
  const accent = accentColorForKind(kind);
  const plate = tint(accent, 0.16);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel={`${kind} emblem`}>
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect x={0} y={0} width={size} height={size} r={size * 0.28} color={plate} />
        {renderMark(kind, size, accent, plate)}
      </Canvas>
    </View>
  );
}

function renderMark(kind: GameKind, size: number, accent: string, plate: string): React.JSX.Element {
  switch (kind) {
    case 'towers':
      return <TowersMark size={size} accent={accent} plate={plate} />;
    case 'binairo':
      return <BinairoMark size={size} accent={accent} plate={plate} />;
    case 'mirror':
      return <MirrorMark size={size} accent={accent} plate={plate} />;
    case 'tents':
      return <TentsMark size={size} accent={accent} plate={plate} />;
    case 'gravity':
      return <GravityMark size={size} accent={accent} plate={plate} />;
  }
}

interface MarkProps {
  readonly size: number;
  readonly accent: string;
  /** The plate behind the mark. Detail is *knocked out* in this colour
   * rather than drawn in a second ink, which is what lets the emblems
   * carry real detail and still read as one flat colour each. */
  readonly plate: string;
}

/**
 * A skyline of four towers with lit windows - the thing the clues ask you
 * to count, now with enough detail to read as buildings rather than a bar
 * chart. Windows are knocked out of the tower rather than drawn over it,
 * so the mark stays one colour on its plate.
 */
function TowersMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const baseline = size * 0.78;
  const bars = [
    { w: 0.11, h: 0.22, floors: 1 },
    { w: 0.13, h: 0.38, floors: 2 },
    { w: 0.11, h: 0.30, floors: 2 },
    { w: 0.14, h: 0.50, floors: 3 },
  ];
  const gap = size * 0.035;
  const totalWidth = bars.reduce((sum, b) => sum + b.w * size, 0) + gap * (bars.length - 1);
  let x = (size - totalWidth) / 2;

  const shapes: React.JSX.Element[] = [];
  bars.forEach((bar, i) => {
    const w = bar.w * size;
    const h = bar.h * size;
    const top = baseline - h;
    shapes.push(
      <RoundedRect key={`t-${i}`} x={x} y={top} width={w} height={h} r={size * 0.02} color={accent} />,
    );
    // Windows: one small notch per floor, in the plate colour.
    for (let f = 0; f < bar.floors; f += 1) {
      shapes.push(
        <Rect
          key={`w-${i}-${f}`}
          x={x + w * 0.28}
          y={top + h * 0.16 + f * (h * 0.3)}
          width={w * 0.44}
          height={size * 0.035}
          color={plate}
        />,
      );
    }
    x += w + gap;
  });

  return (
    <Group>
      {shapes}
      <Rect x={size * 0.16} y={baseline} width={size * 0.68} height={size * 0.035} color={accent} />
    </Group>
  );
}

/**
 * A 2x2 fragment of a real Binairo board: circles and squares alternating
 * the way the no-three-in-a-row rule forces them to, ruled by the board's
 * own faint seams. More informative than two loose marks - this is what
 * the game actually looks like.
 */
function BinairoMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const cell = size * 0.26;
  const gap = size * 0.03;
  const span = cell * 2 + gap;
  const originX = (size - span) / 2;
  const originY = (size - span) / 2;
  // Circle, square / square, circle - a legal arrangement, not a random one.
  const isCircle = [true, false, false, true];

  return (
    <Group>
      {[0, 1, 2, 3].map(i => {
        const r = Math.floor(i / 2);
        const c = i % 2;
        const x = originX + c * (cell + gap);
        const y = originY + r * (cell + gap);
        return (
          <Group key={`cell-${i}`}>
            <RoundedRect x={x} y={y} width={cell} height={cell} r={cell * 0.22} color={plate} />
            {isCircle[i] ? (
              <Circle cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.3} color={accent} />
            ) : (
              <RoundedRect
                x={x + cell * 0.22}
                y={y + cell * 0.22}
                width={cell * 0.56}
                height={cell * 0.56}
                r={cell * 0.12}
                color={accent}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

/**
 * A beam entering, turning off two mirrors and striking a gem - a whole
 * solved route in miniature, rather than a single corner. The mirrors keep
 * their lighter weight so the beam itself stays the subject.
 */
function MirrorMark({ size, accent }: MarkProps): React.JSX.Element {
  const stroke = Math.max(2, size * 0.07);
  const a = size * 0.2;
  const b = size * 0.5;
  const c = size * 0.8;

  return (
    <Group>
      <Path
        path={`M ${a} ${a} L ${b} ${a} L ${b} ${b} L ${c} ${b}`}
        color={accent}
        style="stroke"
        strokeWidth={stroke}
        strokeCap="round"
        strokeJoin="round"
      />
      {/* The two mirrors the beam turns on, struck across each corner. */}
      <Path
        path={`M ${b - size * 0.1} ${a - size * 0.1} L ${b + size * 0.1} ${a + size * 0.1}`}
        color={accent}
        style="stroke"
        strokeWidth={stroke * 0.7}
        strokeCap="round"
        opacity={0.5}
      />
      <Path
        path={`M ${b - size * 0.1} ${b + size * 0.1} L ${b + size * 0.1} ${b - size * 0.1}`}
        color={accent}
        style="stroke"
        strokeWidth={stroke * 0.7}
        strokeCap="round"
        opacity={0.5}
      />
      {/* The gem the beam ends on. */}
      <Path
        path={`M ${c} ${b - size * 0.09} L ${c + size * 0.09} ${b} L ${c} ${b + size * 0.09} L ${c - size * 0.09} ${b} Z`}
        color={accent}
      />
    </Group>
  );
}

/**
 * Two trees and the tent pitched between them, on a ground line - the
 * game's actual subject rather than one of each. The tents-never-touch
 * rule is why the tent sits off-centre, with room either side.
 */
function TentsMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const baseline = size * 0.76;
  const trunkWidth = Math.max(2, size * 0.05);

  const tree = (cx: number, key: string, canopy: number): React.JSX.Element => (
    <Group key={key}>
      <Circle cx={cx} cy={baseline - canopy - size * 0.1} r={canopy} color={accent} />
      <RoundedRect
        x={cx - trunkWidth / 2}
        y={baseline - canopy - size * 0.02}
        width={trunkWidth}
        height={canopy + size * 0.02}
        r={trunkWidth / 2}
        color={accent}
      />
    </Group>
  );

  const tentCx = size * 0.5;
  const tentHalf = size * 0.13;

  return (
    <Group>
      {tree(size * 0.22, 'tree-l', size * 0.1)}
      {tree(size * 0.78, 'tree-r', size * 0.085)}
      <Path
        path={`M ${tentCx} ${size * 0.42} L ${tentCx + tentHalf} ${baseline} L ${tentCx - tentHalf} ${baseline} Z`}
        color={accent}
      />
      {/* The tent's own doorway, knocked out so the mark stays one colour. */}
      <Path
        path={`M ${tentCx} ${size * 0.58} L ${tentCx + tentHalf * 0.4} ${baseline} L ${tentCx - tentHalf * 0.4} ${baseline} Z`}
        color={plate}
      />
      <Rect x={size * 0.12} y={baseline} width={size * 0.76} height={size * 0.035} color={accent} />
    </Group>
  );
}

/**
 * A piece falling to its target ring, with the fall itself shown - two
 * fading ghosts above it. Gravity is the one game whose subject is motion,
 * so its emblem is the only one that depicts movement.
 */
function GravityMark({ size, accent }: MarkProps): React.JSX.Element {
  const cx = size / 2;
  const pieceR = size * 0.1;
  const ringR = size * 0.15;
  const ringStroke = Math.max(2, size * 0.055);

  return (
    <Group>
      {/* The trail it fell along - same disc, thinning as it recedes. */}
      <Circle cx={cx} cy={size * 0.17} r={pieceR * 0.5} color={accent} opacity={0.25} />
      <Circle cx={cx} cy={size * 0.3} r={pieceR * 0.72} color={accent} opacity={0.5} />
      <Circle cx={cx} cy={size * 0.45} r={pieceR} color={accent} />
      <Circle cx={cx} cy={size * 0.72} r={ringR} color={accent} style="stroke" strokeWidth={ringStroke} />
    </Group>
  );
}

export interface FinishedGamesRowProps {
  /** Every game in the set just finished, in the order it was played. */
  readonly kinds: ReadonlyArray<GameKind>;
  readonly size?: number;
  /** Delay before the first emblem lands, so the row can be sequenced
   * after whatever text introduces it. */
  readonly delayMs?: number;
}

const ROW_STAGGER_MS = 90;

/**
 * The set of games a completed level was made of, revealed one emblem at a
 * time.
 *
 * A level here is a *combination* of games (see `batches.ts`), which until
 * now the player only ever saw as a line of coloured dots while playing.
 * At the moment the set is finished that composition is worth actually
 * showing: these are the five games, and this is which of them you just
 * got through. Staggered rather than appearing at once, so it reads as a
 * tally being counted out.
 */
export function FinishedGamesRow({ kinds, size = 44, delayMs = 0 }: FinishedGamesRowProps): React.JSX.Element {
  const pops = React.useRef(kinds.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(delayMs),
      Animated.stagger(
        ROW_STAGGER_MS,
        pops.map(value => Animated.spring(value, { toValue: 1, useNativeDriver: true, ...motion.spring.pop })),
      ),
    ]).start();
    // Mount-only: this row is mounted exactly when a set is completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      {kinds.map((kind, i) => (
        <Animated.View
          key={`${kind}-${i}`}
          style={{
            opacity: pops[i],
            transform: [
              { scale: pops[i] },
              { translateY: pops[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
          }}
        >
          <GameEmblem kind={kind} size={size} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
});

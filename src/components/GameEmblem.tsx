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
 * tree, Gravity is a piece falling to its target ring, Arukone+ is two
 * paths folded around a centre line. A player who has played the game
 * should recognise its emblem without being told.
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
    case 'arukone':
      return <ArukoneMark size={size} accent={accent} plate={plate} />;
    case 'fillapix':
      return <FillaPixMark size={size} accent={accent} plate={plate} />;
    case 'lightsout':
      return <LightsOutMark size={size} accent={accent} plate={plate} />;
    case 'adjacent':
      return <AdjacentMark size={size} accent={accent} plate={plate} />;
    case 'bloom':
      return <BloomMark size={size} accent={accent} plate={plate} />;
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

/**
 * Two paths folded about the board's own centre line, each running from
 * one number to another around a blocked square - the whole game in one
 * mark. The right-hand path is drawn as the exact mirror of the left, so
 * the emblem is doing the thing it depicts.
 *
 * The numbers are rings rather than discs (a knocked-out centre, like the
 * other marks' detail) - a solid dot at this size reads as a bullet, and
 * these want to read as *terminals*, something a line arrives at.
 */
function ArukoneMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const fold = size / 2;
  const stroke = Math.max(2, size * 0.075);
  const nodeR = size * 0.072;
  const top = size * 0.26;
  const bottom = size * 0.7;
  const outer = size * 0.22;
  const inner = size * 0.365;
  const blockSize = size * 0.15;

  // The right-hand path is literally `2 * fold - x` of the left - the same
  // reflection `mirrorCell` applies to the real board.
  const arm = (x0: number, x1: number): string =>
    `M ${x0} ${top} L ${x1} ${top} L ${x1} ${bottom} L ${x0} ${bottom}`;

  return (
    <Group>
      {/* The fold the board is symmetric about. */}
      <Path
        path={`M ${fold} ${size * 0.13} L ${fold} ${size * 0.87}`}
        color={accent}
        opacity={0.28}
        style="stroke"
        strokeWidth={Math.max(1, size * 0.02)}
      />
      {[arm(outer, inner), arm(size - outer, size - inner)].map((path, i) => (
        <Path
          key={`arm-${i}`}
          path={path}
          color={accent}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}
      {/* The blocked square both paths had to route around. */}
      <RoundedRect
        x={fold - blockSize / 2}
        y={size * 0.48 - blockSize / 2}
        width={blockSize}
        height={blockSize}
        r={size * 0.025}
        color={accent}
      />
      {[top, bottom].flatMap(y =>
        [outer, size - outer].map(x => (
          <Group key={`node-${x}-${y}`}>
            <Circle cx={x} cy={y} r={nodeR} color={accent} />
            <Circle cx={x} cy={y} r={nodeR * 0.42} color={plate} />
          </Group>
        )),
      )}
    </Group>
  );
}

/**
 * A tiny 3x3 mosaic - a small plus of filled tiles among empty ones, the
 * same "picture made of squares" the real board asks a player to build,
 * shrunk to the smallest shape that still reads as a picture rather than
 * a random scatter.
 */
function FillaPixMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const cell = size * 0.2;
  const gap = size * 0.025;
  const span = cell * 3 + gap * 2;
  const originX = (size - span) / 2;
  const originY = (size - span) / 2;
  const filled = new Set([1, 3, 4, 5, 7]); // a plus, indices 0..8 row-major

  return (
    <Group>
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        const x = originX + c * (cell + gap);
        const y = originY + r * (cell + gap);
        return <RoundedRect key={`cell-${i}`} x={x} y={y} width={cell} height={cell} r={cell * 0.22} color={filled.has(i) ? accent : plate} />;
      })}
    </Group>
  );
}

/**
 * The cross a single press lights up: five lamps lit in a plus, the four
 * diagonals left dark. That shape *is* the game's one rule, which is what
 * earns it the emblem.
 *
 * Deliberately round lamps with a halo, where `FillaPixMark` next door is
 * square tiles - both marks are a plus in a 3x3, and shape is what keeps
 * them from reading as the same emblem at card size.
 */
function LightsOutMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const step = size * 0.235;
  const centre = size / 2;
  const lampR = size * 0.085;
  const isLit = (r: number, c: number): boolean => Math.abs(r - 1) + Math.abs(c - 1) <= 1;

  return (
    <Group>
      {[0, 1, 2].map(r =>
        [0, 1, 2].map(c => {
          const cx = centre + (c - 1) * step;
          const cy = centre + (r - 1) * step;
          if (!isLit(r, c)) {
            return <Circle key={`off-${r}-${c}`} cx={cx} cy={cy} r={lampR * 0.72} color={plate} />;
          }
          return (
            <Group key={`on-${r}-${c}`}>
              <Circle cx={cx} cy={cy} r={lampR * 1.75} color={accent} opacity={0.22} />
              <Circle cx={cx} cy={cy} r={lampR} color={accent} />
            </Group>
          );
        }),
      )}
    </Group>
  );
}

/**
 * A connected run of four tiles picked out of a tray of nine - the exact
 * thing a tap does, which is the whole game.
 *
 * The run is solid and its neighbours are the same colour held right
 * back, rather than a second hue: Adjacent's board is the one place in
 * this app that genuinely uses five colours at once, and an emblem that
 * tried to say so would be the cluttered outlier in a row of flat
 * single-colour marks. What distinguishes this game is not *that* it has
 * colours, it is that touching ones go together - and that reads in one
 * ink.
 */
function AdjacentMark({ size, accent }: MarkProps): React.JSX.Element {
  const cell = size * 0.2;
  const gap = size * 0.035;
  const span = cell * 3 + gap * 2;
  const originX = (size - span) / 2;
  const originY = (size - span) / 2;
  // An L, so the run reads as *connected* rather than as a row or a
  // block - a straight line of three could be a coincidence, a corner
  // could not.
  const run = new Set([0, 3, 4, 7]); // indices 0..8, row-major

  return (
    <Group>
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        return (
          <RoundedRect
            key={`tile-${i}`}
            x={originX + c * (cell + gap)}
            y={originY + r * (cell + gap)}
            width={cell}
            height={cell}
            r={cell * 0.24}
            color={accent}
            opacity={run.has(i) ? 1 : 0.26}
          />
        );
      })}
    </Group>
  );
}

/** A quatrefoil - four overlapping discs - which is what the smallest
 * closed loop on a Bloom board fills in as: four quarter arcs, lobed. The
 * plate-coloured eye in the middle keeps it a flower rather than a blob
 * at 26 points. */
function BloomMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const c = size / 2;
  const offset = size * 0.12;
  const petal = size * 0.15;
  return (
    <Group>
      {[
        [0, -offset],
        [offset, 0],
        [0, offset],
        [-offset, 0],
      ].map(([dx, dy], i) => (
        <Circle key={`petal-${i}`} cx={c + dx} cy={c + dy} r={petal} color={accent} />
      ))}
      <Circle cx={c} cy={c} r={size * 0.055} color={plate} />
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
 * showing: these are the games, and this is which of them you just got
 * through. Staggered rather than appearing at once, so it reads as a
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

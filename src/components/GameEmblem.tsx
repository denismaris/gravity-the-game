import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { accentColorForKind, GameKind } from '../game/journey';
import { hexToRgb, shade } from '../game/rendering';
import { motion, theme, themedStyles } from '../theme';

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
export function tint(hex: string, alpha: number): string {
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

/**
 * The same emblem as Skia content, placed at (`x`, `y`) inside a canvas
 * that already exists - for a surface that draws many emblems at once,
 * which should be one canvas rather than one per emblem.
 */
export function GameEmblemGlyph({ kind, size, x = 0, y = 0, opacity = 1 }: { kind: GameKind; size: number; x?: number; y?: number; opacity?: number }): React.JSX.Element {
  const accent = accentColorForKind(kind);
  const plate = tint(accent, 0.16);
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
      <RoundedRect x={0} y={0} width={size} height={size} r={size * 0.28} color={plate} />
      {renderMark(kind, size, accent, plate)}
    </Group>
  );
}

function renderMark(kind: GameKind, size: number, accent: string, plate: string): React.JSX.Element {
  switch (kind) {
    case 'vanes':
      return <VanesMark size={size} accent={accent} plate={plate} />;
    case 'binairo':
      return <BinairoMark size={size} accent={accent} plate={plate} />;
    case 'mirror':
      return <MirrorMark size={size} accent={accent} plate={plate} />;
    case 'lilypads':
      return <LilyMark size={size} accent={accent} plate={plate} />;
    case 'gravity':
      return <GravityMark size={size} accent={accent} plate={plate} />;
    case 'arukone':
      return <ArukoneMark size={size} accent={accent} plate={plate} />;
    case 'glass':
      return <GlassMark size={size} accent={accent} plate={plate} />;
    case 'lightsout':
      return <LightsOutMark size={size} accent={accent} plate={plate} />;
    case 'adjacent':
      return <AdjacentMark size={size} accent={accent} plate={plate} />;
    case 'bloom':
      return <BloomMark size={size} accent={accent} plate={plate} />;
    case 'mosaic':
      return <MosaicMark size={size} accent={accent} plate={plate} />;
    case 'bridges':
      return <BridgesMark size={size} accent={accent} plate={plate} />;
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
 * A lily pad seen from above - its notch, its veins knocked out of it -
 * on a ripple of water, with a lotus in flower at its edge: the pond, and
 * the one pad that asks to be visited twice. In the pond's own colours,
 * as Mosaic's emblem wears its glazes.
 */
function LilyMark({ size, plate }: MarkProps): React.JSX.Element {
  const c = size * 0.46;
  const cy = size * 0.54;
  const r = size * 0.28;
  const turn = -Math.PI / 4;
  const a1 = turn - 0.32;
  const a2 = turn + 0.32;
  const leaf = (y: number) => `M ${c + Math.cos(turn) * r * 0.08} ${y + Math.sin(turn) * r * 0.08} L ${c + Math.cos(a1) * r} ${y + Math.sin(a1) * r} A ${r} ${r} 0 1 0 ${c + Math.cos(a2) * r} ${y + Math.sin(a2) * r} Z`;
  const pad = theme.colors.lilyPad;
  const bloom = theme.colors.lilyBloom;
  const lx = size * 0.68;
  const ly = size * 0.34;
  const petal = (a: number, len: number, w: number) => {
    const l = { x: lx + Math.cos(a - 1.57) * w, y: ly + Math.sin(a - 1.57) * w };
    const rr = { x: lx + Math.cos(a + 1.57) * w, y: ly + Math.sin(a + 1.57) * w };
    const tip = { x: lx + Math.cos(a) * len, y: ly + Math.sin(a) * len };
    return `M ${l.x} ${l.y} Q ${l.x + Math.cos(a) * len * 0.85} ${l.y + Math.sin(a) * len * 0.85} ${tip.x} ${tip.y} Q ${rr.x + Math.cos(a) * len * 0.85} ${rr.y + Math.sin(a) * len * 0.85} ${rr.x} ${rr.y} Z`;
  };
  return (
    <Group>
      {/* The water: two ripples under the pad. */}
      {[0.16, 0.3].map((k, i) => (
        <Path
          key={i}
          path={`M ${size * (0.16 + k * 0.6)} ${size * (0.86 - i * 0.02)} q ${size * 0.06} ${-size * 0.035} ${size * 0.12} 0 q ${size * 0.06} ${size * 0.035} ${size * 0.12} 0`}
          color={pad}
          style="stroke"
          strokeWidth={Math.max(1.2, size * 0.03)}
          strokeCap="round"
          opacity={0.45}
        />
      ))}
      <Path path={leaf(cy + size * 0.035)} color={shade(pad, 0.7)} />
      <Path path={leaf(cy)} color={pad} />
      {[-1.3, -0.6, 0.6, 1.3, Math.PI].map(a => (
        <Path key={a} path={`M ${c} ${cy} L ${c + Math.cos(turn + a) * r * 0.72} ${cy + Math.sin(turn + a) * r * 0.72}`} color={plate} style="stroke" strokeWidth={Math.max(1, size * 0.022)} strokeCap="round" opacity={0.9} />
      ))}
      {Array.from({ length: 6 }, (_v, i) => (
        <Path key={`p${i}`} path={petal((i / 6) * Math.PI * 2 - Math.PI / 2, size * 0.15, size * 0.045)} color={bloom} />
      ))}
      {Array.from({ length: 5 }, (_v, i) => (
        <Path key={`q${i}`} path={petal((i / 5) * Math.PI * 2 - Math.PI / 2 + 0.3, size * 0.09, size * 0.03)} color="#FFFFFF" opacity={0.85} />
      ))}
      <Circle cx={lx} cy={ly} r={size * 0.03} color="#F6D46A" />
    </Group>
  );
}

/**
 * The game, solved, in the smallest roof that shows it: four vanes at the
 * corners of a square, each sending its wind to the next, so the wind
 * runs round in one closed loop. Rings for the vanes and strokes for the
 * wind, in one colour - the same hand as Twinpath's emblem.
 */
function VanesMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const lo = size * 0.25;
  const hi = size * 0.75;
  const corners = [
    { x: lo, y: lo },
    { x: hi, y: lo },
    { x: hi, y: hi },
    { x: lo, y: hi },
  ];
  const stroke = Math.max(2, size * 0.065);
  const nodeR = size * 0.085;
  const gap = nodeR + size * 0.06; // wind stops short of each vane
  const head = size * 0.075;
  return (
    <Group>
      {corners.map((a, i) => {
        const b = corners[(i + 1) % 4];
        const dx = Math.sign(b.x - a.x);
        const dy = Math.sign(b.y - a.y);
        const sx = a.x + dx * gap;
        const sy = a.y + dy * gap;
        const ex = b.x - dx * gap;
        const ey = b.y - dy * gap;
        // The arrowhead's two barbs, swept back from the tip.
        const barbs = `M ${ex - dx * head - dy * head} ${ey - dy * head + dx * head} L ${ex} ${ey} L ${ex - dx * head + dy * head} ${ey - dy * head - dx * head}`;
        return (
          <Group key={i}>
            <Path path={`M ${sx} ${sy} L ${ex} ${ey}`} color={accent} style="stroke" strokeWidth={stroke} strokeCap="round" />
            <Path path={barbs} color={accent} style="stroke" strokeWidth={stroke} strokeCap="round" strokeJoin="round" />
          </Group>
        );
      })}
      {corners.map((c, i) => (
        <Group key={`v${i}`}>
          <Circle cx={c.x} cy={c.y} r={nodeR} color={accent} />
          <Circle cx={c.x} cy={c.y} r={nodeR * 0.42} color={plate} />
        </Group>
      ))}
    </Group>
  );
}

/**
 * A small arched window of real glass - ruby, cobalt and amber, with the
 * lead between the panes knocked out to the plate - coloured so that no
 * two panes sharing lead match: the game's one rule, as a window. In the
 * glass's own colours, as Mosaic's emblem wears its glazes.
 */
function GlassMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const left = size * 0.24;
  const right = size * 0.76;
  const top = size * 0.14;
  const bottom = size * 0.86;
  const w = right - left;
  const spring = top + w / 2; // where the arch meets the sides
  const mid = (left + right) / 2;
  const row = spring + (bottom - spring) * 0.48;
  const lead = Math.max(1.4, size * 0.035);
  const window = `M ${left} ${bottom} L ${left} ${spring} A ${w / 2} ${w / 2} 0 0 1 ${right} ${spring} L ${right} ${bottom} Z`;
  const ruby = theme.colors.glassRuby;
  const cobalt = theme.colors.glassCobalt;
  const amber = theme.colors.glassAmber;
  return (
    <Group>
      {/* The panes: the arch, two above the transom and two below. */}
      <Group clip={window}>
        <RoundedRect x={left} y={top} width={w} height={spring - top + size * 0.02} r={0} color={amber} />
        <RoundedRect x={left} y={spring} width={w / 2} height={row - spring} r={0} color={ruby} />
        <RoundedRect x={mid} y={spring} width={w / 2} height={row - spring} r={0} color={cobalt} />
        <RoundedRect x={left} y={row} width={w / 2} height={bottom - row} r={0} color={cobalt} />
        <RoundedRect x={mid} y={row} width={w / 2} height={bottom - row} r={0} color={amber} />
        {/* The glint of glass: one lighter stripe across the window. */}
        <Path path={`M ${left - size * 0.1} ${size * 0.62} L ${left + size * 0.02} ${size * 0.62} L ${right + size * 0.02} ${size * 0.1} L ${right - size * 0.1} ${size * 0.1} Z`} color="#FFFFFF" opacity={0.2} />
      </Group>
      {/* The lead, knocked out to the plate. */}
      <Path path={`M ${left} ${spring} L ${right} ${spring} M ${left} ${row} L ${right} ${row} M ${mid} ${spring} L ${mid} ${bottom}`} color={plate} style="stroke" strokeWidth={lead} />
      <Path path={window} color={accent} style="stroke" strokeWidth={lead * 1.1} strokeJoin="round" />
    </Group>
  );
}

/**
 * The cross a single press lights up: five lamps lit in a plus, the four
 * diagonals left dark. That shape *is* the game's one rule, which is what
 * earns it the emblem.
 *
 * Deliberately round lamps with a halo, so the plus reads as lights
 * rather than as tiles at card size.
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

/**
 * Three islands and the bridges between them: a double across the top, a
 * single down the side - the two things a Bridges board is made of. The
 * islands are rings, so the plate shows through them like the open water
 * on the board, and the bridges stop at each rim rather than running into
 * a blot.
 */
function BridgesMark({ size, accent }: MarkProps): React.JSX.Element {
  const r = size * 0.12;
  const stroke = size * 0.05;
  const left = size * 0.28;
  const right = size * 0.72;
  const top = size * 0.3;
  const bottom = size * 0.72;
  const plank = size * 0.055;
  const gap = size * 0.05;
  return (
    <Group>
      <RoundedRect x={left + r} y={top - gap - plank / 2} width={right - left - 2 * r} height={plank} r={plank / 2} color={accent} />
      <RoundedRect x={left + r} y={top + gap - plank / 2} width={right - left - 2 * r} height={plank} r={plank / 2} color={accent} />
      <RoundedRect x={right - plank / 2} y={top + r} width={plank} height={bottom - top - 2 * r} r={plank / 2} color={accent} />
      {[
        [left, top],
        [right, top],
        [right, bottom],
      ].map(([x, y], i) => (
        <Circle key={`isle-${i}`} cx={x} cy={y} r={r - stroke / 2} color={accent} style="stroke" strokeWidth={stroke} />
      ))}
    </Group>
  );
}

/**
 * Mosaic's mark: nine tesserae set as a diamond, each in its own glaze
 * around an ochre heart - the one multi-coloured emblem in the set, which
 * is right for the one game whose subject *is* colour and pieces. Grout
 * gaps between the tiles, so it reads as a mosaic and not a checkerboard,
 * even at 26 points.
 */
const MOSAIC_MARK_GLAZES: ReadonlyArray<string> = [
  '#C8506A', '#2F5DAF', '#C46C33',
  '#2F5DAF', '#D9A441', '#6B4489',
  '#C46C33', '#6B4489', '#C8506A',
];

function MosaicMark({ size }: MarkProps): React.JSX.Element {
  const c = size / 2;
  const tile = size * 0.13;
  const pitch = tile * 1.24;
  return (
    <Group origin={vec(c, c)} transform={[{ rotate: Math.PI / 4 }]}>
      {MOSAIC_MARK_GLAZES.map((glaze, i) => {
        const r = Math.floor(i / 3) - 1;
        const col = (i % 3) - 1;
        return (
          <RoundedRect
            key={`t-${i}`}
            x={c + col * pitch - tile / 2}
            y={c + r * pitch - tile / 2}
            width={tile}
            height={tile}
            r={tile * 0.22}
            color={glaze}
          />
        );
      })}
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

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
}));

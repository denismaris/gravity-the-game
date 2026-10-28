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
  /** Stands the plate on a darker lip, like the cards it sits on - for an
   * emblem that is a button, or the thing a card is about. The plate is
   * made opaque (its tint over the card's surface) so the lip never shows
   * through it. Adds the lip's height below `size`. */
  readonly raised?: boolean;
}

const DEFAULT_SIZE = 64;

/** The lip under a raised emblem, as a share of its size. */
export function emblemLip(size: number): number {
  return Math.max(2, Math.round(size * 0.075));
}

/** `a` moved `t` of the way to `b`, both `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const ch = (u: number, v: number) => Math.round(u + (v - u) * t).toString(16).padStart(2, '0');
  return `#${ch(x.r, y.r)}${ch(x.g, y.g)}${ch(x.b, y.b)}`;
}

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
export function GameEmblem({ kind, size = DEFAULT_SIZE, raised = false }: GameEmblemProps): React.JSX.Element {
  const accent = accentColorForKind(kind);
  const plate = raised ? mix(theme.colors.surface, accent, 0.16) : tint(accent, 0.16);
  const lip = raised ? emblemLip(size) : 0;
  return (
    <View style={{ width: size, height: size + lip }} accessibilityRole="image" accessibilityLabel={`${kind} emblem`}>
      <Canvas style={StyleSheet.absoluteFill}>
        {raised && <RoundedRect x={0} y={lip} width={size} height={size} r={size * 0.28} color={mix(theme.colors.surface, accent, 0.42)} />}
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
export function GameEmblemGlyph({ kind, size, x = 0, y = 0, opacity = 1, raised = false }: { kind: GameKind; size: number; x?: number; y?: number; opacity?: number; raised?: boolean }): React.JSX.Element {
  const accent = accentColorForKind(kind);
  // The same plate and lip as `GameEmblem`, so a row drawn in one canvas
  // (several emblems, one surface) looks exactly like separate ones.
  const plate = raised ? mix(theme.colors.surface, accent, 0.16) : tint(accent, 0.16);
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]} opacity={opacity}>
      {raised && <RoundedRect x={0} y={emblemLip(size)} width={size} height={size} r={size * 0.28} color={mix(theme.colors.surface, accent, 0.42)} />}
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

  // The drawing spans 0.1-0.59 of the height: centred on the plate.
  return (
    <Group transform={[{ translateY: size * 0.155 }]}>
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
 * Twins across a fold: two pairs of beads above a dashed fold and their
 * twins below, each pair joined by one path that is its own reflection -
 * down, in toward the middle, and out again, mirrored in the fold, the way
 * every pair on the board meets its twin. The two pairs in two tones of
 * the game's wine, as its numbered beads are.
 */
function ArukoneMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const fold = size / 2;
  const stroke = Math.max(2, size * 0.07);
  const bead = size * 0.095;
  const top = size * 0.2;
  const bottom = size - top;
  const light = shade(accent, 1.45);
  // A path from (x, top) to (x, bottom), jogging to `jog` across the fold
  // and back: symmetric about the fold by construction.
  const path = (x: number, jog: number): string => {
    const y1 = size * 0.36;
    const y2 = size - y1;
    const r = size * 0.07;
    const dir = Math.sign(jog - x);
    return `M ${x} ${top} L ${x} ${y1 - r} Q ${x} ${y1} ${x + dir * r} ${y1} L ${jog - dir * r} ${y1} Q ${jog} ${y1} ${jog} ${y1 + r} L ${jog} ${y2 - r} Q ${jog} ${y2} ${jog - dir * r} ${y2} L ${x + dir * r} ${y2} Q ${x} ${y2} ${x} ${y2 + r} L ${x} ${bottom}`;
  };
  // The pairs jog toward each other and back: two twins, meeting.
  const pairs = [
    { x: size * 0.24, jog: size * 0.42, color: accent },
    { x: size * 0.76, jog: size * 0.58, color: light },
  ];
  return (
    <Group>
      {/* The fold the board is mirrored in. */}
      {[0, 1, 2, 3, 4, 5].map(k => (
        <RoundedRect key={`f${k}`} x={size * (0.12 + k * 0.135)} y={fold - size * 0.012} width={size * 0.07} height={size * 0.024} r={size * 0.012} color={accent} opacity={0.32} />
      ))}
      {pairs.map((p, i) => (
        <Path key={`p${i}`} path={path(p.x, p.jog)} color={p.color} style="stroke" strokeWidth={stroke} strokeCap="round" strokeJoin="round" />
      ))}
      {pairs.flatMap((p, i) =>
        [top, bottom].map(y => (
          <Group key={`b${i}-${y}`}>
            <Circle cx={p.x} cy={y} r={bead} color={p.color} />
            <Circle cx={p.x} cy={y} r={bead * 0.38} color={plate} />
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
 * A weathervane, the one on every barn roof: an arrow with a swallow-tail
 * feather riding the top of a post, and the compass's cross-arms below it,
 * a ball at each end. The silhouette a child knows at a glance, in the
 * game's copper.
 */
function VanesMark({ size, accent, plate }: MarkProps): React.JSX.Element {
  const u = (v: number) => v * size;
  const stroke = Math.max(2, size * 0.07);
  const arrowY = u(0.33);
  const armY = u(0.62);
  const tip = u(0.88);
  const headBase = u(0.68);
  const spread = u(0.11);
  // The swallow-tail: a feather with a notch cut into its back.
  const tail = `M ${u(0.12)} ${arrowY - u(0.11)} L ${u(0.3)} ${arrowY - u(0.11)} L ${u(0.37)} ${arrowY} L ${u(0.3)} ${arrowY + u(0.11)} L ${u(0.12)} ${arrowY + u(0.11)} L ${u(0.19)} ${arrowY} Z`;
  return (
    <Group>
      {/* The post, and the compass arms across it. */}
      <Path path={`M ${u(0.5)} ${arrowY} L ${u(0.5)} ${u(0.88)}`} color={accent} style="stroke" strokeWidth={stroke} strokeCap="round" />
      <Path path={`M ${u(0.27)} ${armY} L ${u(0.73)} ${armY}`} color={accent} style="stroke" strokeWidth={stroke * 0.7} strokeCap="round" />
      <Circle cx={u(0.25)} cy={armY} r={u(0.05)} color={accent} />
      <Circle cx={u(0.75)} cy={armY} r={u(0.05)} color={accent} />
      {/* The arrow riding the top. */}
      <Path path={`M ${u(0.3)} ${arrowY} L ${headBase + u(0.02)} ${arrowY}`} color={accent} style="stroke" strokeWidth={stroke} strokeCap="round" />
      <Path path={tail} color={accent} />
      <Path path={`M ${tip} ${arrowY} L ${headBase} ${arrowY - spread} L ${headBase} ${arrowY + spread} Z`} color={accent} />
      {/* The ball it turns on. */}
      <Circle cx={u(0.5)} cy={arrowY} r={u(0.065)} color={accent} />
      <Circle cx={u(0.5)} cy={arrowY} r={u(0.025)} color={plate} />
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

/* eslint-disable react-native/no-inline-styles -- the previews are sized and coloured from the item at render time */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { Cosmetic } from '../progression';
import { theme, themedStyles, inkWash } from '../theme';
import { blossomPath, leafPath } from './AlmanacBackdrop';
import { SkinPreview } from './SkinPreview';

/** A still of a confetti burst in the item's colours. */
function ConfettiSwatch({ colors, size }: { colors: ReadonlyArray<string>; size: number }): React.JSX.Element {
  const c = size / 2;
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_v, i) => {
        const a = (i / 16) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
        const d = size * (0.18 + ((i * 37) % 23) / 100);
        return { x: c + Math.cos(a) * d, y: c + Math.sin(a) * d, r: size * (0.035 + ((i * 13) % 5) / 200), color: colors[i % colors.length], square: i % 3 === 0 };
      }),
    [c, colors, size],
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      {pieces.map((p, i) =>
        p.square ? <Rect key={i} x={p.x - p.r} y={p.y - p.r} width={p.r * 2} height={p.r * 2} color={p.color} /> : <Circle key={i} cx={p.x} cy={p.y} r={p.r} color={p.color} />,
      )}
    </Canvas>
  );
}

/** The break's marble in the item's colours: [rim, body, core, band]. */
export function MarblePreview({ colors, size }: { colors: ReadonlyArray<string>; size: number }): React.JSX.Element {
  const r = size / 2;
  const circle = (d: number) => ({ width: d, height: d, borderRadius: d / 2 });
  return (
    <View style={{ width: size, height: size * 1.12 }}>
      <View style={[styles.abs, circle(size), { top: size * 0.12, backgroundColor: inkWash(0.18), transform: [{ scaleY: 0.45 }], left: size * 0.04 }]} />
      <View style={[circle(size), styles.clip, { backgroundColor: colors[3] }]}>
        <View style={[styles.abs, circle(size), { left: -r * 0.08, top: -r * 0.08, backgroundColor: colors[0] }]} />
        <View style={[styles.abs, circle(size * 0.84), { left: r * 0.02, top: 0, backgroundColor: colors[1] }]} />
        <View style={[styles.abs, circle(size * 0.5), { left: r * 0.22, top: r * 0.18, backgroundColor: colors[2] }]} />
        <View style={[styles.abs, { left: r - r * 0.13, top: 0, width: r * 0.26, height: size, backgroundColor: colors[3], opacity: 0.5 }]} />
      </View>
      <View style={[styles.abs, { width: r * 0.66, height: r * 0.4, borderRadius: r * 0.2, left: r * 0.34, top: r * 0.36, backgroundColor: 'rgba(255,255,255,0.5)', transform: [{ rotate: '-32deg' }] }]} />
      <View style={[styles.abs, circle(r * 0.2), { left: r * 0.5, top: r * 0.46, backgroundColor: 'rgba(255,255,255,0.95)' }]} />
    </View>
  );
}

/** A corner of a Bridges chart in the item's colours: [water, contour,
 * dot, neatline]. */
function ChartSwatch({ colors, size }: { colors: ReadonlyArray<string>; size: number }): React.JSX.Element {
  const island = 'M -1 0 C -1 -0.6 -0.5 -1 0.1 -0.95 C 0.7 -0.9 1.05 -0.45 0.98 0.1 C 0.9 0.7 0.4 1 -0.15 0.96 C -0.7 0.92 -1 0.5 -1 0 Z';
  const b = size * 0.07;
  return (
    <Canvas style={{ width: size, height: size }}>
      <RoundedRect x={0} y={0} width={size} height={size} r={size * 0.1} color={colors[4] ?? theme.colors.surfaceHi} />
      <Rect x={b} y={b} width={size - 2 * b} height={size - 2 * b} color={colors[0]} />
      <Rect x={b} y={b} width={size - 2 * b} height={size - 2 * b} color={colors[3]} style="stroke" strokeWidth={1.5} />
      {[0.28, 0.72].map(x => (
        <Group key={x} transform={[{ translateX: size * x }, { translateY: size * (x < 0.5 ? 0.34 : 0.66) }, { scale: size * 0.2 }]}>
          <Path path={island} color={colors[1]} style="stroke" strokeWidth={1.2 / (size * 0.2)} />
        </Group>
      ))}
      <Circle cx={size * 0.72} cy={size * 0.3} r={Math.max(1.2, size * 0.02)} color={colors[2]} />
      <Circle cx={size * 0.28} cy={size * 0.7} r={Math.max(1.2, size * 0.02)} color={colors[2]} />
      <Rect x={size * 0.28} y={size * 0.34 - size * 0.045} width={size * 0.44} height={size * 0.09} color="#BE8D55" />
      <Rect x={size * 0.72 - size * 0.045} y={size * 0.34} width={size * 0.09} height={size * 0.32} color="#BE8D55" />
      {[
        [0.28, 0.34],
        [0.72, 0.34],
        [0.72, 0.66],
      ].map(([x, y]) => (
        <Group key={`${x}${y}`} transform={[{ translateX: size * x }, { translateY: size * y }, { scale: size * 0.1 }]}>
          <Path path={island} color="#EBD7A5" />
        </Group>
      ))}
    </Canvas>
  );
}

/** The page art's blossom, on its stalk, in the item's colour. */
function GardenSwatch({ colors, size }: { colors: ReadonlyArray<string>; size: number }): React.JSX.Element {
  const paths = useMemo(
    () => ({
      blossom: blossomPath(size * 0.5, size * 0.4, size * 0.3, 6, 7, 0.3),
      leaf: leafPath(size * 0.5, size * 0.78, size * 0.78, size * 0.6, size * 0.08),
    }),
    [size],
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={`M ${size * 0.5} ${size * 0.45} L ${size * 0.5} ${size * 0.98}`} color={theme.colors.primary} style="stroke" strokeWidth={size * 0.04} strokeCap="round" />
      <Path path={paths.leaf} color={theme.colors.primary} />
      <Path path={paths.blossom} color={colors[0]} />
      <Circle cx={size * 0.5} cy={size * 0.4} r={size * 0.06} color={theme.colors.surfaceHi} opacity={0.85} />
    </Canvas>
  );
}

/** A solve chime: a bell in the item's metal, with the sound leaving it
 * in rings of its second colour. */
function ChimeSwatch({ colors, size }: { colors: ReadonlyArray<string>; size: number }): React.JSX.Element {
  const s = size;
  const metal = colors[0] ?? theme.colors.gold;
  const ring = colors[1] ?? theme.colors.surfaceHi;
  const bell = `M ${s * 0.3} ${s * 0.66} C ${s * 0.3} ${s * 0.36} ${s * 0.36} ${s * 0.24} ${s * 0.5} ${s * 0.24} C ${s * 0.64} ${s * 0.24} ${s * 0.7} ${s * 0.36} ${s * 0.7} ${s * 0.66} L ${s * 0.76} ${s * 0.72} L ${s * 0.24} ${s * 0.72} Z`;
  return (
    <Canvas style={{ width: s, height: s }}>
      {[0.36, 0.46].map((r, i) => (
        <Path
          key={i}
          path={`M ${s * (0.5 + r)} ${s * 0.3} Q ${s * (0.56 + r)} ${s * 0.48} ${s * (0.5 + r)} ${s * 0.66} M ${s * (0.5 - r)} ${s * 0.3} Q ${s * (0.44 - r)} ${s * 0.48} ${s * (0.5 - r)} ${s * 0.66}`}
          color={metal}
          style="stroke"
          strokeWidth={s * 0.035}
          strokeCap="round"
          opacity={0.5 - i * 0.2}
        />
      ))}
      <Circle cx={s * 0.5} cy={s * 0.2} r={s * 0.05} color={metal} />
      <Path path={bell} color={metal} />
      <Path path={`M ${s * 0.38} ${s * 0.36} C ${s * 0.38} ${s * 0.46} ${s * 0.37} ${s * 0.56} ${s * 0.36} ${s * 0.64}`} color={ring} style="stroke" strokeWidth={s * 0.035} strokeCap="round" opacity={0.7} />
      <Circle cx={s * 0.5} cy={s * 0.78} r={s * 0.06} color={metal} />
    </Canvas>
  );
}

/** How an item looks, whatever its slot. */
export function CosmeticPreview({ item, size = 72 }: { item: Cosmetic; size?: number }): React.JSX.Element {
  if (item.slot === 'confetti') return <ConfettiSwatch colors={item.colors} size={size} />;
  if (item.slot === 'ball') return <MarblePreview colors={item.colors} size={size * 0.72} />;
  if (item.slot === 'garden') return <GardenSwatch colors={item.colors} size={size} />;
  if (item.slot.startsWith('skin-')) return <SkinPreview item={item} size={size} />;
  if (item.slot === 'chime') return <ChimeSwatch colors={item.colors} size={size} />;
  return <ChartSwatch colors={item.colors} size={size} />;
}

const styles = themedStyles(() => ({
  abs: { position: 'absolute' },
  clip: { overflow: 'hidden' },
}));

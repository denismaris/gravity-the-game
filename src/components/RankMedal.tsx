import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { shade } from '../game/rendering';
import { toRoman } from '../progression/rank';
import { theme, themedStyles, inkWash } from '../theme';

/** The metal a rank is struck in - bronze, silver, gold, the house violet
 * with gilt, then jade, sapphire, garnet, pearl and obsidian - two ranks
 * to each, and a rim that grows more lobes the further up the road, so
 * every pair of ranks earns a medal that looks new. */
export function medalMetal(rank: number): { rim: string; face: string; star: string; ink: string; lobes: number } {
  if (rank <= 2) return { rim: '#8E5F36', face: '#C89160', star: '#F4DDC1', ink: '#FFF6EA', lobes: 16 };
  if (rank <= 4) return { rim: '#6D7784', face: '#AFB8C3', star: '#EEF2F6', ink: '#FFFFFF', lobes: 16 };
  if (rank <= 6) return { rim: '#8F6813', face: '#D3A43A', star: '#FFF0C4', ink: '#FFF9E8', lobes: 18 };
  if (rank <= 8) return { rim: '#2A1540', face: '#4B2F68', star: '#E6C36A', ink: '#F6E7BD', lobes: 18 };
  const families = [
    { rim: '#2F5E4E', face: '#6FA68E', star: '#E6F2EA', ink: '#F4FBF6' }, // jade
    { rim: '#23406E', face: '#5C82BF', star: '#E3ECFA', ink: '#F5F8FF' }, // sapphire
    { rim: '#6A1F2C', face: '#B04A5C', star: '#F8DDE2', ink: '#FFF3F5' }, // garnet
    { rim: '#8C8170', face: '#E8E1D2', star: '#B49A5E', ink: '#5A4A2E' }, // pearl
    { rim: '#1C1A1F', face: '#3A363F', star: '#E2BE62', ink: '#F2D48A' }, // obsidian and gold
  ];
  const k = Math.floor((rank - 9) / 2);
  return { ...families[k % families.length], lobes: Math.min(26, 20 + 2 * Math.floor(k / 2)) };
}

/** A scalloped rim of `lobes` bumps round a circle of radius `r`. */
function scallopSvg(cx: number, cy: number, r: number, lobes: number, depth: number): string {
  const steps = lobes * 8;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r - depth + depth * Math.abs(Math.cos((a * lobes) / 2));
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

/** An eight-point compass star - long cardinal points, short diagonals. */
function compassSvg(cx: number, cy: number, long: number, short: number): string {
  let d = '';
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 === 0 ? long : i % 2 === 0 ? short * 1.5 : short * 0.62;
    d += `${i === 0 ? 'M' : 'L'} ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  return `${d}Z`;
}

/**
 * A rank's medal: a scalloped medallion in its metal, a compass star
 * struck into the face, and the rank's numeral on a sunk centre - a
 * struck coin, not an icon. Depth by geometry: a darker side face under
 * the rim and a flat shadow beneath, like every raised object here.
 */
export function RankMedal({ rank, size = 88 }: { rank: number; size?: number }): React.JSX.Element {
  const metal = medalMetal(rank);
  const c = size / 2;
  const r = size * 0.44;
  const paths = useMemo(
    () => ({
      rim: scallopSvg(c, c, r, metal.lobes, size * 0.028),
      side: scallopSvg(c, c + size * 0.045, r, metal.lobes, size * 0.028),
      shadow: scallopSvg(c + size * 0.03, c + size * 0.085, r, metal.lobes, size * 0.028),
      star: compassSvg(c, c, r * 0.74, r * 0.2),
    }),
    [c, r, size, metal.lobes],
  );
  const numeral = toRoman(rank);
  return (
    <View style={{ width: size, height: size + size * 0.09 }} accessibilityRole="image" accessibilityLabel={`Rank ${rank} medal`}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={paths.shadow} color={inkWash(0.16)} />
        <Path path={paths.side} color={shade(metal.rim, 0.72)} />
        <Path path={paths.rim} color={metal.rim} />
        <Circle cx={c} cy={c} r={r * 0.84} color={metal.face} />
        <Circle cx={c} cy={c} r={r * 0.78} color={metal.star} style="stroke" strokeWidth={Math.max(1, size * 0.014)} opacity={0.55} />
        <Group opacity={0.5}>
          <Path path={paths.star} color={metal.star} />
        </Group>
        <Circle cx={c} cy={c + size * 0.012} r={r * 0.44} color={shade(metal.rim, 0.8)} />
        <Circle cx={c} cy={c} r={r * 0.44} color={metal.rim} />
      </Canvas>
      <View style={[styles.numeralBox, { width: size, height: size }]} pointerEvents="none">
        <Text style={[styles.numeral, { fontSize: size * (numeral.length > 3 ? 0.14 : numeral.length > 2 ? 0.17 : 0.21), color: metal.ink }]} numberOfLines={1}>
          {numeral}
        </Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  numeralBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeral: {
    fontFamily: theme.typography.families.display,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
}));

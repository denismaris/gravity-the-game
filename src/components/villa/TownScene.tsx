import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Canvas, Circle, Group, Line, Oval, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { PIECES_PER_VILLA, residentOf, villaAt } from '../../progression';
import { useReducedMotion } from '../../game/rendering';
import { theme, themedStyles } from '../../theme';
import { VillaIsland } from './VillaIsland';

/**
 * Tessellatum Bay: the finished villas as one small seaside town. Each is
 * an island in a staggered chain down the bay, joined to the next by a
 * wooden footbridge, with its resident's name beneath it; two boats drift
 * between them, and once there are two homes a lighthouse stands at the
 * mouth of the bay. Flat colour, like the rest of the art.
 */
const ISLAND_W = 0.46;
const ROW_H = 0.5;

export function TownScene({ count, width, night }: { count: number; width: number; night: boolean }): React.JSX.Element {
  const reduced = useReducedMotion();
  const islandW = width * ISLAND_W;
  const islandH = islandW * 0.86;
  const rowH = width * ROW_H;
  const top = width * 0.12;
  const height = top + Math.max(1, count) * rowH * 0.62 + islandH * 0.55 + 36;

  // Where each villa sits: left, right, left... stepping down the bay.
  const spots = useMemo(
    () =>
      Array.from({ length: count }, (_v, i) => ({
        x: (i % 2 === 0 ? 0.27 : 0.73) * width,
        y: top + i * rowH * 0.62 + islandH * 0.42,
      })),
    [count, width, top, rowH, islandH],
  );

  const sea = night ? '#1E2846' : '#BFE0E6';
  const wave = night ? '#2A3658' : '#D6EDF1';
  const plank = night ? '#6B5A45' : '#B48B5E';

  // Two boats crossing the bay, out and back, on the UI thread.
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift, reduced]);
  const boatA = useDerivedValue(() => [{ translateX: width * (0.12 + 0.62 * drift.value) }, { translateY: top + rowH * 0.32 }]);
  const boatB = useDerivedValue(() => [{ translateX: width * (0.82 - 0.58 * drift.value) }, { translateY: height - 34 }]);

  return (
    <View style={{ width, height }}>
      <Canvas style={{ position: 'absolute', width, height }}>
        <Rect x={0} y={0} width={width} height={height} color={sea} />
        {/* Swell lines, still - a sea at rest. */}
        {Array.from({ length: Math.ceil(height / 46) }, (_v, i) => (
          <Path
            key={`w${i}`}
            path={`M ${width * ((i * 0.37) % 0.6)} ${20 + i * 46} q 12 -6 24 0 q 12 6 24 0`}
            color={wave}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
          />
        ))}
        {/* Footbridges between neighbours, drawn under the islands. */}
        {spots.slice(1).map((b, i) => {
          const a = spots[i];
          const n = 7;
          return (
            <Group key={`br${i}`}>
              <Line p1={vec(a.x, a.y)} p2={vec(b.x, b.y)} color={plank} strokeWidth={6} opacity={0.55} />
              {Array.from({ length: n }, (_u, k) => {
                const t = (k + 1) / (n + 1);
                return <Circle key={k} cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r={2.4} color={plank} />;
              })}
            </Group>
          );
        })}
        {count >= 2 && <Lighthouse x={width * 0.9} y={top * 0.95} night={night} />}
        <Group transform={boatA}>
          <Boat night={night} />
        </Group>
        {count >= 3 && (
          <Group transform={boatB}>
            <Boat night={night} flip />
          </Group>
        )}
      </Canvas>
      {spots.map((spot, i) => {
        const resident = residentOf(i);
        return (
          <View key={i} style={{ position: 'absolute', left: spot.x - islandW / 2, top: spot.y - islandH * 0.62, width: islandW, alignItems: 'center' }}>
            <VillaIsland plan={villaAt(i)} built={PIECES_PER_VILLA} width={islandW} height={islandH} night={night} />
            <Text style={styles.name} numberOfLines={1}>
              {villaAt(i).name}
            </Text>
            <Text style={styles.resident} numberOfLines={1}>{`${resident.name}, ${resident.trade}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Boat({ night, flip = false }: { night: boolean; flip?: boolean }): React.JSX.Element {
  const hull = night ? '#5A3E2E' : '#8C5A3C';
  const sail = night ? '#B8B2A4' : '#F4EFE4';
  return (
    <Group transform={flip ? [{ scaleX: -1 }] : []}>
      <Oval x={-12} y={-4} width={24} height={14} color={night ? '#16203A' : '#A9D2DA'} opacity={0.6} />
      <Path path="M -11 -2 L 11 -2 L 7 4 L -7 4 Z" color={hull} />
      <Path path="M 0 -18 L 0 -3 L 9 -3 Z" color={sail} />
      <Path path="M -1 -15 L -1 -3 L -7 -3 Z" color={sail} opacity={0.85} />
    </Group>
  );
}

function Lighthouse({ x, y, night }: { x: number; y: number; night: boolean }): React.JSX.Element {
  return (
    <Group>
      <Oval x={x - 16} y={y + 22} width={32} height={10} color={night ? '#3A3530' : '#8C7A68'} />
      <Path path={`M ${x - 7} ${y + 26} L ${x + 7} ${y + 26} L ${x + 5} ${y - 6} L ${x - 5} ${y - 6} Z`} color={night ? '#B9B2A4' : '#F4EFE4'} />
      <Rect x={x - 6.2} y={y + 4} width={12.4} height={5} color={theme.colors.secondary} />
      <Rect x={x - 5.6} y={y + 15} width={11.2} height={5} color={theme.colors.secondary} />
      <RoundedRect x={x - 6} y={y - 13} width={12} height={8} r={2} color={night ? '#F7D27A' : '#E9D59A'} />
      <Path path={`M ${x - 7} ${y - 13} L ${x} ${y - 20} L ${x + 7} ${y - 13} Z`} color={night ? '#5B3B2C' : '#8C5A3C'} />
      {night && <Circle cx={x} cy={y - 9} r={18} color="#FFD26B" opacity={0.18} />}
    </Group>
  );
}

const styles = themedStyles(() => ({
  name: { marginTop: -6, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  resident: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
}));

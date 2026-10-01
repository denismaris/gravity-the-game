import React from 'react';
import { Canvas, Circle, Group, Oval, Path, Rect } from '@shopify/react-native-skia';
import { shade } from '../game/rendering';
import { theme } from '../theme';

/** Coins per stack, left to right, for each size of pack. */
const STACKS: ReadonlyArray<ReadonlyArray<number>> = [
  [3],
  [4, 2],
  [3, 6, 4],
  [5, 8, 6, 3],
];

/**
 * A pack of coins, drawn as stacks of minted coins seen from a little
 * above: each coin a darker edge with the gilt face on top, so the stack's
 * height is real geometry rather than a shadow. Bigger packs stand more
 * and taller stacks.
 */
export function CoinPile({ tier, size }: { tier: number; size: number }): React.JSX.Element {
  const stacks = STACKS[Math.max(0, Math.min(STACKS.length - 1, tier))];
  const face = theme.colors.accent;
  const edge = shade(face, 0.72);
  const rim = '#E2B85C';
  const mark = '#FFF3D4';
  const r = size * (stacks.length > 3 ? 0.15 : stacks.length > 2 ? 0.17 : 0.21);
  const ry = r * 0.44;
  const h = r * 0.3;
  const base = size * 0.84;
  const span = (stacks.length - 1) * r * 1.5;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Oval x={size / 2 - span / 2 - r * 1.3} y={base - ry * 0.6} width={span + r * 2.6} height={ry * 1.8} color={theme.colors.towersShadow} />
      {stacks.map((count, s) => {
        // Middle stacks a touch forward, so the pile has a front.
        const cx = size / 2 - span / 2 + s * r * 1.5;
        const lift = Math.abs(s - (stacks.length - 1) / 2) * ry * 0.5;
        const y0 = base - lift;
        return (
          <Group key={s}>
            {Array.from({ length: count }, (_v, i) => {
              const y = y0 - i * h;
              const top = i === count - 1;
              return (
                <Group key={i}>
                  <Oval x={cx - r} y={y - ry} width={r * 2} height={ry * 2} color={edge} />
                  <Rect x={cx - r} y={y - h} width={r * 2} height={h} color={edge} />
                  <Oval x={cx - r} y={y - h - ry} width={r * 2} height={ry * 2} color={top ? face : shade(face, 0.9)} />
                  {top && (
                    <Group>
                      <Oval x={cx - r * 0.74} y={y - h - ry * 0.74} width={r * 1.48} height={ry * 1.48} color={rim} style="stroke" strokeWidth={Math.max(1, r * 0.08)} />
                      <Path
                        path={`M ${cx} ${y - h - ry * 0.42} L ${cx + r * 0.3} ${y - h} L ${cx} ${y - h + ry * 0.42} L ${cx - r * 0.3} ${y - h} Z`}
                        color={mark}
                      />
                    </Group>
                  )}
                </Group>
              );
            })}
          </Group>
        );
      })}
      {/* A coin leaning against the biggest packs. */}
      {stacks.length > 2 && (
        <Group transform={[{ rotate: -0.35 }]} origin={{ x: size * 0.82, y: base }}>
          <Circle cx={size * 0.84} cy={base - r * 0.82} r={r * 0.8} color={edge} />
          <Circle cx={size * 0.82} cy={base - r * 0.86} r={r * 0.8} color={face} />
          <Circle cx={size * 0.82} cy={base - r * 0.86} r={r * 0.58} color={rim} style="stroke" strokeWidth={Math.max(1, r * 0.07)} />
        </Group>
      )}
    </Canvas>
  );
}

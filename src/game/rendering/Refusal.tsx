import React, { useEffect } from 'react';
import { Group, RoundedRect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../../theme';
import { useReducedMotion } from './useReducedMotion';

/**
 * A move the board will not take, answered the same way in every game: a
 * calm outline round the spot that gives a small shake and goes, with the
 * shared `refuse` knock (see `haptics.ts`). Never red, never a buzz: a
 * child testing a wall should learn where it is, not feel told off.
 */
export const REFUSE_MS = 420;
/** How far the shake swings, at its widest. */
export const REFUSE_PX = 4;

/** The shake at `t` (0..1), as a share of `REFUSE_PX`: two and a half
 * swings, dying away. */
export function refuseShake(t: number): number {
  'worklet';
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(t * Math.PI * 5) * (1 - t) * (1 - t);
}

/** The outline's opacity at `t`: held, then gone. */
export function refuseFade(t: number): number {
  'worklet';
  if (t <= 0.55) return 1;
  if (t >= 1) return 0;
  return 1 - (t - 0.55) / 0.45;
}

/**
 * The refusal outline for a Skia board, round a square at `x, y`. Key it
 * by the refusal so each one plays from the top. With reduced motion it
 * only fades.
 */
export function RefuseMark({ x, y, size, r }: { x: number; y: number; size: number; r?: number }): React.JSX.Element {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: REFUSE_MS, easing: Easing.linear });
  }, [t]);
  const transform = useDerivedValue(() => [{ translateX: reduced ? 0 : refuseShake(t.value) * REFUSE_PX }]);
  const opacity = useDerivedValue(() => refuseFade(t.value));
  const inset = 2;
  return (
    <Group transform={transform} opacity={opacity}>
      <RoundedRect
        x={x + inset}
        y={y + inset}
        width={size - inset * 2}
        height={size - inset * 2}
        r={r ?? size * 0.18}
        color={theme.colors.textSecondary}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
  );
}

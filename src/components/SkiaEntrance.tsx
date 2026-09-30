import React, { useEffect } from 'react';
import { Group, SkPoint } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

function clamp01(t: number): number {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeOutCubic(t: number): number {
  'worklet';
  return 1 - (1 - t) ** 3;
}

export interface SkiaEntranceProps {
  /** How long it takes to settle, in ms. */
  duration: number;
  /** The scale it lands at before settling to 1 - 1 for none. */
  overshoot?: number;
  /** The share of `duration` over which it fades in. */
  fadeShare?: number;
  /** Extra turn, in radians, it unwinds from as it lands - 0 for none. */
  turn?: number;
  /** Adds a brief swell (a sine hump of this size) on the way in. */
  swell?: number;
  /** What it scales and turns about. */
  origin: SkPoint;
  /** Motion off: fade only. */
  reducedMotion?: boolean;
  children: React.ReactNode;
}

/**
 * A piece arriving on a Skia board - struck oversized and settling, or
 * turned in - played on the UI thread. It mounts once, when the piece is
 * placed (key it on the placement), and Reanimated runs it from there, so
 * placing something costs one React render rather than a burst of them at
 * 60fps from a JavaScript clock.
 */
export function SkiaEntrance({ duration, overshoot = 1, fadeShare = 0.5, turn = 0, swell = 0, origin, reducedMotion = false, children }: SkiaEntranceProps): React.JSX.Element {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration, easing: Easing.linear });
  }, [t, duration]);
  const opacity = useDerivedValue(() => (fadeShare <= 0 ? 1 : easeOutCubic(clamp01(t.value / fadeShare))));
  const transform = useDerivedValue(() => {
    if (reducedMotion) return [{ scale: 1 }];
    const eased = easeOutCubic(t.value);
    const scale = 1 + (overshoot - 1) * (1 - eased) + swell * Math.sin(eased * Math.PI);
    return [{ rotate: (1 - eased) * turn }, { scale }];
  });
  return (
    <Group opacity={opacity} transform={transform} origin={origin}>
      {children}
    </Group>
  );
}

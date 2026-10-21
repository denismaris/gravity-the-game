import { Animated, Easing } from 'react-native';

/**
 * The "placed" motion both completion cards share: a game's emblem drops
 * into its place - falling a little, growing, a small turn straightening -
 * and a check stamps onto its corner. Everything is a slice of one 0..1
 * clock, so a whole row runs off a handful of native-driven values.
 */

/** A slice of a 0..1 clock, eased: 0 before `from`, 1 after `to`. */
export function slice(t: Animated.Value, from: number, to: number, easing: (x: number) => number, out: [number, number], before?: number): Animated.AnimatedInterpolation<number> {
  // The easing sampled into the interpolation, so it runs on the native
  // driver; outside [from, to] it holds its ends - or, given `before`,
  // holds that until the slice begins (a ring that fades *out* must not
  // show at full strength while it waits).
  const steps = 12;
  const inputRange = Array.from({ length: steps + 1 }, (_v, k) => from + ((to - from) * k) / steps);
  const outputRange = inputRange.map((_x, k) => out[0] + (out[1] - out[0]) * easing(k / steps));
  if (before !== undefined && from > 0) {
    inputRange.unshift(0, from - 0.001);
    outputRange.unshift(before, before);
  }
  return t.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
}

export const settle = Easing.out(Easing.back(1.5));
export const glide = Easing.out(Easing.cubic);

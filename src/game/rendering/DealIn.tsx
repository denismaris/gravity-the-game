import React, { useEffect } from 'react';
import { Group, vec } from '@shopify/react-native-skia';
import { Easing, SharedValue, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './useReducedMotion';
import { motion } from '../../theme';
import { whenDealsReleased } from './dealGate';

/** The deal waits this long for the screen's own entrance to have the
 * board's frame in place - dealt any sooner, the pieces landed while the
 * whole board was still fading in, unseen. */
export const DEAL_BASE_MS = motion.beat.dealBase;
/** One piece's own arrival, once its turn comes. */
export const DEAL_MS = 380;
/** Delay per step out from the board's top-left corner. */
export const DEAL_STEP_MS = 32;
/** The far corner never waits longer than this, however big the board. */
export const DEAL_SPREAD_MS = 420;
/** The whole deal, start to last piece settled. */
const DEAL_TOTAL_MS = DEAL_BASE_MS + DEAL_SPREAD_MS + DEAL_MS;

/** A board's one deal clock: milliseconds since the board opened, run once
 * on the UI thread. Every piece reads its own moment off it. */
export type DealClock = SharedValue<number>;

/**
 * The board's deal clock, started as the board mounts. One timing for the
 * whole board: each piece giving itself its own timer and two animated
 * values (as the first version here did) was dozens of each, all created
 * in the same frame the board mounted, and made a puzzle open heavily.
 */
export function useDealing(): DealClock {
  const reduced = useReducedMotion();
  const clock = useSharedValue(reduced ? DEAL_TOTAL_MS : 0);
  useEffect(() => {
    if (reduced) return;
    let held = false;
    const cancel = whenDealsReleased(() => {
      // Held under the hand-off veil: once it lifts, the deal starts at
      // once - the board's frame is already in place.
      const from = held ? DEAL_BASE_MS - 60 : 0;
      clock.value = from;
      clock.value = withTiming(DEAL_TOTAL_MS, { duration: DEAL_TOTAL_MS - from, easing: Easing.linear });
    });
    held = true;
    return cancel;
    // Once, on mount: the board's opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return clock;
}

/** The delay for a piece `steps` out from the corner, on a board whose far
 * corner is `farthest` steps out: the wave always takes the same time. */
export function dealDelay(steps: number, farthest: number): number {
  return Math.round(Math.min(DEAL_STEP_MS, DEAL_SPREAD_MS / Math.max(1, farthest)) * steps);
}

/**
 * A board dealt out rather than shown: whatever this wraps grows into its
 * place from a touch above and settles with a small give, `delay` ms into
 * the board's deal (`clock`, from `useDealing`). A piece that mounts later
 * in play reads a finished clock and is simply there. `x`, `y` are the
 * piece's centre, which it grows from. One derived value a piece, on the
 * UI thread.
 */
export function DealIn({ x, y, delay, dealing, children }: { x: number; y: number; delay: number; dealing?: DealClock; deal?: number; children: React.ReactNode }): React.JSX.Element {
  const fallback = useSharedValue(DEAL_TOTAL_MS);
  const clock = dealing ?? fallback;
  const transform = useDerivedValue(() => {
    const local = (clock.value - DEAL_BASE_MS - delay) / DEAL_MS;
    if (local >= 1) return [{ translateY: 0 }, { scale: 1 }];
    if (local <= 0) return [{ translateY: -7 }, { scale: 0 }];
    // Out-back: a little past full size, then settling.
    const c1 = 1.5;
    const c3 = c1 + 1;
    const p = 1 + c3 * (local - 1) ** 3 + c1 * (local - 1) ** 2;
    return [{ translateY: (1 - p) * -7 }, { scale: 0.45 + 0.55 * p }];
  });
  return (
    <Group origin={vec(x, y)} transform={transform}>
      {children}
    </Group>
  );
}

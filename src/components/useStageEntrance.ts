import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../game/rendering';
import { whenDealsReleased } from '../game/rendering/dealGate';

/**
 * How a puzzle arrives. Every play screen mounts fresh for each puzzle, and
 * until now its board and controls simply appeared, all at once - fine,
 * but the one moment a player is looking hardest at the screen is the
 * moment a new puzzle lands. The board now rises a little, settling on a
 * soft spring as it fades up; the controls follow a beat behind.
 *
 * It waits for the hand-off's veil to open (the deal's own gate): started
 * on mount, it played out under the veil and the board was simply there
 * when it lifted. The controls (any `delayMs`) come in after the board
 * has mostly risen, so the eye goes board first.
 *
 * Native-driver transforms only, so it costs no JavaScript per frame and
 * cannot compete with a board's own intro wave. Skipped outright under
 * reduced motion.
 */
export function useStageEntrance(delayMs = 0): {
  opacity: Animated.AnimatedInterpolation<number>;
  transform: Array<{ translateY: Animated.AnimatedInterpolation<number> } | { scale: Animated.AnimatedInterpolation<number> }>;
} {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const spring = Animated.spring(progress, { toValue: 1, delay: delayMs > 0 ? delayMs + 120 : 0, useNativeDriver: true, damping: 17, stiffness: 150, mass: 1 });
    const cancel = whenDealsReleased(() => spring.start());
    return () => {
      cancel();
      spring.stop();
    };
  }, [progress, delayMs, reducedMotion]);

  return {
    opacity: progress.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
    ],
  };
}

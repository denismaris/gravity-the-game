import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { Direction } from '../game/engine';
import { useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

export interface GravityHintArrowProps {
  /** The board's pixel size - the arrow is drawn over it. */
  readonly size: number;
  /** The way to pull next. */
  readonly direction: Direction;
  /** Called once the hint has finished showing. */
  readonly onDone: () => void;
}

const PULSE_IN_MS = 220;
const PULSE_OUT_MS = 380;
const PULSES = 2;

/**
 * Gravity's hint: a soft band along the edge to pull toward, with a chevron
 * pointing that way, pulsing twice. It *shows* the move rather than making
 * it - the swipe is still the player's, so the moment of seeing why stays
 * theirs. Drawn once; only its opacity animates, on the native driver.
 */
export function GravityHintArrow({ size, direction, onDone }: GravityHintArrowProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: PULSE_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: reducedMotion ? 1 : 0.25, duration: PULSE_OUT_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    const run = Animated.sequence([
      ...Array.from({ length: PULSES }, () => pulse),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [opacity, onDone, reducedMotion]);

  // Drawn pointing up, then turned to face the pull.
  const band = size * 0.2;
  const c = size / 2;
  const chevron = size * 0.09;
  const turn = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[direction];
  const tipY = band * 0.3;
  const arrow = `M ${c - chevron * 1.3} ${tipY + chevron * 1.1} L ${c} ${tipY} L ${c + chevron * 1.3} ${tipY + chevron * 1.1}`;
  const arrow2 = `M ${c - chevron * 1.3} ${tipY + chevron * 2.1} L ${c} ${tipY + chevron} L ${c + chevron * 1.3} ${tipY + chevron * 2.1}`;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]} accessibilityElementsHidden>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group origin={{ x: c, y: c }} transform={[{ rotate: turn }]}>
          <RoundedRect x={0} y={0} width={size} height={band} r={theme.radii.md} color={theme.colors.secondary} opacity={0.16} />
          <Path path={arrow} color={theme.colors.secondary} style="stroke" strokeWidth={Math.max(3, size * 0.022)} strokeCap="round" strokeJoin="round" />
          <Path path={arrow2} color={theme.colors.secondary} style="stroke" strokeWidth={Math.max(3, size * 0.022)} strokeCap="round" strokeJoin="round" opacity={0.55} />
        </Group>
      </Canvas>
    </Animated.View>
  );
}

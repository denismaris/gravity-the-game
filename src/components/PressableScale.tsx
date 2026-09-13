import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { triggerFeedback } from '../game/rendering';
import { motion } from '../theme';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Same function-of-pressed-state form `Pressable` takes, for the
   * background/opacity change that rides alongside the scale. */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Extra style for the outer `Animated.View` the scale is applied to -
   * only needed when the pressable must stretch to fill a flex parent. */
  containerStyle?: StyleProp<ViewStyle>;
  /** How small the press dips to. 1 disables the effect entirely. */
  scaleTo?: number;
  /** Set false to skip the tap haptic/sound - only for a pressable that
   * already fires its own, more specific feedback (e.g. a direction press
   * that plays `gravityChange` instead) and would otherwise double up. */
  feedback?: boolean;
}

/**
 * Drop-in replacement for `Pressable` that adds a quick, springy press-down
 * (and release) to whatever it wraps - the one tactile cue almost every
 * tappable surface in the app was missing (a background/opacity swap alone
 * reads as a hover state, not a *press*). Layered on top of, not instead
 * of, the existing `pressed`-driven style - cards and pills keep whatever
 * colour change they already had.
 *
 * Purely presentational: no game logic, no timing that anything else
 * depends on. Safe to use anywhere a `Pressable` is used today.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.96,
  feedback = true,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  // Guards against `onPress` firing more than once for the same physical
  // press. Reset on every `onPressIn`, so it never blocks two genuinely
  // separate taps no matter how close together they land - it only catches
  // a single gesture somehow producing `onPress` twice.
  const firedRef = useRef(false);

  const animateTo = (toValue: number): void => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      ...motion.spring.press,
    }).start();
  };

  const handlePressIn = (e: GestureResponderEvent): void => {
    firedRef.current = false;
    animateTo(scaleTo);
    if (feedback) triggerFeedback('tap');
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent): void => {
    animateTo(1);
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent): void => {
    if (firedRef.current) return;
    firedRef.current = true;
    onPress?.(e);
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

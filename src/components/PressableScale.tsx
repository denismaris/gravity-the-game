import React, { useEffect, useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { triggerHaptic } from '../game/rendering';
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
  /** Act this long after the tap instead of at once - for a press that
   * leaves the screen, so the key is seen going down before the page goes.
   * A quick tap otherwise navigated within the same frame it landed. */
  holdMs?: number;
}

/**
 * How far into a press the nearest `PressableScale` is, 0 at rest and 1
 * held down - for a raised face inside it (a play disc on its lip) to sink
 * as the whole thing is pressed. Null outside one.
 */
export const PressDepth = React.createContext<Animated.Value | null>(null);

/**
 * The pressed look of a key that stands on a bottom border (`lipWidth`
 * tall): its face drops onto the lip, and the box keeps its size, so the
 * row it sits in never moves. Pass it the key's own resting margin below.
 */
export function sunkKey(lipWidth: number, marginBottom = 0): ViewStyle {
  const drop = lipWidth - 1;
  return { borderBottomWidth: 1, marginBottom: marginBottom + drop, transform: [{ translateY: drop }] };
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
  holdMs = 0,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const depth = useRef(new Animated.Value(0)).current;
  // Guards against `onPress` firing more than once for the same physical
  // press. Reset on every `onPressIn`, so it never blocks two genuinely
  // separate taps no matter how close together they land - it only catches
  // a single gesture somehow producing `onPress` twice.
  const firedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const animateTo = (pressed: boolean): void => {
    Animated.parallel([
      Animated.spring(scale, { toValue: pressed ? scaleTo : 1, useNativeDriver: true, ...motion.spring.press }),
      Animated.spring(depth, { toValue: pressed ? 1 : 0, useNativeDriver: true, ...motion.spring.press }),
    ]).start();
  };

  const handlePressIn = (e: GestureResponderEvent): void => {
    firedRef.current = false;
    animateTo(true);
    // A button press is felt, not heard: a tick of sound on every tap in
    // the app was the thing players found wearing.
    if (feedback) triggerHaptic('tap');
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent): void => {
    animateTo(false);
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent): void => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (holdMs <= 0) {
      onPress?.(e);
      return;
    }
    // A tap shorter than the press delay never showed the key down at all:
    // press it now, and let it rise as the page goes.
    animateTo(true);
    holdTimer.current = setTimeout(() => {
      animateTo(false);
      onPress?.(e);
    }, holdMs);
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
        {state => <PressDepth.Provider value={depth}>{typeof children === 'function' ? children(state) : children}</PressDepth.Provider>}
      </Pressable>
    </Animated.View>
  );
}

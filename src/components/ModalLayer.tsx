import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

/** How long a card takes to leave. A following card waits this long
 * (see `useCardEntrance`'s `delay`), so one has gone before the next comes. */
export const MODAL_EXIT_MS = 240;

/** Out: a fade, and a slight settle back into the page. */
const EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.97 }], easing: Easing.in(Easing.cubic) },
}).duration(MODAL_EXIT_MS);

/**
 * The layer every card and overlay sits in. Its entrance is the card's own
 * (`useCardEntrance`); this gives it a way out - a Reanimated exit, which
 * plays after React has removed the card, so a card that closes fades
 * instead of vanishing on the spot.
 */
export function ModalLayer({ children, zIndex }: { children: React.ReactNode; zIndex?: number }): React.JSX.Element {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, zIndex !== undefined && { zIndex }]} pointerEvents="box-none" exiting={EXIT}>
      {children}
    </Animated.View>
  );
}

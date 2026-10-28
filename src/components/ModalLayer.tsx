import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';
import { motion } from '../theme';
import { curve } from '../theme/motion';

/** How long a card takes to leave. A following card waits this long
 * (see `useCardEntrance`'s `delay`), so one has gone before the next comes. */
export const MODAL_EXIT_MS = motion.beat.cardExit;

/** Out: a fade, and a slight settle back into the page. */
const EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.97 }], easing: curve.leave },
}).duration(MODAL_EXIT_MS);

/**
 * In, for a card that is simply opened (not a finish, which has its own
 * choreography): it rises a little out of the page, swells just past its
 * size and settles, so it reads as set down rather than faded on.
 */
export const CARD_POP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.92 }] },
  45: { opacity: 1, transform: [{ translateY: -2 }, { scale: 1.015 }], easing: curve.arrive },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: curve.glide },
}).duration(440);

/** In, for a sheet from the foot of the screen: up, a breath past its
 * place, and down onto it. */
export const SHEET_RISE_IN = new Keyframe({
  0: { transform: [{ translateY: 520 }] },
  72: { transform: [{ translateY: -6 }], easing: curve.arrive },
  100: { transform: [{ translateY: 0 }], easing: curve.glide },
}).duration(460);

/**
 * The layer every card and overlay sits in. Its entrance is the card's own
 * (`useCardEntrance`); this gives it a way out - a Reanimated exit, which
 * plays after React has removed the card, so a card that closes fades
 * instead of vanishing on the spot.
 */
/** Above everything a screen draws, the game header included (which is
 * itself raised, so its rule card can drop over the board): a finish
 * screen under the header left the header sharp and pressable through it. */
const MODAL_Z = 20;

export function ModalLayer({ children, zIndex = MODAL_Z }: { children: React.ReactNode; zIndex?: number }): React.JSX.Element {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: Math.max(zIndex, MODAL_Z), elevation: Math.max(zIndex, MODAL_Z) }]} pointerEvents="box-none" exiting={EXIT}>
      {children}
    </Animated.View>
  );
}

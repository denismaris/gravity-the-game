import { useMemo, useRef } from 'react';
import { GestureResponderHandlers, PanResponder } from 'react-native';
import { Direction } from '../game/engine';

/** Minimum finger travel (in dp) before a gesture counts as a swipe. Kept
 * comfortably above typical tap/tremor jitter so short accidental
 * movements (e.g. repositioning a thumb) never trigger a gravity change. */
const SWIPE_THRESHOLD = 32;

/** Minimum travel before the responder even engages, so plain taps never
 * get intercepted as a gesture in the first place. */
const CAPTURE_THRESHOLD = 10;

/**
 * Detects a single directional swipe gesture on whatever View spreads the
 * returned handlers onto its props. Reports at most one `Direction` per
 * gesture and contains no game logic - it only translates a touch gesture
 * into user intent - a swipe is the sole way to trigger gravity, there is no
 * on-screen direction pad any more.
 *
 * `disabled` (e.g. while the board is still animating a previous move)
 * makes swipes a no-op without tearing down/recreating the responder, so
 * an in-progress gesture is never left half-handled - it simply reports
 * nothing on release.
 */
export function useSwipeGesture(
  onSwipe: (direction: Direction) => void,
  disabled: boolean = false,
): GestureResponderHandlers {
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > CAPTURE_THRESHOLD || Math.abs(gesture.dy) > CAPTURE_THRESHOLD,
        onPanResponderRelease: (_event, gesture) => {
          if (disabledRef.current) return;

          const { dx, dy } = gesture;

          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
            return;
          }

          if (Math.abs(dx) > Math.abs(dy)) {
            onSwipeRef.current(dx > 0 ? 'right' : 'left');
          } else {
            onSwipeRef.current(dy > 0 ? 'down' : 'up');
          }
        },
        // If the OS interrupts the gesture (e.g. an incoming call), simply
        // drop it - there is no partial state to unwind, so the board can
        // never get stuck waiting on a gesture that will never complete.
        onPanResponderTerminate: () => {},
      }),
    [],
  );

  return responder.panHandlers;
}

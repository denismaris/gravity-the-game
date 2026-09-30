import { useMemo, useRef } from 'react';
import { GestureResponderHandlers, PanResponder } from 'react-native';
import { Direction } from '../game/engine';

/** Finger travel (in dp) that commits a swipe. Still well above tap and
 * tremor jitter, but low enough that a short, quick flick registers - the
 * old 32dp threshold, read only on release, swallowed exactly the small
 * fast swipes players make when they already know the move. */
export const SWIPE_THRESHOLD = 22;

/** Minimum travel before the responder even engages, so plain taps never
 * get intercepted as a gesture in the first place. */
const CAPTURE_THRESHOLD = 8;

/** The four custom `accessibilityActions` names a Gravity board exposes,
 * one per swipe direction - VoiceOver's rotor can trigger one without a
 * physical swipe, which it would otherwise intercept for its own
 * navigation. Kept as a pure, exported mapping (not inlined in
 * `GameScreen.tsx`'s own `onAccessibilityAction` handler) so it has a real
 * unit test independent of rendering a screen. */
export function directionForAccessibilityAction(actionName: string): Direction | null {
  return actionName === 'up' || actionName === 'down' || actionName === 'left' || actionName === 'right' ? actionName : null;
}

/** Where a finger is in one gesture, relative to where it went down. */
export interface SwipeTrack {
  /** The drag offset the last swipe fired at - the next one is measured
   * from here, not from where the finger went down. */
  anchorX: number;
  anchorY: number;
  /** The direction that last fired, if any, in this touch. */
  last: Direction | null;
}

export function newSwipeTrack(): SwipeTrack {
  return { anchorX: 0, anchorY: 0, last: null };
}

/**
 * Advances one touch's tracking to drag offset (`dx`, `dy`) and returns the
 * direction that fires now, if one does.
 *
 * A swipe fires the moment the finger has travelled `SWIPE_THRESHOLD` from
 * its anchor - mid-drag, not on release - so the move starts while the
 * finger is still moving. Then the anchor jumps to that point, so the same
 * touch can turn and fire again (right, then down, without lifting). The
 * same direction never fires twice in one touch: a long drag is one swipe,
 * not a stream of them.
 */
export function advanceSwipe(track: SwipeTrack, dx: number, dy: number): Direction | null {
  const x = dx - track.anchorX;
  const y = dy - track.anchorY;
  if (Math.max(Math.abs(x), Math.abs(y)) < SWIPE_THRESHOLD) return null;
  const direction: Direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
  track.anchorX = dx;
  track.anchorY = dy;
  if (direction === track.last) return null;
  track.last = direction;
  return direction;
}

/**
 * Turns touches on whatever View spreads the returned handlers into
 * directions. Contains no game logic - it only translates a gesture into
 * intent; what a swipe that arrives mid-move does (queue it, redirect, drop
 * it) is the caller's call.
 *
 * `disabled` makes swipes a no-op without tearing down the responder, so a
 * gesture in progress is never left half-handled.
 */
export function useSwipeGesture(
  onSwipe: (direction: Direction) => void,
  disabled: boolean = false,
): GestureResponderHandlers {
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const trackRef = useRef<SwipeTrack>(newSwipeTrack());

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > CAPTURE_THRESHOLD || Math.abs(gesture.dy) > CAPTURE_THRESHOLD,
        onPanResponderGrant: () => {
          trackRef.current = newSwipeTrack();
        },
        onPanResponderMove: (_event, gesture) => {
          const direction = advanceSwipe(trackRef.current, gesture.dx, gesture.dy);
          if (direction && !disabledRef.current) onSwipeRef.current(direction);
        },
        // A scroll view or the OS asking for the touch mid-swipe would
        // otherwise cut the gesture off before its move fires.
        onPanResponderTerminationRequest: () => false,
        // If the OS interrupts the gesture anyway (e.g. an incoming call),
        // simply drop it - there is no partial state to unwind.
        onPanResponderTerminate: () => {},
      }),
    [],
  );

  return responder.panHandlers;
}

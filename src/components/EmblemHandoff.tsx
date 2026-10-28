import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GameKind } from '../game/journey';
import { holdDeals, releaseDeals, useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { GameEmblem } from './GameEmblem';
import { curve } from '../theme/motion';

/** The emblem settling in, and the name and bar with it. */
const ARRIVE_MS = 320;
/** The emblem lifting off and the veil opening. */
const LIFT_MS = 380;
/** Never held longer than this, whatever the game is doing. */
const LONGEST_MS = 2600;
/** The emblem's size on the veil. */
const VEIL_EMBLEM = 88;
/** Flying to the header: a touch longer than a plain lift. */
const LAND_MS = 520;

/**
 * Where the game screen's own emblem sits (its header's, see
 * `PlayHeader`), so the hand-off's emblem can fly up and land on it
 * rather than fading away: one emblem, carried from the Home card into
 * the game. A header that mounts while a hand-off is under way stays
 * hidden until the flyer lands on it (`whenEmblemLanded`).
 */
interface EmblemTarget {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}
let flying = false;
let target: EmblemTarget | null = null;
const landedWaiters = new Set<() => void>();

export function setEmblemTarget(next: EmblemTarget | null): void {
  target = next;
}
/** Measures the header's emblem afresh: the flight asks just as it sets
 * off, so it lands where the emblem is then, not where it was when the
 * header first laid out (part way into its screen's entrance). */
let measurer: ((done: (to: EmblemTarget | null) => void) => void) | null = null;
export function setEmblemMeasurer(next: typeof measurer): void {
  measurer = next;
}
/** Whether a hand-off is covering the screen now arriving: that screen
 * makes no entrance of its own (the veil opening is its entrance). */
export function handoffActive(): boolean {
  return flying;
}
export function whenEmblemLanded(show: () => void): () => void {
  if (!flying) {
    show();
    return () => {};
  }
  landedWaiters.add(show);
  return () => {
    landedWaiters.delete(show);
  };
}
function land(): void {
  flying = false;
  landedWaiters.forEach(show => show());
  landedWaiters.clear();
}

/**
 * The way into a puzzle: a short loading moment that is honest about it.
 *
 * The game's emblem settles onto a veil in the page's own colour while the
 * game screen is built under it, and lifts away only once that screen has
 * drawn (`ready`), so nothing half-built is ever seen; the veil opens and
 * the board deals itself in, in view (the deal is held until now - see
 * `dealGate`).
 * Native-driven throughout; skipped under reduced motion.
 */
export function EmblemHandoff({ kind, ready, onDone }: { kind: GameKind; ready: boolean; onDone: () => void }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const arrive = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  /** Where the flight ends, once known: offset from the veil's centre and
   * the scale that makes the veil's emblem the header's size. */
  const flight = useRef({ dx: new Animated.Value(0), dy: new Animated.Value(-height * 0.3), scale: new Animated.Value(0.6), landing: new Animated.Value(0) }).current;

  const state = useRef({ arrived: false, ready: false, leaving: false });
  const leaveRef = useRef<() => void>(() => {});

  leaveRef.current = () => {
    const st = state.current;
    if (st.leaving || !st.arrived || !st.ready) return;
    st.leaving = true;
    if (measurer) measurer(fresh => fly(fresh ?? target));
    else fly(target);
  };
  const fly = (to: EmblemTarget | null) => {
    if (to) {
      // Fly to the header's emblem: the veil's centre is the screen's.
      flight.landing.setValue(1);
      flight.dx.setValue(to.x - width / 2);
      flight.dy.setValue(to.y - height / 2);
      flight.scale.setValue(to.size / VEIL_EMBLEM);
    }
    Animated.timing(lift, { toValue: 1, duration: to ? LAND_MS : LIFT_MS, easing: curve.glide, useNativeDriver: true }).start(() => {
      // The header's emblem shows under the flyer, then the flyer goes:
      // two frames, so the two overlap rather than leave a gap.
      land();
      requestAnimationFrame(() => requestAnimationFrame(() => onDone()));
    });
    // The board deals as the veil opens.
    setTimeout(releaseDeals, LIFT_MS * 0.35);
  };

  useEffect(() => {
    if (reduced) {
      land();
      onDone();
      return;
    }
    // A flight is under way: the game screen mounts a couple of frames
    // after this, and its header waits for the emblem to land on it.
    flying = true;
    target = null;
    measurer = null;
    holdDeals();
    Animated.timing(arrive, { toValue: 1, duration: ARRIVE_MS, easing: curve.reward, useNativeDriver: true }).start(() => {
      state.current.arrived = true;
      leaveRef.current();
    });
    const safety = setTimeout(() => {
      state.current.arrived = true;
      state.current.ready = true;
      leaveRef.current();
    }, LONGEST_MS);
    return () => {
      clearTimeout(safety);
      releaseDeals();
      land();
    };
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    state.current.ready = true;
    leaveRef.current();
  }, [ready]);

  if (reduced) return null;
  // Landing, it stays solid all the way (the header's emblem takes over
  // under it); lifting away with nowhere to land, it fades as before.
  const fadeAway = lift.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const flyerOpacity = Animated.add(flight.landing, Animated.multiply(Animated.subtract(1, flight.landing), fadeAway));
  const toward = (end: Animated.Value, from: number) => Animated.add(from, Animated.multiply(lift, Animated.subtract(end, from)));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.veil, { opacity: lift.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1, 0] }) }]} />
      <Animated.View
        style={[
          styles.center,
          {
            opacity: Animated.multiply(arrive.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), flyerOpacity),
            transform: [
              { translateX: toward(flight.dx, 0) },
              { translateY: toward(flight.dy, 0) },
              { scale: Animated.multiply(arrive.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }), toward(flight.scale, 1)) },
            ],
          },
        ]}
      >
        <GameEmblem kind={kind} size={VEIL_EMBLEM} raised />
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.background },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));

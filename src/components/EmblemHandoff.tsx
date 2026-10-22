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
  const { height } = useWindowDimensions();
  const arrive = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const state = useRef({ arrived: false, ready: false, leaving: false });
  const leaveRef = useRef<() => void>(() => {});

  leaveRef.current = () => {
    const st = state.current;
    if (st.leaving || !st.arrived || !st.ready) return;
    st.leaving = true;
    Animated.timing(lift, { toValue: 1, duration: LIFT_MS, easing: curve.glide, useNativeDriver: true }).start(() => onDone());
    // The board deals as the veil opens.
    setTimeout(releaseDeals, LIFT_MS * 0.35);
  };

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
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
  const out = (from: number, to: number) => lift.interpolate({ inputRange: [0, 1], outputRange: [from, to], extrapolate: 'clamp' });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.veil, { opacity: lift.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1, 0] }) }]} />
      <Animated.View
        style={[
          styles.center,
          {
            opacity: Animated.multiply(arrive.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }), lift.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })),
            transform: [{ translateY: out(0, -height * 0.3) }, { scale: Animated.multiply(arrive.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }), out(1, 0.6)) }],
          },
        ]}
      >
        <GameEmblem kind={kind} size={88} raised />
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.background },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
}));

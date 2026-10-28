import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AccessibilityState, Animated, View } from 'react-native';
import { theme, themedStyles, motion } from '../theme';
import { isReducedMotion, triggerFeedback } from '../game/rendering';
import { curve } from '../theme/motion';
import { PressableScale } from './PressableScale';
import { RaisedKey } from './RaisedKey';
import { Text } from './Text';

/** The round key under every board - Undo, Restart - on its own edge. */
export const ROUND_KEY = 44;
const LIP = 3;
/** How long an armed key waits for its second tap. */
const ARMED_MS = 2600;

export function RoundKey({
  accessibilityLabel,
  accessibilityState,
  onPress,
  disabled,
  dim = false,
  confirm,
  turn,
  children,
}: {
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  onPress: () => void;
  disabled?: boolean;
  /** Can't be used right now (nothing to undo): faded, still in its place. */
  dim?: boolean;
  /**
   * Asks for a second tap before it acts, with this said and shown ("Tap
   * again"): for a key that throws work away, so a stray thumb (or a hand
   * that shakes) cannot clear a board half solved. Undo needs no such
   * guard; Restart does.
   */
  confirm?: string;
  /** How the icon answers a press: Undo's swings back a little and
   * home, Restart's spins round once. Read from the label when not given. */
  turn?: 'swing' | 'spin' | 'none';
  children: React.ReactNode;
}): React.JSX.Element {
  const [armed, setArmed] = useState(false);
  // The icon's own small answer to the press, on the native driver.
  const spin = useRef(new Animated.Value(0)).current;
  const mode = turn ?? (accessibilityLabel.startsWith('Undo') ? 'swing' : accessibilityLabel.startsWith('Restart') ? 'spin' : 'none');
  const answer = () => {
    if (mode === 'none' || isReducedMotion()) return;
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: mode === 'swing' ? 420 : 620, easing: mode === 'swing' ? curve.linear : curve.arrive, useNativeDriver: true }).start();
  };
  // Undo: back most of a quarter turn and home, a page turned back.
  // Restart: once round, backwards, the board wound to its start.
  const rotate =
    mode === 'swing'
      ? spin.interpolate({ inputRange: [0, 0.4, 1], outputRange: ['0deg', '-70deg', '0deg'] })
      : spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tip = useRef(new Animated.Value(0)).current;
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    Animated.spring(tip, { toValue: armed ? 1 : 0, useNativeDriver: true, ...motion.spring.kick }).start();
  }, [armed, tip]);

  const press = () => {
    if (!confirm) {
      answer();
      onPress();
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      answer();
      onPress();
      return;
    }
    setArmed(true);
    triggerFeedback('tap');
    AccessibilityInfo.announceForAccessibility(confirm);
    timer.current = setTimeout(() => setArmed(false), ARMED_MS);
  };

  return (
    <View>
      {confirm && (
        <Animated.View
          pointerEvents="none"
          style={[styles.tip, { opacity: tip, transform: [{ translateY: tip.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View style={styles.tipPill}>
            <Text style={styles.tipText}>{confirm}</Text>
          </View>
        </Animated.View>
      )}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={confirm ? 'Asks for a second tap first' : undefined}
        accessibilityState={accessibilityState}
        onPress={press}
        disabled={disabled}
        scaleTo={1}
        hitSlop={6}
      >
        <RaisedKey height={ROUND_KEY} width={ROUND_KEY} lip={LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={armed ? theme.colors.textPrimary : theme.colors.border} idle={dim}>
          <Animated.View style={{ transform: [{ rotate }] }}>{children}</Animated.View>
        </RaisedKey>
      </PressableScale>
    </View>
  );
}

const styles = themedStyles(() => ({
  tip: { position: 'absolute', bottom: ROUND_KEY + LIP + 14, left: -60, right: -60, alignItems: 'center' },
  tipPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  tipText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
}));

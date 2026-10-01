import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { HintKind } from '../game/hints';
import { theme, themedStyles } from '../theme';

const LABEL: Record<HintKind, string> = { fix: 'SET RIGHT', rule: 'WHY', nudge: 'A NUDGE' };

/**
 * The hint's reason, in a card that slides in over the top of the board
 * and leaves on its own after a few seconds (or when the next hint
 * replaces it). Key it on the hint so each one animates in.
 */
export function HintNote({ reason, kind, accent, onGone }: { reason: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const show = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(Math.min(6500, 2600 + reason.length * 35)),
      Animated.timing(t, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    show.start(({ finished }) => finished && onGone());
    return () => show.stop();
  }, [t, reason, onGone]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Hint: ${reason}`}
      style={[styles.note, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}
    >
      <View style={[styles.tag, { backgroundColor: accent }]}>
        <Text style={styles.tagText}>{LABEL[kind]}</Text>
      </View>
      <Text style={styles.text}>{reason}</Text>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  note: {
    // Just above the board, never over it - the cell it points at must
    // stay in view.
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 10,
  },
  tag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, marginTop: 1 },
  tagText: { fontFamily: theme.typography.families.mono, fontSize: 8.5, letterSpacing: 1, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  text: { flex: 1, fontSize: theme.typography.sizes.caption + 0.5, lineHeight: 18, color: theme.colors.textPrimary },
}));

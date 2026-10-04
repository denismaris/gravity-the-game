import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { HintKind } from '../game/hints';
import { theme, themedStyles } from '../theme';

const LABEL: Record<HintKind, string> = { fix: 'Fixed', rule: 'Why', nudge: 'Hint' };

/**
 * The hint's reason - and, when there is one, the general pattern behind
 * it - in a card that slides in over the top of the board. It stays long
 * enough to read (longer for a longer explanation), leaves on its own, and
 * a tap sends it away sooner. Key it on the hint so each one animates in.
 */
export function HintNote({ reason, tip, kind, accent, onGone }: { reason: string; tip?: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {
  const t = useRef(new Animated.Value(0)).current;
  const length = reason.length + (tip?.length ?? 0);
  useEffect(() => {
    const show = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(Math.min(12000, 3000 + length * 45)),
      Animated.timing(t, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    show.start(({ finished }) => finished && onGone());
    return () => show.stop();
  }, [t, length, onGone]);
  const dismiss = () => {
    Animated.timing(t, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onGone());
  };
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.note, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}
    >
      <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel={`Hint: ${reason}${tip ? ` Pattern: ${tip}` : ''}. Tap to close.`} style={styles.row}>
        <View style={[styles.tag, { backgroundColor: accent }]}>
          <Text style={styles.tagText}>{LABEL[kind]}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.text}>{reason}</Text>
          {tip ? (
            <Text style={styles.tip}>
              <Text style={styles.tipLabel}>Pattern: </Text>
              {tip}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  note: {
    // Just above the board, never over it - the cell it points at must
    // stay in view.
    position: 'absolute',
    bottom: '100%',
    // Clear of the board's top clue row, in the space above the stage.
    marginBottom: 22,
    left: 0,
    right: 0,
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  body: { flex: 1 },
  tip: { marginTop: 5, fontSize: theme.typography.sizes.caption, lineHeight: 17, color: theme.colors.textSecondary },
  tipLabel: { fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary },
  tag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, marginTop: 1 },
  tagText: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  text: { fontSize: theme.typography.sizes.caption + 0.5, lineHeight: 18, color: theme.colors.textPrimary },
}));

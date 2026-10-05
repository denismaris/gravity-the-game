import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HintKind } from '../game/hints';
import { theme, themedStyles } from '../theme';
import { PressableScale } from './PressableScale';

const TITLE: Record<HintKind, string> = { fix: 'What was wrong', rule: 'Why this move', nudge: 'Why this move' };
const ASK: Record<HintKind, string> = { fix: 'What was wrong?', rule: 'Why this move?', nudge: 'Why this move?' };

/** How long the small pill stays when nobody taps it. */
const PILL_MS = 5500;

/**
 * The explanation behind an Insight, kept out of the way: a small pill at
 * the foot of the screen ("Why this move?") that fades on its own after a
 * few seconds. A tap opens the full reason, and the general pattern behind
 * it, in a panel, for a player who wants to learn the trick.
 *
 * It used to be the full explanation in a card that sprang up after every
 * hint, which covered the controls (or, at its biggest, the puzzle's
 * title) and had to be read or waited out whether the player wanted it or
 * not. Key it on the hint so each one animates in.
 */
export function HintNote({ reason, tip, kind, accent, onGone }: { reason: string; tip?: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {
  const t = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    const show = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(PILL_MS),
      Animated.timing(t, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    show.start(({ finished }) => finished && onGone());
    return () => show.stop();
  }, [t, open, onGone]);

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.anchor, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${ASK[kind]} Tap to read.`}
          onPress={() => {
            t.stopAnimation();
            t.setValue(1);
            setOpen(true);
          }}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        >
          <Text style={[styles.pillSpark, { color: accent }]}>{'✦'}</Text>
          <Text style={styles.pillText}>{ASK[kind]}</Text>
        </PressableScale>
      </Animated.View>
      {open && <HintSheet title={TITLE[kind]} reason={reason} tip={tip} accent={accent} onClose={onGone} />}
    </>
  );
}

function HintSheet({ title, reason, tip, accent, onClose }: { title: string; reason: string; tip?: string; accent: string; onClose: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={[styles.spark, { color: accent }]}>{'✦'}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          <Text style={styles.reason}>{reason}</Text>
          {tip ? (
            <View style={[styles.tip, { borderColor: accent }]}>
              <Text style={[styles.tipLabel, { color: accent }]}>THE PATTERN</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ) : null}
          <PressableScale accessibilityRole="button" accessibilityLabel="Got it" onPress={onClose} style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
            <Text style={styles.doneText}>Got it</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  anchor: { position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pillSpark: { fontSize: 13 },
  pillText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  pressed: { opacity: 0.85 },
  layer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderStrong, marginBottom: theme.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spark: { fontSize: 18 },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  reason: { marginTop: theme.spacing.md, fontSize: theme.typography.sizes.body, lineHeight: 23, color: theme.colors.textPrimary },
  tip: { marginTop: theme.spacing.md, padding: 14, borderRadius: 16, borderWidth: 1, backgroundColor: theme.colors.surfaceHi },
  tipLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2 },
  tipText: { marginTop: 4, fontSize: theme.typography.sizes.caption + 1, lineHeight: 20, color: theme.colors.textPrimary },
  done: { marginTop: theme.spacing.lg, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  doneText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
}));

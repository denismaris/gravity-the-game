import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { HintKind } from '../game/hints';
import { theme, themedStyles } from '../theme';
import { PressableScale } from './PressableScale';

const TITLE: Record<HintKind, string> = { fix: 'What was wrong', rule: 'Why this move', nudge: 'Why this move' };

/** How long the card stays when nobody touches it. Opening the pattern
 * keeps it until it is closed. */
const STAY_MS = 9000;

const IN = FadeInDown.duration(320).easing(Easing.out(Easing.cubic));
const OUT = FadeOutDown.duration(220).easing(Easing.in(Easing.cubic));

/**
 * The reason behind an Insight: one card at the foot of the screen, with
 * the reason in plain words straight away, and the general pattern a tap
 * away for a player who wants to learn the trick.
 *
 * It replaces a small "Why this move?" pill that opened a separate sheet:
 * two steps to read one sentence, and a sheet that vanished on the spot.
 * This card slides up, says it, and slides away - on its own after a few
 * seconds, or when closed. Key it on the hint so each one animates in.
 */
export function HintNote({ reason, tip, kind, accent, onGone }: { reason: string; tip?: string; kind: HintKind; accent: string; onGone: () => void }): React.JSX.Element {
  const [pattern, setPattern] = useState(false);

  useEffect(() => {
    if (pattern) return;
    const id = setTimeout(onGone, STAY_MS);
    return () => clearTimeout(id);
  }, [pattern, onGone]);

  return (
    <Animated.View entering={IN} exiting={OUT} pointerEvents="box-none" style={styles.anchor}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={[styles.spark, { color: accent }]}>{'✦'}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {TITLE[kind]}
          </Text>
          <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onGone} hitSlop={12} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeText}>{'✕︎'}</Text>
          </PressableScale>
        </View>
        <Text style={styles.reason}>{reason}</Text>
        {tip ? (
          pattern ? (
            <Animated.View entering={FadeIn.duration(220)} style={[styles.tip, { borderLeftColor: accent }]}>
              <Text style={styles.tipText}>{tip}</Text>
            </Animated.View>
          ) : (
            <PressableScale accessibilityRole="button" accessibilityLabel="Show the pattern behind this move" onPress={() => setPattern(true)} hitSlop={8} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
              <Text style={[styles.moreText, { color: accent }]}>Show the pattern</Text>
            </PressableScale>
          )
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  anchor: { position: 'absolute', bottom: 10, left: theme.spacing.md, right: theme.spacing.md },
  card: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceHi,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spark: { fontSize: 14 },
  title: { flex: 1, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  closeText: { fontSize: 12, color: theme.colors.textSecondary },
  reason: { marginTop: 6, fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textPrimary },
  more: { marginTop: 8, alignSelf: 'flex-start' },
  moreText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold },
  tip: { marginTop: 10, paddingLeft: 10, borderLeftWidth: 2 },
  tipText: { fontSize: theme.typography.sizes.caption + 1, lineHeight: 20, color: theme.colors.textSecondary },
  pressed: { opacity: 0.7 },
}));

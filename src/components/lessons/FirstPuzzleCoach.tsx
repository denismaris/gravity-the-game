import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accentColorForKind, GameKind } from '../../game/journey';
import { theme, themedStyles } from '../../theme';
import { PressableScale } from '../PressableScale';
import { LESSON_GUIDES } from './guides';

/** How long the coach stays when nobody taps it. */
const COACH_MS = 7000;

/**
 * The bridge from a lesson to the first real board of a game: the goal,
 * one more time, in a small card at the foot of the screen - and, straight
 * after the lesson, word of the free Insight that came with it. Fades on
 * its own; a tap puts it away sooner. Shown over the puzzle by
 * `AppRoutes`, never inside it, so no game screen has to know about it.
 */
export function FirstPuzzleCoach({ kind, gift }: { kind: GameKind; gift: boolean }): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), COACH_MS);
    return () => clearTimeout(id);
  }, []);
  if (!open) return null;
  const accent = accentColorForKind(kind);
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(900).easing(Easing.out(Easing.cubic))}
      exiting={FadeOut.duration(260)}
      pointerEvents="box-none"
      style={[styles.anchor, { bottom: insets.bottom + 8 }]}
    >
      <PressableScale accessibilityRole="button" accessibilityLabel={`Your goal: ${LESSON_GUIDES[kind].goal} Tap to close.`} onPress={() => setOpen(false)} style={[styles.card, { borderColor: accent }]}>
        <Text style={[styles.label, { color: accent }]}>YOUR GOAL</Text>
        <Text style={styles.goal}>{LESSON_GUIDES[kind].goal}</Text>
        <Text style={styles.help}>The ? at the top keeps the rules, any time.</Text>
        {gift && <Text style={styles.gift}>{'✦ A free Insight is yours for this one, if you get stuck.'}</Text>}
      </PressableScale>
    </Animated.View>
  );
}

const styles = themedStyles(() => ({
  anchor: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, zIndex: 40 },
  card: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceHi,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4 },
  goal: { marginTop: 3, fontSize: theme.typography.sizes.body, lineHeight: 21, color: theme.colors.textPrimary },
  help: { marginTop: 6, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  gift: { marginTop: 6, fontSize: theme.typography.sizes.caption, color: theme.colors.accentText },
}));

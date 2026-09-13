import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { TutorialCopy } from '../game/tutorials';
import { motion, theme } from '../theme';

export interface TutorialOverlayProps {
  copy: TutorialCopy;
  onDismiss: () => void;
  /** Colour for the "HOW TO PLAY" eyebrow - defaults to Gravity's own accent
   * (`theme.colors.secondary`), which is correct as-is for every Gravity
   * mechanic tutorial. A game-intro tutorial on another screen passes that
   * game's own accent instead (see `accentColorForKind`), so the very first
   * thing a new player sees for a game already carries its identity. */
  accentColor?: string;
}

/**
 * A one-time "how this works" card, shown the first time a player meets a
 * game or a Gravity mechanic (see `src/game/tutorials.ts`). Unlike
 * `LevelCompleteCard`/`LevelFailedCard` this deliberately does NOT use
 * `pointerEvents="box-none"` - a tutorial's whole point is "read this before
 * you touch anything", so it blocks the board underneath until dismissed,
 * rather than letting swipes/taps reach it through the scrim.
 */
export function TutorialOverlay({
  copy,
  onDismiss,
  accentColor = theme.colors.secondary,
}: TutorialOverlayProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.cardEnter.duration,
      easing: motion.cardEnter.easing,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const opacity = progress;
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.cardEnter.scaleFrom, 1],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>HOW TO PLAY</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Got it"
          onPress={onDismiss}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Got it</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: theme.spacing.xl,
    zIndex: 10,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 360,
  },
  eyebrow: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.secondary,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

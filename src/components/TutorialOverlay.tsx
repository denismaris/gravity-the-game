import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { TutorialCopy } from '../game/tutorials';
import { motion, theme, themedStyles } from '../theme';
import { ModalLayer } from './ModalLayer';

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
  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <ModalLayer zIndex={10}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity, transform: [{ translateY: rise }] }]}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>New on the board</Text>
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
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  // At the foot of the screen, over the controls, with only a light dim:
  // the card explains what is on the board, so the board stays in view.
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 16, 34, 0.22)',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl + theme.spacing.lg,
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
    maxWidth: 380,
    alignSelf: 'stretch',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  eyebrow: {
    fontSize: theme.typography.sizes.caption + 1,
    fontWeight: theme.typography.weights.semibold,
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
}));

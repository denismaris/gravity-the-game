import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { motion, theme } from '../theme';

export interface LevelFailedCardProps {
  /** Restart the level from its beginning. */
  onRetry: () => void;
  /** Leave to the home hub. */
  onExit: () => void;
}

/**
 * Overlay shown over the board the instant a hazard destroys an object
 * (`isPuzzleFailed`). Sibling to `LevelCompleteCard` - same overlay/card
 * shell and entrance animation - but there is nothing to celebrate here: no
 * stars, no move count, just what happened and the one useful next step.
 * "Home" is still reachable, but "Retry" is the primary action since that's
 * what a failed attempt almost always calls for.
 */
export function LevelFailedCard({ onRetry, onExit }: LevelFailedCardProps): React.JSX.Element {
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
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Text style={styles.title}>DESTROYED</Text>
        <Text style={styles.message}>A piece hit a hazard - this attempt is over.</Text>

        <View style={styles.actions}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={onExit}
            hitSlop={8}
            style={({ pressed }) => [styles.button, styles.buttonSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonSecondaryLabel}>Home</Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Retry level"
            onPress={onRetry}
            hitSlop={8}
            style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.buttonPrimaryLabel}>Retry</Text>
          </PressableScale>
        </View>
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
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  title: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    maxWidth: 220,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.danger,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonPrimaryLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  buttonSecondaryLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

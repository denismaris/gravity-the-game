import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme, themedStyles } from '../theme';
import { PressableScale } from './PressableScale';

/**
 * What every popup shares, so they read as one family: the dim behind,
 * the card (corner, shadow, padding), the voice of its words (a small
 * sentence-case kicker in the accent, a display title, a quiet body), and
 * its way out - one full-width button at the foot, and at most a quiet
 * text link under it for the other choice.
 *
 * Each card still arranges its own middle (a medal, a tally, a week of
 * gifts); these are the parts that used to differ for no reason - three
 * corner radii, two kicker styles (spaced capitals in the typewriter face,
 * and sentence case), centred pills beside full-width bars.
 */
export const dialogStyles = themedStyles(() => ({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  card: {
    width: '86%',
    maxWidth: 360,
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  kicker: {
    fontSize: theme.typography.sizes.caption + 1,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  title: {
    marginTop: 2,
    fontFamily: theme.typography.families.display,
    fontSize: 32,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: { alignSelf: 'stretch', alignItems: 'center', gap: 2, marginTop: theme.spacing.lg },
  primaryWrap: { alignSelf: 'stretch' },
  primary: { height: 52, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  primaryText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  quiet: { paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  quietText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  pressed: { opacity: 0.85 },
}));

export interface DialogAction {
  readonly label: string;
  readonly onPress: () => void;
  /** Defaults to the label. */
  readonly accessibilityLabel?: string;
}

/** A popup's way out: the main choice full width, the other a quiet link. */
export function DialogActions({ primary, secondary }: { primary: DialogAction; secondary?: DialogAction }): React.JSX.Element {
  return (
    <View style={dialogStyles.actions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={primary.accessibilityLabel ?? primary.label}
        onPress={primary.onPress}
        containerStyle={dialogStyles.primaryWrap}
        style={({ pressed }) => [dialogStyles.primary, pressed && dialogStyles.pressed]}
      >
        <Text style={dialogStyles.primaryText}>{primary.label}</Text>
      </PressableScale>
      {secondary && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
          onPress={secondary.onPress}
          hitSlop={8}
          style={({ pressed }) => [dialogStyles.quiet, pressed && dialogStyles.pressed]}
        >
          <Text style={dialogStyles.quietText}>{secondary.label}</Text>
        </PressableScale>
      )}
    </View>
  );
}

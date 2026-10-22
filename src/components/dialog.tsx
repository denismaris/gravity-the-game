import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { motion, getColorScheme, theme, themedStyles } from '../theme';
import { Canvas, Path } from '@shopify/react-native-skia';
import { PressableScale } from './PressableScale';
import { RaisedKey } from './RaisedKey';
import { shade } from '../game/rendering';

/** How far each dialog key stands on its lip. */
const PRIMARY_LIP = 5;
const QUIET_LIP = 3;

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
  actions: { alignSelf: 'stretch', alignItems: 'stretch', gap: 10, marginTop: theme.spacing.lg },
  primaryWrap: { alignSelf: 'stretch' },
  primaryText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, letterSpacing: 0.3, color: theme.colors.surfaceHi },
  /** The arrow's disc, at the key's right end - the label stays centred. */
  onward: { position: 'absolute', right: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quietText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
}));

export interface DialogAction {
  readonly label: string;
  readonly onPress: () => void;
  /** Defaults to the label. */
  readonly accessibilityLabel?: string;
  /** Leads on to the next thing (Next puzzle, Continue): carries an arrow. */
  readonly onward?: boolean;
}

/** A popup's way out: the main choice full width, the other a quiet link. */
export function DialogActions({ primary, secondary }: { primary: DialogAction; secondary?: DialogAction }): React.JSX.Element {
  return (
    <View style={dialogStyles.actions}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={primary.accessibilityLabel ?? primary.label}
        onPress={primary.onPress}
        scaleTo={1}
        holdMs={motion.beat.pressHold}
        containerStyle={dialogStyles.primaryWrap}
      >
        <RaisedKey height={52} lip={PRIMARY_LIP} face={theme.colors.primary} edge={primaryEdge()}>
          <Text style={dialogStyles.primaryText}>{primary.label}</Text>
          {primary.onward && (
            <View style={[dialogStyles.onward, { backgroundColor: onwardDisc() }]}>
              <OnwardArrow />
            </View>
          )}
        </RaisedKey>
      </PressableScale>
      {secondary && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={secondary.accessibilityLabel ?? secondary.label}
          onPress={secondary.onPress}
          scaleTo={1}
          holdMs={motion.beat.pressHold}
          containerStyle={dialogStyles.primaryWrap}
        >
          <RaisedKey height={44} lip={QUIET_LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border}>
            <Text style={dialogStyles.quietText}>{secondary.label}</Text>
          </RaisedKey>
        </PressableScale>
      )}
    </View>
  );
}

/** The primary key's edge: its ink, a good deal deeper - by night, when the
 * ink is pale, a little deeper only. */
function primaryEdge(): string {
  return shade(theme.colors.primary, getColorScheme() === 'dark' ? 0.72 : 0.5);
}

/** The disc the onward arrow sits in: a shade off the key's own face. */
function onwardDisc(): string {
  return getColorScheme() === 'dark' ? shade(theme.colors.primary, 0.88) : shade(theme.colors.primary, 1.45);
}

/** A small drawn arrow after a label that leads on to the next thing. */
function OnwardArrow(): React.JSX.Element {
  const ink = theme.colors.surfaceHi;
  return (
    <Canvas style={{ width: 16, height: 14 }}>
      <Path path="M 1.5 7 L 13.5 7 M 8.5 2 L 13.5 7 L 8.5 12" color={ink} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" />
    </Canvas>
  );
}

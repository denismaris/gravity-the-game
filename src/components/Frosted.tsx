import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { getColorScheme, theme, themedStyles } from '../theme';

/**
 * Frosted glass behind a finish screen: the live screen blurred until only
 * its colours are left, then a wash of the page's own paper over it so it
 * keeps the almanac's warmth rather than the system's grey. The board is
 * still there, soft; nothing behind can be read, or competes with what is
 * written in front.
 *
 * The blur is the system's own (UIVisualEffectView on iOS, BlurView on
 * Android), so it blurs everything drawn behind, Skia boards included,
 * and costs no JavaScript per frame. Snapshotting the screen into Skia and
 * blurring that, the first attempt, crashed on iOS.
 */
export function Frosted(): React.JSX.Element {
  const dark = getColorScheme() === 'dark';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurView style={StyleSheet.absoluteFill} blurType={dark ? 'dark' : 'light'} blurAmount={22} reducedTransparencyFallbackColor={theme.colors.background} overlayColor="transparent" />
      <View style={styles.wash} />
    </View>
  );
}

const styles = themedStyles(() => ({
  /** The paper over the blur: see-through enough to show the board's colour. */
  wash: { ...StyleSheet.absoluteFill, backgroundColor: `${theme.colors.background}99` },
}));

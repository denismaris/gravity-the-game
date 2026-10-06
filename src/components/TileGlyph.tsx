import React from 'react';
import { View } from 'react-native';
import { theme, themedStyles } from '../theme';

/** A tile, for the purse: a small cream square on a dark one. */
export function TileGlyph({ light = false, size = 14 }: { light?: boolean; size?: number }): React.JSX.Element {
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size * 0.22 }, light && styles.glyphLight]}>
      <View style={[styles.glyphInner, { width: size * 0.42, height: size * 0.42 }, light && styles.glyphInnerLight]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  glyph: { backgroundColor: theme.colors.secondary, alignItems: 'center', justifyContent: 'center' },
  glyphLight: { backgroundColor: theme.colors.surfaceHi },
  glyphInner: { borderRadius: 2, backgroundColor: theme.colors.surfaceHi },
  glyphInnerLight: { backgroundColor: theme.colors.secondary },
}));

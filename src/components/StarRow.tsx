import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

export interface StarRowProps {
  /** How many of the three stars are filled (0-3). */
  earned: number;
  /** Pixel size of each star glyph. */
  size?: number;
  style?: ViewStyle;
}

const SLOTS = [1, 2, 3];

/**
 * The shared three-star readout: three star glyphs, the first `earned` of
 * them filled in the accent colour, the rest drawn as faint outlines. Used
 * on both the level-select rows and the level-complete card so mastery
 * always looks the same everywhere.
 */
export function StarRow({ earned, size = 16, style }: StarRowProps): React.JSX.Element {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="text"
      accessibilityLabel={`${Math.max(0, Math.min(3, earned))} of 3 stars`}
    >
      {SLOTS.map(slot => (
        <Text
          key={slot}
          style={[
            styles.star,
            { fontSize: size },
            slot <= earned ? styles.earned : styles.empty,
          ]}
        >
          {'★'}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  star: {
    marginHorizontal: 1.5,
  },
  earned: {
    color: theme.colors.accent,
  },
  empty: {
    color: theme.colors.border,
  },
});

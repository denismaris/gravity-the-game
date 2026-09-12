/* eslint-disable react-native/no-inline-styles -- glyph geometry is derived from `size` at render time */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';

export type GameMarkName = 'gravity' | 'daily' | 'archive';

export interface GameMarkProps {
  name: GameMarkName;
  /** Box size in dp. Default 26. */
  size?: number;
  /** Stroke / fill colour. Default `textSecondary`. */
  color?: string;
}

/**
 * Small hand-built glyphs that give each mode its own identity in the
 * index - drawn from plain Views (no icon font, no emoji) so they inherit
 * colour and stay crisp at any size.
 *
 *  - gravity: a body with a fall line beneath it
 *  - daily:   a ring around today's point
 *  - archive: a stack of past entries
 */
export function GameMark({ name, size = 26, color = theme.colors.textSecondary }: GameMarkProps): React.JSX.Element {
  const u = size / 26; // scale unit

  if (name === 'gravity') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View
          style={{
            width: 9 * u,
            height: 9 * u,
            borderRadius: 5 * u,
            backgroundColor: color,
            marginBottom: 3 * u,
          }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 5 * u,
            borderRightWidth: 5 * u,
            borderTopWidth: 6 * u,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'daily') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View
          style={{
            width: 20 * u,
            height: 20 * u,
            borderRadius: 11 * u,
            borderWidth: Math.max(1.5, 2 * u),
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 7 * u, height: 7 * u, borderRadius: 4 * u, backgroundColor: color }} />
        </View>
      </View>
    );
  }

  // archive: three stacked bars
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {[18, 14, 10].map((w, i) => (
        <View
          key={i}
          style={{
            width: w * u,
            height: Math.max(2, 2.4 * u),
            borderRadius: 2 * u,
            backgroundColor: color,
            marginTop: i === 0 ? 0 : 4 * u,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

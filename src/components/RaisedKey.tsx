import React, { useContext } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { inkWash } from '../theme';
import { PressDepth } from './PressableScale';
import { FixedTextCap, MAX_TEXT_SCALE } from './Text';

export interface RaisedKeyProps {
  /** The face's height; the key takes `lip` (and a little shadow) more. */
  readonly height: number;
  /** A fixed width - equal to `height` for a round key. Omitted, the key
   * is as wide as its contents (and padding), or as its parent stretches it. */
  readonly width?: number;
  /** How far the face stands above its edge. */
  readonly lip: number;
  readonly face: string;
  /** The edge under the face - the face's own colour, deeper. */
  readonly edge: string;
  /** A fine rim round the face, for a pale key on a pale ground. */
  readonly rim?: string;
  /** Padding inside the face, for a key sized by its contents. */
  readonly padding?: number;
  /** Space between the things on the face. */
  readonly gap?: number;
  /** Shown but not pressable: the key fades back. */
  readonly idle?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: React.ReactNode;
}

/**
 * A key that stands on its own edge: a soft shadow on the ground, the
 * edge, and the face on top - three shapes, no gradient, no border trick.
 * Inside a `PressableScale` the face sinks onto its edge as it is pressed
 * and rises as it is let go; nothing around it moves, and the key never
 * changes size. Every pressable key in the app is one of these.
 *
 * (Drawn as a bottom border before, the edge pinched to nothing at the
 * round ends, and the press - a thinner border - grew the face.)
 */
export function RaisedKey({ height, width, lip, face, edge, rim, padding = 0, gap = 0, idle = false, style, children }: RaisedKeyProps): React.JSX.Element {
  const depth = useContext(PressDepth);
  const radius = height / 2;
  const sink = depth ? { transform: [{ translateY: depth.interpolate({ inputRange: [0, 1], outputRange: [0, lip - 1] }) }] } : null;
  return (
    <View style={[{ paddingBottom: lip + 3, width }, idle && styles.idle, style]}>
      <View style={[styles.layer, { top: lip + 3, height, borderRadius: radius, backgroundColor: inkWash(0.1) }]} />
      <View style={[styles.layer, { top: lip, height, borderRadius: radius, backgroundColor: edge }]} />
      <Animated.View style={[styles.face, { height, borderRadius: radius, backgroundColor: face, paddingHorizontal: padding, gap }, rim ? { borderWidth: 1, borderColor: rim } : null, sink]}>
        {/* A key keeps its height: its label grows no further than the
            usual cap, Larger Text or not. */}
        <FixedTextCap.Provider value={MAX_TEXT_SCALE}>{children}</FixedTextCap.Provider>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0 },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  idle: { opacity: 0.45 },
});

import React, { useContext } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { inkWash } from '../theme';
import { PressDepth } from './PressableScale';

export interface RaisedKeyProps {
  /** The face's height; the key takes `lip` more below it. */
  readonly height: number;
  /** How far the face stands above its edge. */
  readonly lip: number;
  readonly face: string;
  /** The edge under the face - the face's own colour, deeper. */
  readonly edge: string;
  /** A fine rim round the face, for a pale key on a pale card. */
  readonly rim?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly children?: React.ReactNode;
}

/**
 * A key that stands on its own edge: a soft shadow on the card, the edge,
 * and the face on top - three shapes, no gradient, no border trick. Inside
 * a `PressableScale` the face sinks onto its edge as it is pressed and
 * rises as it is let go; nothing around it moves, and the key never
 * changes size.
 *
 * (Drawn as a bottom border before, the edge pinched to nothing at the
 * round ends, and the press - a thinner border - grew the face.)
 */
export function RaisedKey({ height, lip, face, edge, rim, style, children }: RaisedKeyProps): React.JSX.Element {
  const depth = useContext(PressDepth);
  const radius = height / 2;
  const sink = depth ? { transform: [{ translateY: depth.interpolate({ inputRange: [0, 1], outputRange: [0, lip - 1] }) }] } : null;
  return (
    <View style={[{ height: height + lip + 3 }, style]}>
      <View style={[styles.layer, { top: lip + 3, height, borderRadius: radius, backgroundColor: inkWash(0.1) }]} />
      <View style={[styles.layer, { top: lip, height, borderRadius: radius, backgroundColor: edge }]} />
      <Animated.View style={[styles.layer, styles.face, { top: 0, height, borderRadius: radius, backgroundColor: face }, rim ? { borderWidth: 1, borderColor: rim } : null, sink]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0 },
  face: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

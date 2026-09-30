import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { theme, themedStyles } from '../theme';

/**
 * A progress bar that fills to `share` on the native driver - a scaled
 * fill, never an animated width - with fine ticks along it, the way a
 * rule is marked off in an almanac. It fills from where it was, so a gain
 * is seen being added rather than the bar simply being longer.
 */
export function XpBar({ share, color = theme.colors.accent, ticks = 10, height = 8, style }: { share: number; color?: string; ticks?: number; height?: number; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: Math.max(0, Math.min(1, share)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [share, fill]);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.fill,
          {
            width,
            borderRadius: height / 2,
            backgroundColor: color,
            transform: [
              { translateX: fill.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, 0] }) },
              { scaleX: fill.interpolate({ inputRange: [0, 1], outputRange: [0.0001, 1] }) },
            ],
          },
        ]}
      />
      {Array.from({ length: Math.max(0, ticks - 1) }, (_v, i) => (
        <View key={i} style={[styles.tick, { left: ((i + 1) / ticks) * width }]} />
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  track: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    width: 1,
    backgroundColor: theme.colors.track,
  },
}));

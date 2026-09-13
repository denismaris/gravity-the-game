import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { theme } from '../theme';

/** Kept inside the palette instead of introducing new colour - this is a
 * celebration, not a rebrand. */
const COLORS = [theme.colors.secondary, theme.colors.accent, theme.colors.success, theme.colors.pieceBlue];
const COUNT = 14;

interface Piece {
  readonly angle: number;
  readonly distance: number;
  readonly size: number;
  readonly color: string;
  readonly spin: number;
}

/** Deterministic scatter (no `Math.random`, so this stays pure/reproducible)
 * - a fixed spread of angles/sizes/colours that still reads as "confetti",
 * not a perfect circle of identical dots. */
function makePieces(): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    angle: (i / COUNT) * Math.PI * 2 + (i % 2 === 0 ? 0.16 : -0.11),
    distance: 68 + ((i * 37) % 46),
    size: 6 + ((i * 13) % 7),
    color: COLORS[i % COLORS.length],
    spin: (i * 53) % 360,
  }));
}

/**
 * A one-shot radial burst of small dots behind the solved card - the one
 * moment in an otherwise quiet, restrained design that's allowed to be a
 * little showy. Pure decoration: `pointerEvents="none"`, no game logic, and
 * it only ever plays once per mount (both call sites mount it fresh exactly
 * when a puzzle is freshly solved).
 */
export function ConfettiBurst(): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef(makePieces()).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(p.angle) * p.distance],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(p.angle) * p.distance],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.15, 0.7, 1],
          outputRange: [0, 1, 1, 0],
        });
        const scale = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.3, 1, 0.7] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });

        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                borderRadius: p.size * 0.3,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});

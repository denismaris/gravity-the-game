import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { triggerHaptic } from '../game/rendering';
import { theme, themedStyles } from '../theme';

export interface StarRowProps {
  /** How many of the three stars are filled (0-3). */
  earned: number;
  /** Pixel size of each star glyph. */
  size?: number;
  style?: ViewStyle;
  /** Pop each star in with a staggered spring instead of showing them
   * flat/static. Only meaningful the moment this row first appears - both
   * call sites mount a fresh `StarRow` exactly when a puzzle is freshly
   * solved, so "on mount" already means "the moment worth celebrating". */
  animateIn?: boolean;
}

const SLOTS = [1, 2, 3];

/**
 * The shared three-star readout: three star glyphs, the first `earned` of
 * them filled in the accent colour, the rest drawn as faint outlines. Used
 * on both the level-select rows and the level-complete card so mastery
 * always looks the same everywhere.
 */
export function StarRow({ earned, size = 16, style, animateIn = false }: StarRowProps): React.JSX.Element {
  const pop = useRef(SLOTS.map(() => new Animated.Value(animateIn ? 0 : 1))).current;

  useEffect(() => {
    if (!animateIn) return;
    // Each star lands on its own beat, a touch slower than a flicker so
    // the count reads as one, two, three - and each earned one is felt
    // as it lands. The solve's own chime has already played, so this is
    // touch only.
    const timers = SLOTS.map((slot, i) =>
      setTimeout(() => {
        if (slot <= earned) triggerHaptic(i === earned - 1 ? 'targetReached' : 'tap');
      }, 260 + i * 170 + 120),
    );
    Animated.sequence([
      Animated.delay(260),
      Animated.stagger(
        170,
        pop.map(value => Animated.spring(value, { toValue: 1, useNativeDriver: true, damping: 11, stiffness: 220, mass: 0.9 })),
      ),
    ]).start();
    return () => timers.forEach(clearTimeout);
    // Mount-only: `animateIn` is the "should this instance ever animate"
    // switch, not a re-trigger. `pop` is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="text"
      accessibilityLabel={`${Math.max(0, Math.min(3, earned))} of 3 stars`}
    >
      {SLOTS.map((slot, i) => {
        const isEarned = slot <= earned;
        return (
          <View key={slot} style={styles.slot}>
            {/* A ring snapping outward as the star lands, then fading -
                the little "impact" that makes an earned star feel won
                rather than just displayed. Earned stars only: firing it
                behind an empty outline would celebrate a miss. Purely
                decorative, so it never intercepts touches. */}
            {animateIn && isEarned && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.burst,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: Math.max(1.5, size * 0.06),
                    opacity: pop[i].interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0.5, 0] }),
                    transform: [{ scale: pop[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }],
                  },
                ]}
              />
            )}
            <Animated.Text
              style={[
                styles.star,
                {
                  fontSize: size,
                  // Stamped down: in from slightly large and turned, the
                  // way a rubber stamp meets paper.
                  transform: [
                    { scale: animateIn && isEarned ? pop[i].interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) : pop[i] },
                    { rotate: animateIn && isEarned ? pop[i].interpolate({ inputRange: [0, 1], outputRange: ['-24deg', '0deg'] }) : '0deg' },
                  ],
                  opacity: animateIn ? pop[i].interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }) : 1,
                },
                isEarned ? styles.earned : styles.empty,
              ]}
            >
              {'★'}
            </Animated.Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: 'row',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
    borderColor: theme.colors.accent,
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
}));

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GAME_RULES, GameKind, accentColorForKind, gameDisplayName } from '../game/journey';
import { isReducedMotion, readableOn, triggerFeedback } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { curve } from '../theme/motion';
import { ConfettiBurst } from './ConfettiBurst';
import { DialogActions } from './dialog';
import { Frosted } from './Frosted';
import { GameEmblem } from './GameEmblem';
import { ModalLayer } from './ModalLayer';
import { glide, settle, slice } from './placeMotion';
import { Text } from './Text';

/**
 * A new game arriving, greeted once: its emblem dropped into place the way
 * the level card places the games of a set, its name, and its rule in a
 * sentence, over the frosted Home. The game earned its place by the player
 * getting good at the last one; this is the moment that says so.
 */
export function GameArrival({ kind, onPlay, onLater }: { kind: GameKind; onPlay: () => void; onLater: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const t = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const accent = readableOn(accentColorForKind(kind), theme.colors.background, theme.colors.textPrimary);
  useEffect(() => {
    triggerFeedback('solved');
    Animated.timing(t, { toValue: 1, duration: 1300, easing: curve.linear, useNativeDriver: true }).start();
  }, [t]);
  const line = (from: number, to: number) => ({
    opacity: slice(t, from, to, glide, [0, 1]),
    transform: [{ translateY: slice(t, from, to, glide, [12, 0]) }],
  });
  return (
    <ModalLayer>
      <View style={styles.overlay} onStartShouldSetResponder={() => true} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: slice(t, 0, 0.2, glide, [0, 1]) }]} pointerEvents="none">
          <Frosted />
        </Animated.View>
        <ConfettiBurst />
        <View style={[styles.page, { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.md }]}>
          <View style={styles.above} />
          <View style={styles.column}>
            <Animated.View
              style={{
                opacity: slice(t, 0.1, 0.25, glide, [0, 1]),
                transform: [
                  { translateY: slice(t, 0.1, 0.45, settle, [-40, 0]) },
                  { scale: slice(t, 0.1, 0.45, settle, [0.5, 1]) },
                  { rotate: slice(t, 0.1, 0.45, glide, [-12, 0]).interpolate({ inputRange: [-12, 0], outputRange: ['-12deg', '0deg'] }) },
                ],
              }}
            >
              <GameEmblem kind={kind} size={104} raised />
            </Animated.View>
            <Animated.Text maxFontSizeMultiplier={1.3} style={[styles.kicker, { color: accent }, line(0.35, 0.6)]}>
              A new game
            </Animated.Text>
            <Animated.View style={line(0.42, 0.68)}>
              <Text style={styles.name} accessibilityRole="header">
                {gameDisplayName(kind)}
              </Text>
            </Animated.View>
            <Animated.View style={line(0.52, 0.8)}>
              <Text style={styles.rule}>{GAME_RULES[kind]}</Text>
            </Animated.View>
          </View>
          <View style={styles.below} />
          <Animated.View style={[styles.actions, line(0.65, 0.95)]}>
            <DialogActions primary={{ label: 'Play it', onPress: onPlay, onward: true }} secondary={{ label: 'Later', onPress: onLater }} />
          </Animated.View>
        </View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  overlay: { ...StyleSheet.absoluteFill },
  page: { flex: 1, paddingHorizontal: theme.spacing.xl },
  above: { flex: 1 },
  below: { flex: 1.3 },
  column: { alignSelf: 'center', width: '100%', maxWidth: 420, alignItems: 'center' },
  kicker: { marginTop: theme.spacing.xl, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, letterSpacing: 1.8, textTransform: 'uppercase', textAlign: 'center' },
  name: { marginTop: 6, fontFamily: theme.typography.families.display, fontSize: 44, lineHeight: 50, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  rule: { marginTop: theme.spacing.md, fontSize: theme.typography.sizes.subtitle, lineHeight: theme.typography.lineHeights.subtitle, color: theme.colors.textSecondary, textAlign: 'center' },
  actions: { alignSelf: 'center', width: '100%', maxWidth: 420 },
}));

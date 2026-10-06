import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { rankTitle } from '../progression/rank';
import { motion, theme, themedStyles } from '../theme';
import { CoinsEarned } from './Coins';
import { ConfettiBurst } from './ConfettiBurst';
import { PressableScale } from './PressableScale';
import { medalMetal, RankMedal } from './RankMedal';
import { ModalLayer } from './ModalLayer';

const RAYS = 18;
/** The sunburst's size - inside the card, never spilling onto the scrim. */
const BURST = 196;

function sunburstSvg(size: number): string {
  const c = size / 2;
  let d = '';
  for (let i = 0; i < RAYS; i += 1) {
    const a = (i / RAYS) * Math.PI * 2;
    const w = Math.PI / RAYS / 2.8;
    const r = c;
    d += `M ${c} ${c} L ${(c + Math.cos(a - w) * r).toFixed(1)} ${(c + Math.sin(a - w) * r).toFixed(1)} L ${(c + Math.cos(a + w) * r).toFixed(1)} ${(c + Math.sin(a + w) * r).toFixed(1)} Z `;
  }
  return d;
}

/**
 * The rank-up moment: the new medal spins in on a spring in front of a
 * slowly turning sunburst in its own metal, the title is set beneath it,
 * and the coins the rank pays are shown landing. One button to take it.
 * Everything moves on the native driver.
 */
export function RankUpCard({ rank, ranksGained, coins, onDone }: { rank: number; ranksGained: number; coins: number; onDone: () => void }): React.JSX.Element {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const medal = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const metal = medalMetal(rank);
  const burst = useMemo(() => sunburstSvg(BURST), []);

  useEffect(() => {
    triggerFeedback('solved');
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.sequence([Animated.delay(160), Animated.spring(medal, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 120, mass: 1 })]).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [enter, medal, spin, reduced]);

  return (
    <ModalLayer zIndex={50}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.scrim, { opacity: enter }]} />
        <ConfettiBurst />
        <Animated.View
          style={[
            styles.card,
            { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) }] },
          ]}
        >
          <Text style={styles.kicker}>{ranksGained > 1 ? `${ranksGained} RANKS GAINED` : 'NEW RANK'}</Text>
          <View style={styles.stage}>
            <Animated.View style={[styles.burst, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
              <Canvas style={styles.burstCanvas}>
                <Path path={burst} color={metal.star} opacity={0.42} />
              </Canvas>
            </Animated.View>
            <Animated.View
              style={{
                opacity: medal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
                transform: [{ scale: medal.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: medal.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) }],
              }}
            >
              <RankMedal rank={rank} size={128} />
            </Animated.View>
          </View>
          <Text style={styles.title}>{rankTitle(rank)}</Text>
          <Text style={styles.body}>Every star, puzzle and errand moves you further along the road.</Text>
          <CoinsEarned amount={coins} style={styles.coins} />
          <PressableScale accessibilityRole="button" accessibilityLabel="Collect" onPress={onDone} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Collect</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.overlay },
  card: {
    width: '84%',
    maxWidth: 360,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  kicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 2, color: theme.colors.secondary },
  stage: { width: 220, height: 180, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: BURST, height: BURST },
  burstCanvas: { width: BURST, height: BURST },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline + 4,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: { marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  coins: { marginTop: theme.spacing.md },
  button: { marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.md, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  pressed: { opacity: 0.85 },
  buttonText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.semibold },
}));

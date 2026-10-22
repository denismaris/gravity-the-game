import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text } from './Text';
import { Canvas, Path } from '@shopify/react-native-skia';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { rankTitle } from '../progression/rank';
import { motion, theme, themedStyles } from '../theme';
import { CoinsEarned } from './Coins';
import { ConfettiBurst } from './ConfettiBurst';
import { medalMetal, RankMedal } from './RankMedal';
import { MODAL_EXIT_MS, ModalLayer } from './ModalLayer';
import { DialogActions, dialogStyles } from './dialog';
import { curve } from '../theme/motion';

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
    // It can follow the day's gift: it arrives once that card has gone.
    Animated.sequence([Animated.delay(MODAL_EXIT_MS), Animated.timing(enter, { toValue: 1, duration: 340, easing: curve.arrive, useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(MODAL_EXIT_MS + 160), Animated.spring(medal, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 120, mass: 1 })]).start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [enter, medal, spin, reduced]);

  return (
    <ModalLayer zIndex={50}>
      <View style={dialogStyles.overlay}>
        <Animated.View style={[dialogStyles.scrim, { opacity: enter }]} />
        <ConfettiBurst />
        <Animated.View
          style={[
            dialogStyles.card,
            { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) }] },
          ]}
        >
          <Text style={dialogStyles.kicker}>{ranksGained > 1 ? `${ranksGained} ranks gained` : 'New rank'}</Text>
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
          <Text style={dialogStyles.title}>{rankTitle(rank)}</Text>
          <Text style={dialogStyles.body}>Every star, puzzle and errand moves you further along the road.</Text>
          <CoinsEarned amount={coins} style={styles.coins} />
          <DialogActions primary={{ label: 'Collect', onPress: onDone, accessibilityLabel: `Collect ${coins} coins` }} />
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  stage: { width: 220, height: 180, marginTop: theme.spacing.md, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: BURST, height: BURST },
  burstCanvas: { width: BURST, height: BURST },
  coins: { marginTop: theme.spacing.md },
}));

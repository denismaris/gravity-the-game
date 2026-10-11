import React, { useEffect, useMemo } from 'react';
import { Platform, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useCanvasRef } from '@shopify/react-native-skia';
import { PIECES_PER_VILLA, VillaPlan } from '../../progression/villa';
import { triggerFeedback, useReducedMotion } from '../../game/rendering';
import { theme, themedStyles } from '../../theme';
import { ModalLayer } from '../ModalLayer';
import { DialogActions } from '../dialog';
import { VillaIsland } from './VillaIsland';

/**
 * A villa finished: the one big moment of the Villas, so it gets its own
 * card rather than a toast. The finished island under its sky, framed like
 * a postcard, with tiles drifting down past it once; the villa's name; and
 * two ways on - keep the picture (share it), or go and see the next island.
 */
export function VillaFinished({ plan, night, onClose }: { plan: VillaPlan; night: boolean; onClose: () => void }): React.JSX.Element {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const canvasRef = useCanvasRef();
  const cardWidth = Math.min(width * 0.88, 360);
  const pictureWidth = cardWidth - 28;
  const pictureHeight = pictureWidth * 0.86;

  useEffect(() => {
    triggerFeedback('villaFinish');
  }, []);

  const share = async () => {
    const message = `${plan.name}, my villa no. ${plan.index + 1} on Tessellatum. Built one puzzle at a time.`;
    // iOS shares the picture itself; Android's share sheet takes text only.
    let url: string | undefined;
    if (Platform.OS === 'ios') {
      try {
        const image = await canvasRef.current?.makeImageSnapshotAsync();
        const base64 = image?.encodeToBase64();
        if (base64) url = `data:image/png;base64,${base64}`;
      } catch {
        // No picture; the words still go.
      }
    }
    Share.share(url ? { message, url } : { message }).catch(() => {});
  };

  return (
    <ModalLayer zIndex={60}>
      <Animated.View entering={FadeIn.duration(260)} style={styles.scrim} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={reduced ? FadeIn.duration(200) : FadeInDown.duration(520).easing(Easing.out(Easing.cubic))} style={[styles.card, { width: cardWidth }]}>
          <View style={styles.picture}>
            <VillaIsland plan={plan} built={PIECES_PER_VILLA} width={pictureWidth} height={pictureHeight} night={night} sky canvasRef={canvasRef} />
            {!reduced && <FallingTiles width={pictureWidth} height={pictureHeight} colors={[plan.look.wall, plan.look.roof, plan.look.shutter]} />}
          </View>
          <Animated.View entering={FadeInDown.duration(420).delay(260)} style={styles.text}>
            <Text style={styles.kicker}>{`Villa no. ${plan.index + 1} finished`}</Text>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {plan.name}
            </Text>
            <Text style={styles.body}>Every tile of it from a puzzle you solved. The next island is already rising.</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(420).delay(380)} style={styles.actions}>
            <DialogActions primary={{ label: 'See the next villa', onPress: onClose }} secondary={{ label: 'Share it', onPress: share, accessibilityLabel: `Share ${plan.name}` }} />
          </Animated.View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

/** A handful of tiles, in the villa's own colours, drifting down past the
 * picture once - the tiles that built it, settling. */
function FallingTiles({ width, height, colors }: { width: number; height: number; colors: ReadonlyArray<string> }): React.JSX.Element {
  const tiles = useMemo(
    () =>
      Array.from({ length: 16 }, (_v, i) => {
        // Spread evenly, nudged by a fixed pattern (no randomness per render).
        const x = ((i * 0.618) % 1) * (width - 12);
        return { x, delay: 200 + ((i * 137) % 900), size: 6 + (i % 3) * 2, color: colors[i % colors.length], spin: (i % 2 === 0 ? 1 : -1) * (90 + (i % 4) * 40), drift: ((i % 5) - 2) * 6 };
      }),
    [width, colors],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tiles.map((tile, i) => (
        <FallingTile key={i} {...tile} height={height} />
      ))}
    </View>
  );
}

function FallingTile({ x, delay, size, color, spin, drift, height }: { x: number; delay: number; size: number; color: string; spin: number; drift: number; height: number }): React.JSX.Element {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1700, easing: Easing.in(Easing.quad) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : t.value < 0.8 ? 0.9 : 0.9 * (1 - (t.value - 0.8) / 0.2),
    transform: [{ translateY: -20 + t.value * (height + 20) }, { translateX: drift * t.value }, { rotate: `${spin * t.value}deg` }],
  }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: size, height: size, borderRadius: size * 0.2, backgroundColor: color }, style]} />;
}

const styles = themedStyles(() => ({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  card: {
    padding: 14,
    paddingBottom: theme.spacing.md,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  picture: { borderRadius: 20, overflow: 'hidden' },
  text: { alignItems: 'center', paddingHorizontal: theme.spacing.sm, paddingTop: theme.spacing.md, gap: 4 },
  kicker: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  title: { fontFamily: theme.typography.families.display, fontSize: 32, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  body: { fontSize: theme.typography.sizes.body, lineHeight: 21, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280 },
  actions: { alignSelf: 'stretch' },
  primaryWrap: { alignSelf: 'stretch' },
  primary: { height: 52, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  primaryText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  quiet: { paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  quietText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  pressed: { opacity: 0.85 },
}));

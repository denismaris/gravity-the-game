import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { PageBloom } from '../components/PageBloom';
import { TileGlyph } from '../components/TileGlyph';
import { VillaIsland } from '../components/villa/VillaIsland';
import { VillaSky } from '../components/villa/VillaSky';
import { triggerFeedback } from '../game/rendering';
import { currentVilla, DAILY_TESSERAE, PIECES_PER_VILLA, usePlayerProgress, villaAt } from '../progression';
import { useAppearance } from '../settings';
import { theme, themedStyles } from '../theme';

/** TEMPORARY, for trying the Villa out: shows a "+100 test tiles" button.
 * Turn off (false) before a store build. */
export const VILLA_TEST_TILES = true;

export interface VillaScreenProps {
  onExit: () => void;
}

/**
 * The Villas: the one being built, on its island under the sky, with the
 * next piece and what it costs in tiles; and every villa already finished,
 * in a row underneath. Building plays the new piece into the island; the
 * last piece of a villa finishes it, and the next island appears.
 */
export function VillaScreen({ onExit }: VillaScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { progress, buildVillaPiece, adoptProgress } = usePlayerProgress();
  const night = useAppearance() === 'dark';
  const { plan, built, finished } = currentVilla(progress);
  const next = plan.pieces[built];
  const [fresh, setFresh] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  const sceneWidth = width - theme.spacing.lg * 2;
  const short = Math.max(0, next.cost - progress.tesserae);
  const done = useMemo(() => Array.from({ length: finished }, (_v, i) => villaAt(finished - 1 - i)), [finished]);

  const build = () => {
    const last = built === PIECES_PER_VILLA - 1;
    if (!buildVillaPiece(next.id)) return;
    triggerFeedback('coin');
    // The last piece finishes this villa: it joins the row below and the
    // next island rises, so there is nothing to settle in place.
    setFresh(last ? null : built);
    setToast({ text: last ? `${plan.name} is finished` : `Built: ${next.name}`, at: Date.now() });
  };

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Villas</Text>
        </View>
        <View style={[styles.headerSide, styles.headerRight]}>
          <View style={styles.purse} accessibilityLabel={`${progress.tesserae} tiles`}>
            <TileGlyph />
            <Text style={styles.purseText}>{progress.tesserae}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.sceneFrame}>
          <VillaSky width={sceneWidth} height={sceneWidth * 0.92} night={night} />
          <View style={styles.island}>
            <VillaIsland key={plan.index} plan={plan} built={built} width={sceneWidth} height={sceneWidth * 0.92} night={night} fresh={fresh} />
          </View>
          {toast && (
            <Animated.View key={toast.at} entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(260)} style={styles.toast} pointerEvents="none">
              <Text style={styles.toastText}>{toast.text}</Text>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(120).easing(Easing.out(Easing.cubic))}>
          <View style={styles.villaHead}>
            <Text style={styles.villaName}>{plan.name}</Text>
            <Text style={styles.villaCount}>{`${built} of ${PIECES_PER_VILLA} built`}</Text>
          </View>
          <View style={styles.track}>
            {plan.pieces.map((p, i) => (
              <View key={p.id} style={[styles.trackCell, i < built && styles.trackCellOn]} />
            ))}
          </View>
        </Animated.View>

        <Animated.View key={next.id} entering={FadeInDown.duration(420).delay(200).easing(Easing.out(Easing.cubic))} style={styles.next}>
          <Text style={styles.nextLabel}>Next</Text>
          <Text style={styles.nextName}>{next.name}</Text>
          <Text style={styles.nextBlurb}>{next.blurb}</Text>
          {short > 0 ? (
            <>
              <View style={styles.needTrack}>
                <View style={[styles.needFill, { width: `${Math.min(100, (progress.tesserae / next.cost) * 100)}%` }]} />
              </View>
              <Text style={styles.needText}>{`${progress.tesserae} of ${next.cost} tiles · ${short} more to build it`}</Text>
            </>
          ) : (
            <PressableScale accessibilityRole="button" accessibilityLabel={`Build: ${next.name}, for ${next.cost} tiles`} onPress={build} style={({ pressed }) => [styles.buildButton, pressed && styles.pressed]}>
              <Text style={styles.buildText}>Build</Text>
              <View style={styles.buildCost}>
                <TileGlyph light />
                <Text style={styles.buildCostText}>{next.cost}</Text>
              </View>
            </PressableScale>
          )}
        </Animated.View>

        {done.length > 0 && (
          <View>
            <Text style={styles.sectionLabel}>{`Your villas · ${done.length}`}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.doneRow}>
              {done.map(v => (
                <View key={v.index} style={styles.doneCard}>
                  <VillaIsland plan={v} built={PIECES_PER_VILLA} width={132} height={120} night={night} />
                  <Text style={styles.doneName} numberOfLines={1}>
                    {v.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {VILLA_TEST_TILES && (
          <PressableScale accessibilityRole="button" accessibilityLabel="Add 100 test tiles" onPress={() => adoptProgress({ ...progress, tesserae: progress.tesserae + 100 })} style={({ pressed }) => [styles.testButton, pressed && styles.pressed]}>
            <Text style={styles.testText}>+100 test tiles</Text>
          </PressableScale>
        )}

        <Text style={styles.howTo}>{`Every puzzle lays tiles: one for the solve and one for each star. The Daily adds ${DAILY_TESSERAE} more. Finish a villa and the next island rises.`}</Text>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 92 },
  headerRight: { alignItems: 'flex-end' },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  purse: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
  purseText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, gap: theme.spacing.lg },
  sceneFrame: { borderRadius: 26, overflow: 'hidden' },
  island: { position: 'absolute', top: 0, left: 0 },
  toast: { position: 'absolute', top: 14, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  toastText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  villaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  villaName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 4, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  villaCount: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
  track: { flexDirection: 'row', gap: 4, marginTop: theme.spacing.sm },
  trackCell: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.border },
  trackCellOn: { backgroundColor: theme.colors.secondary },
  next: { padding: theme.spacing.md, borderRadius: 20, backgroundColor: theme.colors.surface, gap: 6 },
  nextLabel: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  nextName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  nextBlurb: { fontSize: theme.typography.sizes.body, lineHeight: 21, color: theme.colors.textSecondary },
  needTrack: { marginTop: theme.spacing.sm, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.border },
  needFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.secondary },
  needText: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
  buildButton: { marginTop: theme.spacing.sm, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.colors.primary },
  buildText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  buildCost: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  buildCostText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  sectionLabel: { marginBottom: theme.spacing.sm, fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  doneRow: { gap: theme.spacing.sm },
  doneCard: { width: 140, padding: 4, paddingBottom: 10, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center' },
  doneName: { marginTop: 2, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  testButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radii.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong },
  testText: { fontSize: theme.typography.sizes.caption + 1, color: theme.colors.textSecondary },
  howTo: { fontSize: theme.typography.sizes.caption + 1, lineHeight: 19, color: theme.colors.textTertiary, textAlign: 'center' },
  pressed: { opacity: 0.85 },
}));

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Animated, Modal, Pressable, View } from 'react-native';
import { Text } from './Text';
import Reanimated from 'react-native-reanimated';
import { SHEET_RISE_IN } from './ModalLayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coinVideosLeft, watchRewardedVideo } from '../ads';
import { isReducedMotion, shade, triggerFeedback } from '../game/rendering';
import { usePlayerProgress } from '../progression';
import { HINT_COST, INSIGHT_PACK, INSIGHTS_PER_VIDEO } from '../progression/coins';
import { getColorScheme, theme, themedStyles } from '../theme';
import { CoinGlyph, useCoinPurchase } from './Coins';
import { PressableScale } from './PressableScale';
import { RaisedKey } from './RaisedKey';
import { ROUND_KEY } from './RoundKey';
import { curve } from '../theme/motion';

/** The sheet rises from the foot of the screen as its backdrop fades in. */

/**
 * Insight, the superpower every game shares: one charge reveals the next
 * move and says why. Charges come first; with none left, a small panel
 * offers the two ways to more - a short video the player chooses to watch
 * (+2), or coins for this one - and never pushes either.
 *
 * Usage in a game screen:
 *   const insight = useInsightPower();
 *   ...
 *   insight.spend(() => applyTheHint());   // inside the Hint handler
 *   <InsightCount count={insight.count} />  // on the button
 *   {insight.sheet}                        // anywhere in the tree
 */
/** After a hint, how long further taps on Insight are ignored. A screen
 * works its hint out from the board as it last rendered, so taps faster
 * than a render all found the same move: each one was charged, and the
 * board showed one. */
const HINT_LOCK_MS = 400;

/** A hint to apply: returns `false` when there was nothing to show, and
 * then nothing is charged. */
export type ApplyHint = () => boolean | void;

export function useInsightPower(): { count: number; spend: (apply: ApplyHint) => void; sheet: React.JSX.Element } {
  const { progress, spendInsightCharge, addInsights } = usePlayerProgress();
  const [pending, setPending] = useState<ApplyHint | null>(null);
  const lastHint = useRef(0);

  const spend = useCallback(
    (apply: ApplyHint) => {
      const now = Date.now();
      if (now - lastHint.current < HINT_LOCK_MS) return;
      if (progress.insights > 0) {
        // The hint first, the charge after - only for a hint that showed.
        if (apply() === false) return;
        lastHint.current = now;
        spendInsightCharge();
        return;
      }
      triggerFeedback('tap');
      setPending(() => apply);
    },
    [progress.insights, spendInsightCharge],
  );

  const close = useCallback(() => setPending(null), []);
  // Always mounted, shown by \`visible\`: removed outright, it vanished on
  // the spot instead of fading away.
  const sheet = (
    <InsightSheet
      visible={pending !== null}
      onClose={close}
      onEarned={() => {
        addInsights(INSIGHTS_PER_VIDEO);
        if (spendInsightCharge()) pending?.();
        setPending(null);
      }}
      onPaid={() => {
        pending?.();
        setPending(null);
      }}
      onPack={() => {
        addInsights(INSIGHT_PACK.count);
        if (spendInsightCharge()) pending?.();
        setPending(null);
      }}
    />
  );

  return { count: progress.insights, spend, sheet };
}

/** The charge count on the Insight button. */
export function InsightCount({ count }: { count: number }): React.JSX.Element {
  return (
    <View style={[styles.count, count === 0 && styles.countEmpty]} accessibilityLabel={`${count} Insight left`}>
      <Text style={[styles.countText, count === 0 && styles.countTextEmpty]}>{count > 0 ? count : '+'}</Text>
    </View>
  );
}

function InsightSheet({ visible, onClose, onEarned, onPaid, onPack }: { visible: boolean; onClose: () => void; onEarned: () => void; onPaid: () => void; onPack: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { coins, buy } = useCoinPurchase();
  const [watching, setWatching] = useState(false);
  const [missed, setMissed] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  React.useEffect(() => {
    if (!visible) return;
    setMissed(false);
    coinVideosLeft().then(setLeft);
  }, [visible]);

  const watch = async () => {
    if (watching || left === 0) return;
    triggerFeedback('tap');
    setWatching(true);
    setMissed(false);
    const earned = await watchRewardedVideo();
    setWatching(false);
    if (earned) {
      triggerFeedback('coin');
      onEarned();
    } else setMissed(true);
  };
  const noVideos = left === 0;
  const affordable = coins >= HINT_COST;
  const leadVideo = !noVideos;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        {/* The whole dimmed backdrop closes the sheet: a plain full-screen
            pressable, so the tap area is the whole backdrop, not the size of
            its contents. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[styles.scrim, styles.scrimFill]} />
        <Reanimated.View entering={SHEET_RISE_IN} style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          {/* The heading, set like the pages: the mark beside it, left. */}
          <View style={styles.sheetHead}>
            <View style={styles.sheetMark}>
              <Icon name="spark" size={20} color={theme.colors.accent} />
            </View>
            <View style={styles.sheetHeadText}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                Out of Insight
              </Text>
              <Text style={styles.sheetBody}>Insight shows your next move on the board.</Text>
            </View>
          </View>

          {/* Three keys, one weight each: the free video in ink while there
              is one, the two coin offers in paper - label left, what it
              costs or gives right, like a price list. */}
          <View style={styles.offers}>
            {leadVideo && (
              <PressableScale accessibilityRole="button" accessibilityLabel={`Watch a short video for ${INSIGHTS_PER_VIDEO} Insight`} accessibilityState={{ disabled: watching, busy: watching }} onPress={watch} scaleTo={1}>
                <RaisedKey height={56} lip={5} face={theme.colors.primary} edge={shade(theme.colors.primary, getColorScheme() === 'dark' ? 0.72 : 0.5)} padding={20} idle={watching} style={styles.offerKey}>
                  <View style={styles.offerRow}>
                    <Text style={styles.offerLabelInk}>{watching ? 'Loading\u2026' : 'Watch a short video'}</Text>
                    <Text style={styles.offerValueInk}>{`+${INSIGHTS_PER_VIDEO}`}</Text>
                  </View>
                </RaisedKey>
              </PressableScale>
            )}
            <PressableScale accessibilityRole="button" accessibilityLabel={`Use ${HINT_COST} coins for one Insight`} onPress={() => buy(HINT_COST, onPaid)} scaleTo={1}>
              <RaisedKey height={52} lip={3} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border} padding={20} idle={!affordable} style={styles.offerKey}>
                <View style={styles.offerRow}>
                  <Text style={styles.offerLabel}>One, for this move</Text>
                  <View style={styles.offerPrice}>
                    <CoinGlyph size={14} />
                    <Text style={styles.offerValue}>{HINT_COST}</Text>
                  </View>
                </View>
              </RaisedKey>
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel={`Use ${INSIGHT_PACK.cost} coins for ${INSIGHT_PACK.count} Insight`} onPress={() => buy(INSIGHT_PACK.cost, onPack)} scaleTo={1}>
              <RaisedKey height={52} lip={3} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border} padding={20} idle={coins < INSIGHT_PACK.cost} style={styles.offerKey}>
                <View style={styles.offerRow}>
                  <Text style={styles.offerLabel}>{`${INSIGHT_PACK.count}, kept for later`}</Text>
                  <View style={styles.offerPrice}>
                    <CoinGlyph size={14} />
                    <Text style={styles.offerValue}>{INSIGHT_PACK.cost}</Text>
                  </View>
                </View>
              </RaisedKey>
            </PressableScale>
            <Text style={styles.purseLine}>{`You have ${coins} coins`}</Text>
          </View>

          {missed && <Text style={styles.missed}>No video right now. Try again in a little while.</Text>}

          <PressableScale accessibilityRole="button" accessibilityLabel="Not now" onPress={onClose} hitSlop={8} containerStyle={styles.notNow}>
            <Text style={styles.notNowText}>Not now</Text>
          </PressableScale>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

/**
 * The Insight button every game carries: a gold-rimmed pill with the spark
 * and the charges left, so it reads as the power it is, not one more
 * control. Pressing it runs `onPress` (the screen's own hint, which spends
 * through `useInsightPower`).
 */
export function InsightButton({ count, onPress, progress }: { count: number; onPress: () => void; progress?: unknown }): React.JSX.Element {
  const stuck = useStuck(progress);
  // The spark flares as it is used: swells, turns a quarter (its four
  // points land where they were) and settles.
  const flare = useRef(new Animated.Value(0)).current;
  const press = () => {
    if (!isReducedMotion()) {
      flare.setValue(0);
      Animated.timing(flare, { toValue: 1, duration: 520, easing: curve.arrive, useNativeDriver: true }).start();
    }
    onPress();
  };
  return (
    <View>
      {stuck && <StuckGlow />}
    <PressableScale accessibilityRole="button" accessibilityLabel={`Insight: reveal the next move, ${count} left`} onPress={press} scaleTo={1}>
      {/* The gold key on its gold edge: the power, not one more control. */}
      <RaisedKey height={ROUND_KEY} lip={3} face={theme.colors.surfaceHi} edge={shade(theme.colors.goldRim, 0.72)} rim={theme.colors.goldRim} padding={theme.spacing.lg - 2} gap={theme.spacing.xs}>
        <Animated.View style={{ transform: [{ scale: flare.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.55, 1] }) }, { rotate: flare.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}>
          <Icon name="spark" size={14} color={theme.colors.accent} />
        </Animated.View>
        <Text style={styles.buttonText}>Insight</Text>
        <InsightCount count={count} />
      </RaisedKey>
    </PressableScale>
    </View>
  );
}

/** A board left this long without a change is read as stuck. */
const STUCK_MS = 40_000;

/**
 * Whether the board has sat unchanged for `STUCK_MS`: `progress` is the
 * board's state, so any move resets the wait. Undefined `progress` (a
 * screen that does not pass it) never counts as stuck.
 */
function useStuck(progress: unknown): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    setStuck(false);
    if (progress === undefined) return;
    const timer = setTimeout(() => setStuck(true), STUCK_MS);
    return () => clearTimeout(timer);
  }, [progress]);
  return stuck;
}

/**
 * The one nudge a stuck player gets: a soft gold ring breathing out of the
 * Insight key, every few seconds, until the next move. Never a sound, never
 * a pop-up: help that waits to be taken.
 */
function StuckGlow(): React.JSX.Element | null {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = isReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1400, easing: curve.arrive, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
      // A handful of breaths, not a glow for as long as the player sits:
      // the endless loop kept the screen drawing every frame.
      { iterations: 4 },
    );
    loop.start();
    return () => loop.stop();
  }, [t, reduced]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stuckRing,
        reduced
          ? { opacity: 0.6 }
          : { opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }), transform: [{ scaleX: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
      ]}
    />
  );
}

/** A small eye of light: Insight's own mark. */
export function InsightMark(): React.JSX.Element {
  return (
    <View style={styles.markInner}>
      <Icon name="spark" size={26} color={theme.colors.accent} />
    </View>
  );
}

const styles = themedStyles(() => ({
  stuckRing: { position: 'absolute', left: -2, right: -2, top: -2, height: ROUND_KEY + 4, borderRadius: (ROUND_KEY + 4) / 2, borderWidth: 2, borderColor: theme.colors.goldRim },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    marginLeft: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  countEmpty: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.borderStrong },
  countText: { fontSize: 12, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi, fontVariant: ['tabular-nums'] },
  countTextEmpty: { color: theme.colors.textPrimary },
  sheetHead: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: theme.spacing.sm },
  sheetMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceHi, borderWidth: 1.5, borderColor: theme.colors.goldRim, borderBottomWidth: 3, borderBottomColor: shade(theme.colors.goldRim, 0.68) },
  sheetHeadText: { flex: 1 },
  sheetTitle: { fontFamily: theme.typography.families.display, fontSize: 26, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  sheetBody: { marginTop: 2, fontSize: theme.typography.sizes.body, color: theme.colors.textSecondary },
  offers: { alignSelf: 'stretch', gap: 10, marginTop: theme.spacing.lg },
  offerKey: { alignSelf: 'stretch' },
  offerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  offerLabelInk: { fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  offerValueInk: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  offerLabel: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  offerPrice: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  offerValue: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  purseLine: { alignSelf: 'flex-end', marginTop: 2, fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  leadWrap: { alignSelf: 'stretch', marginTop: theme.spacing.lg },
  leadGlyph: { fontSize: 13, color: theme.colors.surfaceHi },
  leadText: { fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  alts: { alignItems: 'center', gap: 12, marginTop: theme.spacing.md },
  altText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary, textDecorationLine: 'underline', textDecorationColor: theme.colors.borderStrong },
  altShort: { color: theme.colors.textTertiary },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  balanceText: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  layer: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrimFill: { flex: 1, backgroundColor: theme.colors.overlay },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    alignItems: 'center',
  },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderStrong, marginBottom: theme.spacing.md },
  mark: { marginBottom: theme.spacing.sm },
  markInner: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceHi, borderWidth: 1.5, borderColor: theme.colors.goldRim },
  markGlyph: { fontSize: 26, color: theme.colors.accent },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  body: { marginTop: 4, textAlign: 'center', fontSize: theme.typography.sizes.body, lineHeight: 20, color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.md },
  options: { flexDirection: 'row', gap: theme.spacing.sm, alignSelf: 'stretch', marginTop: theme.spacing.lg },
  optionWrap: { flex: 1 },
  option: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: 132,
  },
  optionLead: { borderColor: theme.colors.goldRim, borderWidth: 1.5, backgroundColor: theme.colors.surfaceHi },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt, marginBottom: theme.spacing.sm },
  optionIconLead: { backgroundColor: theme.colors.primary },
  playGlyph: { fontSize: 15, color: theme.colors.surfaceHi, marginLeft: 2 },
  optionTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  optionSub: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, textAlign: 'center' },
  optionFree: { marginTop: 6, fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2, color: theme.colors.accentText },
  missed: { marginTop: theme.spacing.sm, textAlign: 'center', fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  dim: { opacity: 0.5 },
  packWrap: { alignSelf: 'stretch', marginTop: theme.spacing.sm },
  pack: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm + 2, gap: theme.spacing.md, minHeight: 0 },
  packMark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  packText: { flex: 1, alignItems: 'flex-start' },
  packSub: { marginTop: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  packPriceShort: { opacity: 0.55 },
  packCostShort: { color: theme.colors.textSecondary },
  packTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  packPrice: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
  packCost: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  pressed: { opacity: 0.85 },
  notNow: { marginTop: theme.spacing.md, paddingVertical: 6 },
  notNowText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  buttonSpark: { fontSize: 14, color: theme.colors.accent },
  buttonText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
}));

import React, { useCallback, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { coinVideosLeft, watchRewardedVideo } from '../ads';
import { triggerFeedback } from '../game/rendering';
import { usePlayerProgress } from '../progression';
import { HINT_COST, INSIGHTS_PER_VIDEO } from '../progression/coins';
import { theme, themedStyles } from '../theme';
import { CoinGlyph, useCoinPurchase } from './Coins';
import { PressableScale } from './PressableScale';

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
export function useInsightPower(): { count: number; spend: (apply: () => void) => void; sheet: React.JSX.Element | null } {
  const { progress, spendInsightCharge, addInsights } = usePlayerProgress();
  const [pending, setPending] = useState<(() => void) | null>(null);

  const spend = useCallback(
    (apply: () => void) => {
      if (spendInsightCharge()) {
        apply();
        return;
      }
      triggerFeedback('tap');
      setPending(() => apply);
    },
    [spendInsightCharge],
  );

  const close = useCallback(() => setPending(null), []);
  const sheet = pending ? (
    <InsightSheet
      onClose={close}
      onEarned={() => {
        addInsights(INSIGHTS_PER_VIDEO);
        if (spendInsightCharge()) pending();
        setPending(null);
      }}
      onPaid={() => {
        pending();
        setPending(null);
      }}
    />
  ) : null;

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

function InsightSheet({ onClose, onEarned, onPaid }: { onClose: () => void; onEarned: () => void; onPaid: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { coins, buy } = useCoinPurchase();
  const [watching, setWatching] = useState(false);
  const [missed, setMissed] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  React.useEffect(() => {
    coinVideosLeft().then(setLeft);
  }, []);

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

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} feedback={false} scaleTo={1} containerStyle={styles.scrim}>
          <View style={styles.scrimFill} />
        </PressableScale>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.mark}>
            <InsightMark />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Out of Insight
          </Text>
          <Text style={styles.body}>Insight shows your next move on the board and explains why it has to be there.</Text>

          <View style={styles.options}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={noVideos ? 'No more videos today' : `Watch a short video for ${INSIGHTS_PER_VIDEO} Insight`}
              accessibilityState={{ disabled: noVideos || watching, busy: watching }}
              onPress={watch}
              containerStyle={styles.optionWrap}
              style={({ pressed }) => [styles.option, styles.optionLead, (noVideos || watching) && styles.dim, pressed && styles.pressed]}
            >
              <View style={[styles.optionIcon, styles.optionIconLead]}>
                <Text style={styles.playGlyph}>{'\u25B6\uFE0E'}</Text>
              </View>
              <Text style={styles.optionTitle}>{noVideos ? 'Back tomorrow' : watching ? 'Loading\u2026' : `+${INSIGHTS_PER_VIDEO} Insight`}</Text>
              <Text style={styles.optionSub}>{noVideos ? 'No videos left today' : 'Watch a short video'}</Text>
              {!noVideos && <Text style={styles.optionFree}>FREE</Text>}
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Use ${HINT_COST} coins for one Insight`}
              onPress={() => buy(HINT_COST, onPaid)}
              containerStyle={styles.optionWrap}
              style={({ pressed }) => [styles.option, !affordable && styles.dim, pressed && styles.pressed]}
            >
              <View style={styles.optionIcon}>
                <CoinGlyph size={20} />
              </View>
              <Text style={styles.optionTitle}>{`${HINT_COST} coins`}</Text>
              <Text style={styles.optionSub}>{affordable ? 'For this move' : `You have ${coins}`}</Text>
            </PressableScale>
          </View>
          {missed && <Text style={styles.missed}>No video right now. Try again in a little while.</Text>}

          <PressableScale accessibilityRole="button" accessibilityLabel="Not now" onPress={onClose} hitSlop={8} containerStyle={styles.notNow}>
            <Text style={styles.notNowText}>Not now</Text>
          </PressableScale>
        </View>
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
export function InsightButton({ count, onPress }: { count: number; onPress: () => void }): React.JSX.Element {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Insight: reveal the next move, ${count} left`}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonSpark}>{'\u2726'}</Text>
      <Text style={styles.buttonText}>Insight</Text>
      <InsightCount count={count} />
    </PressableScale>
  );
}

/** A small eye of light: Insight's own mark. */
function InsightMark(): React.JSX.Element {
  return (
    <View style={styles.markInner}>
      <Text style={styles.markGlyph}>✦</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    marginLeft: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  countEmpty: { backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.borderStrong },
  countText: { fontSize: 12, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi, fontVariant: ['tabular-nums'] },
  countTextEmpty: { color: theme.colors.textPrimary },
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
  body: { marginTop: 4, textAlign: 'center', fontSize: theme.typography.sizes.caption + 1, lineHeight: 20, color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.md },
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
  optionTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  optionSub: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary, textAlign: 'center' },
  optionFree: { marginTop: 6, fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.2, color: theme.colors.accentText },
  missed: { marginTop: theme.spacing.sm, textAlign: 'center', fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  notNow: { marginTop: theme.spacing.md, paddingVertical: 6 },
  notNowText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.goldRim,
    backgroundColor: theme.colors.surfaceHi,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonPressed: { backgroundColor: theme.colors.surfaceAlt },
  buttonSpark: { fontSize: 14, color: theme.colors.accent },
  buttonText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
}));

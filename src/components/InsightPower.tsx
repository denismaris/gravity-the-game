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
    if (watching) return;
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
  const pay = () => {
    buy(HINT_COST, onPaid);
  };
  const noVideos = left === 0;
  const affordable = coins >= HINT_COST;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.layer}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} feedback={false} scaleTo={1} containerStyle={styles.scrim}>
          <View style={styles.scrimFill} />
        </PressableScale>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <View style={styles.mark}>
            <InsightMark />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Out of Insight
          </Text>
          <Text style={styles.body}>Insight shows your next move on the board and explains why it has to be there.</Text>
          {missed && <Text style={styles.missed}>No video right now. Try again in a little while, or use coins.</Text>}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={noVideos ? 'No more videos today' : `Watch a video for ${INSIGHTS_PER_VIDEO} Insight`}
            accessibilityState={{ disabled: noVideos || watching, busy: watching }}
            onPress={watch}
            style={({ pressed }) => [styles.primary, (noVideos || watching) && styles.dim, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{noVideos ? 'No more videos today' : watching ? 'Loading video…' : `▶  Watch a video  ·  +${INSIGHTS_PER_VIDEO} Insight`}</Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Use ${HINT_COST} coins for one Insight`}
            onPress={pay}
            style={({ pressed }) => [styles.secondary, !affordable && styles.dim, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Use</Text>
            <CoinGlyph size={14} />
            <Text style={styles.secondaryText}>{`${HINT_COST} for this one`}</Text>
          </PressableScale>

          <PressableScale accessibilityRole="button" accessibilityLabel="Not now" onPress={onClose} hitSlop={8} containerStyle={styles.notNow}>
            <Text style={styles.notNowText}>Not now</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
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
    paddingTop: theme.spacing.lg,
    alignItems: 'center',
  },
  mark: { marginBottom: theme.spacing.sm },
  markInner: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceHi, borderWidth: 1, borderColor: theme.colors.border },
  markGlyph: { fontSize: 24, color: theme.colors.accent },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  body: { marginTop: 4, textAlign: 'center', fontSize: theme.typography.sizes.caption + 1, lineHeight: 20, color: theme.colors.textSecondary, paddingHorizontal: theme.spacing.md },
  missed: { marginTop: theme.spacing.sm, textAlign: 'center', fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  primary: { alignSelf: 'stretch', marginTop: theme.spacing.lg, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  primaryText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  secondary: {
    alignSelf: 'stretch',
    marginTop: theme.spacing.sm,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  secondaryText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  notNow: { marginTop: theme.spacing.md, paddingVertical: 6 },
  notNowText: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
}));

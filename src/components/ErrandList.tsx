import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { dailyKeyOf } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { Errand, ErrandKind, errandLogFor, errandsFor, isErrandDone, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { GameEmblem } from './GameEmblem';
import { PressableScale } from './PressableScale';
import { XpBar } from './XpBar';

/** The mark for an errand that isn't about one game - U+FE0E keeps every
 * one a flat glyph rather than a colour emoji. */
const GLYPHS: Record<Exclude<ErrandKind, 'solveGame'>, string> = {
  solve: '▦︎',
  stars: '★︎',
  clean: '✦︎',
  hard: '◆︎',
  daily: '☀︎',
  set: '❖︎',
};

/** Hours and minutes until today's errands turn over (UTC midnight, the
 * same clock the Daily runs on). */
export function untilTomorrow(now: Date): string {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutes = Math.max(0, Math.ceil((next - now.getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
}

function ErrandMark({ errand, done, compact }: { errand: Errand; done: boolean; compact: boolean }): React.JSX.Element {
  if (errand.kind === 'solveGame' && errand.game) return <GameEmblem kind={errand.game} size={compact ? 28 : 36} />;
  return (
    <View style={[styles.mark, compact && styles.markCompact, done && styles.markDone]}>
      <Text style={[styles.markGlyph, done && styles.markGlyphDone]}>{GLYPHS[errand.kind as Exclude<ErrandKind, 'solveGame'>]}</Text>
    </View>
  );
}

/** One errand: what to do, how far along, what it pays - and, once done,
 * a Claim pill that pays it out with the coins floating up to the purse. */
function ErrandRow({ errand, done, progress, claimed, onClaim, compact }: { errand: Errand; done: boolean; progress: number; claimed: boolean; onClaim: () => void; compact: boolean }): React.JSX.Element {
  const float = useRef(new Animated.Value(1)).current;
  const ready = done && !claimed;
  const glow = useRef(new Animated.Value(ready ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(glow, { toValue: ready ? 1 : 0, duration: 260, useNativeDriver: false }).start();
  }, [ready, glow]);

  const claim = () => {
    triggerFeedback('coin');
    float.setValue(0);
    Animated.timing(float, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    onClaim();
  };

  return (
    <Animated.View
      style={[
        styles.row,
        compact && styles.rowCompact,
        claimed && styles.rowClaimed,
        { borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [theme.colors.border, theme.colors.accent] }) },
      ]}
      accessible
      accessibilityLabel={`${errand.title}. ${Math.min(progress, errand.target)} of ${errand.target}. ${claimed ? 'Claimed' : ready ? `Ready to claim ${errand.coins} coins` : `Pays ${errand.coins} coins`}.`}
    >
      <ErrandMark errand={errand} done={done} compact={compact} />
      <View style={[styles.rowBody, compact && styles.rowBodyCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact, claimed && styles.titleClaimed]} numberOfLines={1}>
          {errand.title}
        </Text>
        <View style={styles.progressRow}>
          <XpBar share={errand.target > 0 ? progress / errand.target : 0} ticks={errand.target > 1 && errand.target <= 10 ? errand.target : 1} height={compact ? 4 : 6} color={done ? theme.colors.success : theme.colors.accent} style={styles.bar} />
          <Text style={styles.count}>
            {Math.min(progress, errand.target)}/{errand.target}
          </Text>
        </View>
      </View>
      {ready ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={`Claim ${errand.coins} coins`} onPress={claim} style={({ pressed }) => [styles.claim, compact && styles.claimCompact, pressed && styles.claimPressed]}>
          <Text style={styles.claimText}>Claim</Text>
          <CoinGlyph size={13} />
          <Text style={styles.claimText}>{errand.coins}</Text>
        </PressableScale>
      ) : claimed ? (
        <View style={styles.doneTick}>
          <Text style={styles.doneTickGlyph}>{'✓︎'}</Text>
        </View>
      ) : (
        <View style={styles.reward}>
          <CoinGlyph size={13} />
          <Text style={styles.rewardText}>{errand.coins}</Text>
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.float,
          {
            opacity: float.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }, { scale: float.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.15, 1] }) }],
          },
        ]}
      >
        <CoinGlyph size={16} />
        <Text style={styles.floatText}>+{errand.coins}</Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Today's three errands, for Home. Reads and claims through the progress
 * provider; the day's errands come from the date alone.
 */
export function ErrandList({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { progress, claimErrand } = usePlayerProgress();
  const dayKey = dailyKeyOf(new Date());
  const errands = errandsFor(dayKey, progress.retired);
  const log = errandLogFor(progress, dayKey);
  const [clock, setClock] = useState(() => untilTomorrow(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setClock(untilTomorrow(new Date())), 30000);
    return () => clearInterval(timer);
  }, []);
  const doneCount = errands.filter((e, i) => isErrandDone(e, log, i)).length;

  return (
    <View style={[styles.list, compact && styles.listCompact]}>
      {/* Compact (on Home's Today page): the count and the reset clock
          head the list instead of trailing it, so the list ends on its
          last errand and fits the card. */}
      {compact && (
        <View style={styles.head}>
          <Text style={styles.headLabel}>Errands</Text>
          <Text style={styles.headClock}>{`${doneCount} of ${errands.length} done · new in ${clock.toLowerCase()}`}</Text>
        </View>
      )}
      {errands.map((errand, i) => (
        <ErrandRow
          key={`${dayKey}-${i}`}
          errand={errand}
          progress={log.progress[i]}
          done={isErrandDone(errand, log, i)}
          claimed={log.claimed[i]}
          compact={compact}
          onClaim={() => {
            claimErrand(i);
          }}
        />
      ))}
      {!compact && (
        <Text style={styles.foot}>
          {doneCount}/{errands.length} DONE · FRESH ERRANDS IN {clock}
        </Text>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  list: { gap: theme.spacing.sm },
  listCompact: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1.5,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  headLabel: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  headClock: { fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  rowCompact: { paddingVertical: 6, borderRadius: 13 },
  rowBodyCompact: { gap: 4 },
  titleCompact: { fontSize: theme.typography.sizes.caption },
  markCompact: { width: 28, height: 28, borderRadius: 9 },
  claimCompact: { paddingHorizontal: 10, paddingVertical: 5 },
  rowClaimed: { backgroundColor: theme.colors.surface, opacity: 0.72 },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,137,47,0.16)',
  },
  markDone: { backgroundColor: 'rgba(92,124,74,0.18)' },
  markGlyph: { fontSize: 17, color: theme.colors.accent },
  markGlyphDone: { color: theme.colors.success },
  rowBody: { flex: 1, gap: 6 },
  title: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  titleClaimed: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  bar: { flex: 1 },
  count: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    color: theme.colors.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6 },
  rewardText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  claim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  claimPressed: { opacity: 0.85 },
  claimText: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.caption },
  doneTick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  doneTickGlyph: { color: theme.colors.surfaceHi, fontSize: 14, fontWeight: theme.typography.weights.bold },
  float: { position: 'absolute', right: 18, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  floatText: { fontFamily: theme.typography.families.mono, fontWeight: theme.typography.weights.bold, color: theme.colors.accent, fontSize: theme.typography.sizes.body },
  foot: {
    marginTop: 2,
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    textAlign: 'center',
  },
}));

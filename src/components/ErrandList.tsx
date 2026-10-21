import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { dailyKeyOf, nextDayStart } from '../game/journey';
import { shade, triggerFeedback } from '../game/rendering';
import { Errand, ErrandKind, errandLogFor, errandsFor, isErrandDone, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';
import { CoinGlyph } from './Coins';
import { GameEmblem } from './GameEmblem';
import { Icon } from './Icon';
import { PressableScale, sunkKey } from './PressableScale';
import { XpBar } from './XpBar';

/** Hours and minutes until today's errands turn over (local midnight, the
 * same clock the Daily runs on). */
export function untilTomorrow(now: Date): string {
  const next = nextDayStart(now);
  const minutes = Math.max(0, Math.ceil((next - now.getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
}

/** How far a claimed tick's disc stands on its lip. */
const DONE_LIP = 2.5;

/** How big an errand's mark is drawn, in the compact list and the full. */
const MARK = { compact: 30, full: 36 } as const;

/**
 * The drawing on an errand's mark: a small figure of the thing asked for,
 * in the mark's own colour - puzzle tiles to solve, a star, a spark for
 * "no hints", a diamond for the hard one, the sun for the Daily, a set of
 * four. Drawn, not typed: the type glyphs they replaced (`▦ ★ ◆`) set at
 * a different size and weight in every font, and read as placeholders.
 */
function ErrandGlyph({ kind, size, color }: { kind: Exclude<ErrandKind, 'solveGame'>; size: number; color: string }): React.JSX.Element {
  const c = size / 2;
  const star = (cx: number, cy: number, r: number, points: number, inner: number): string => {
    let d = '';
    for (let k = 0; k < points * 2; k += 1) {
      const a = (k * Math.PI) / points - Math.PI / 2;
      const rr = k % 2 === 0 ? r : r * inner;
      d += `${k === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr} `;
    }
    return `${d}Z`;
  };
  const diamond = (cx: number, cy: number, r: number): string => `M ${cx} ${cy - r} L ${cx + r * 0.8} ${cy} L ${cx} ${cy + r} L ${cx - r * 0.8} ${cy} Z`;
  return (
    <Canvas style={{ width: size, height: size }}>
      {kind === 'solve' &&
        [0, 1, 2, 3].map(i => {
          const cell = size * 0.2;
          const gap = size * 0.05;
          const x = c - cell - gap / 2 + (i % 2) * (cell + gap);
          const y = c - cell - gap / 2 + Math.floor(i / 2) * (cell + gap);
          return <RoundedRect key={i} x={x} y={y} width={cell} height={cell} r={cell * 0.25} color={color} opacity={i === 3 ? 0.4 : 1} />;
        })}
      {kind === 'stars' && <Path path={star(c, c + size * 0.02, size * 0.27, 5, 0.46)} color={color} />}
      {kind === 'clean' && <Path path={star(c, c, size * 0.28, 4, 0.3)} color={color} />}
      {kind === 'hard' && <Path path={diamond(c, c, size * 0.26)} color={color} />}
      {kind === 'daily' && (
        <Group>
          <Circle cx={c} cy={c} r={size * 0.12} color={color} />
          {Array.from({ length: 8 }, (_v, k) => {
            const a = (k * Math.PI) / 4;
            return (
              <Path
                key={k}
                path={`M ${c + Math.cos(a) * size * 0.2} ${c + Math.sin(a) * size * 0.2} L ${c + Math.cos(a) * size * 0.28} ${c + Math.sin(a) * size * 0.28}`}
                color={color}
                style="stroke"
                strokeWidth={Math.max(1.4, size * 0.055)}
                strokeCap="round"
              />
            );
          })}
        </Group>
      )}
      {kind === 'set' &&
        [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ].map(([dx, dy], i) => <Path key={i} path={diamond(c + dx * size * 0.14, c + dy * size * 0.14, size * 0.1)} color={color} />)}
    </Canvas>
  );
}

/** An errand's mark: the game's own emblem for "solve a <game>", else a
 * small gold tile with its figure - both standing on a lip, like every
 * tile on Home. Green once done. */
function ErrandMark({ errand, done, compact }: { errand: Errand; done: boolean; compact: boolean }): React.JSX.Element {
  const size = compact ? MARK.compact : MARK.full;
  if (errand.kind === 'solveGame' && errand.game) return <GameEmblem kind={errand.game} size={size} raised />;
  return (
    <View style={[styles.mark, { width: size, height: size + 2.5 }, done && styles.markDone]}>
      <ErrandGlyph kind={errand.kind as Exclude<ErrandKind, 'solveGame'>} size={size * 0.9} color={done ? theme.colors.success : theme.colors.accentText} />
    </View>
  );
}

/** One errand: what to do and how far along on one line, the bar under
 * it, and on the right what it pays - a coin pill that becomes the Claim
 * button once it is done, and a tick once claimed. */
function ErrandRow({ errand, done, progress, claimed, onClaim, compact, dense }: { errand: Errand; done: boolean; progress: number; claimed: boolean; onClaim: () => void; compact: boolean; dense: boolean }): React.JSX.Element {
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
  const shown = Math.min(progress, errand.target);

  return (
    <Animated.View
      style={[
        styles.row,
        compact && styles.rowCompact,
        dense && styles.rowDense,
        claimed && !compact && styles.rowClaimed,
        !compact && { borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [theme.colors.border, theme.colors.accent] }) },
      ]}
      accessible
      accessibilityLabel={`${errand.title}. ${shown} of ${errand.target}. ${claimed ? 'Claimed' : ready ? `Ready to claim ${errand.coins} coins` : `Pays ${errand.coins} coins`}.`}
    >
      {/* Claimed: the errand steps back, its tick does not. */}
      <View style={claimed && compact ? styles.claimedFade : undefined}>
        <ErrandMark errand={errand} done={done} compact={compact} />
      </View>
      <View style={[styles.rowBody, compact && styles.rowBodyCompact, dense && styles.rowBodyDense, claimed && compact && styles.claimedFade]}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, compact && styles.titleCompact, claimed && styles.titleClaimed]} numberOfLines={1}>
            {errand.title}
          </Text>
          {/* The count on the title's own line, set in figures: "2 of 4"
              read with the words it counts, not stranded under the bar. */}
          {/* Once done, the bar and the Claim button say it: the count
              steps aside so the title keeps its room. */}
          {!done && (
            <Text style={styles.count}>
              {shown}
              <Text style={styles.countOf}>{`/${errand.target}`}</Text>
            </Text>
          )}
        </View>
        {!dense && (
          <XpBar share={errand.target > 0 ? progress / errand.target : 0} ticks={errand.target > 1 && errand.target <= 10 ? errand.target : 1} height={compact ? 5 : 6} color={done ? theme.colors.success : theme.colors.accent} />
        )}
      </View>
      {ready ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={`Claim ${errand.coins} coins`} onPress={claim} style={({ pressed }) => [styles.pill, styles.claim, pressed && sunkKey(3)]}>
          <Text style={styles.claimText}>Claim</Text>
          <CoinGlyph size={12} />
          <Text style={[styles.claimText, styles.figure]}>{errand.coins}</Text>
        </PressableScale>
      ) : claimed ? (
        // Claimed: the Claim key's own ink, as a small disc standing on
        // its lip, holding a tick.
        <View style={styles.doneStand} accessibilityLabel="Claimed">
          <View style={[styles.doneTick, styles.doneLip]} />
          <View style={styles.doneTick}>
            <Icon name="check" size={12} color={theme.colors.surfaceHi} weight={2.6} />
          </View>
        </View>
      ) : (
        // Not earned yet: what it pays, as plain words - no key shape, so it
        // never reads as something to press already.
        <View style={styles.reward} accessibilityLabel={`Pays ${errand.coins} coins`}>
          <CoinGlyph size={12} />
          <Text style={[styles.rewardText, styles.figure]}>{errand.coins}</Text>
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
/** `dense`: for a short screen - each errand one slim line, its count on
 * the title, no progress bar. */
export function ErrandList({ compact = false, dense = false }: { compact?: boolean; dense?: boolean }): React.JSX.Element {
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
    <View style={[styles.list, compact && styles.listCompact, dense && styles.listDense]}>
      {/* Compact (on Home's Today page): the count and the reset clock
          head the list instead of trailing it, so the list ends on its
          last errand and fits the card. */}
      {compact && (
        <View style={styles.head}>
          <View style={styles.headLeft}>
            <Text style={styles.headLabel}>Errands</Text>
            {/* How many are done, as pips: one per errand. */}
            <View style={styles.pips} accessibilityLabel={`${doneCount} of ${errands.length} done`}>
              {errands.map((_e, i) => (
                <View key={i} style={[styles.pip, i < doneCount && styles.pipOn]} />
              ))}
            </View>
          </View>
          <Text style={styles.headClock}>{`New in ${clock.toLowerCase()}`}</Text>
        </View>
      )}
      {errands.map((errand, i) => (
        <React.Fragment key={`${dayKey}-${i}`}>
        {/* On Home: a list, not a stack of boxes - a fine rule between
            rows, and the Claim pill the one strong thing on a row. */}
        {compact && i > 0 && <View style={styles.divider} />}
        <ErrandRow
          errand={errand}
          progress={log.progress[i]}
          done={isErrandDone(errand, log, i)}
          claimed={log.claimed[i]}
          compact={compact}
          dense={dense}
          onClaim={() => {
            claimErrand(i);
          }}
        />
        </React.Fragment>
      ))}
      {!compact && (
        <Text style={styles.foot}>
          {doneCount} of {errands.length} done · new errands in {clock.toLowerCase()}
        </Text>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  list: { gap: theme.spacing.sm },
  listCompact: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1.5,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headLabel: { fontSize: theme.typography.sizes.micro, fontWeight: theme.typography.weights.bold, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.textTertiary },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 12, height: 4, borderRadius: 2, backgroundColor: theme.colors.border },
  pipOn: { backgroundColor: theme.colors.success },
  headClock: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  rowCompact: { paddingVertical: 9, paddingHorizontal: 0, borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderStrong, opacity: 0.6, marginLeft: MARK.compact + theme.spacing.sm + 2 },
  rowDense: { paddingVertical: 4 },
  listDense: { gap: 0 },
  rowBodyCompact: { gap: 6 },
  rowBodyDense: { gap: 0 },
  titleCompact: { fontSize: theme.typography.sizes.caption + 1 },
  rowClaimed: { backgroundColor: theme.colors.surface, opacity: 0.72 },
  claimedFade: { opacity: 0.5 },
  mark: {
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,137,47,0.16)',
    // A lip, as every tile on Home has: the same tint, deeper, below.
    borderBottomWidth: 2.5,
    borderBottomColor: 'rgba(183,137,47,0.32)',
  },
  markDone: { backgroundColor: 'rgba(92,124,74,0.18)', borderBottomColor: 'rgba(92,124,74,0.36)' },
  rowBody: { flex: 1, gap: 7 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm },
  title: {
    flex: 1,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  titleClaimed: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  figure: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'] },
  count: {
    fontFamily: theme.typography.families.figures,
    fontVariant: ['tabular-nums'],
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  countOf: { fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  /** The Claim key: raised, the one pressable thing on a row, shown only
   * once the errand is done. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 52,
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingTop: 4,
    paddingBottom: 3,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: theme.colors.border,
    borderBottomColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceHi,
  },
  reward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 52, opacity: 0.75 },
  rewardText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary },
  claim: {
    gap: 3,
    paddingHorizontal: 9,
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderBottomColor: shade(theme.colors.primary, 0.6),
  },
  claimText: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.caption },
  doneStand: { width: 26, height: 26 + DONE_LIP, marginHorizontal: 13 },
  doneTick: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLip: { top: DONE_LIP, backgroundColor: shade(theme.colors.primary, 0.55) },
  float: { position: 'absolute', right: 18, top: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  floatText: { fontFamily: theme.typography.families.figures, fontWeight: theme.typography.weights.bold, color: theme.colors.accentText, fontSize: theme.typography.sizes.body },
  foot: {
    marginTop: 2,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontWeight: theme.typography.weights.semibold,
  },
}));

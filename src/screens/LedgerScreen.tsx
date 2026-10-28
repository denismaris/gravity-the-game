import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackLabel } from '../components/Icon';
import { Animated, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { ConfettiBurst, PressableScale } from '../components';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { GameEmblem, GameEmblemGlyph } from '../components/GameEmblem';
import { LedgerStampRow } from '../components/LedgerStamp';
import { PageBloom } from '../components/PageBloom';
import { accentColorForKind, gameDisplayName, GameKind, ROTATION } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { AptitudeChart } from '../components/AptitudeChart';
import { GameLedger, computeAptitude, STAMP_COINS, STAMP_NAMES, STAMP_STEPS, Stamp, cosmeticsFor, ledgerOf, owns, skinSlot, stampsOf, unlockedGames, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';
import { curve } from '../theme/motion';

export interface LedgerScreenProps {
  onExit: () => void;
  onOpenShop: () => void;
}

const CHART_HEIGHT = 64;
const CHART_EMBLEM = 20;

/**
 * Solves per game as one row of bars, each in its game's colour with the
 * game's emblem under it - where the player's time has gone, at a glance.
 * One canvas for the lot.
 */
function SolveChart({ ledger, width }: { ledger: Record<GameKind, GameLedger>; width: number }): React.JSX.Element {
  const most = Math.max(1, ...ROTATION.map(kind => ledger[kind].solved));
  const slot = width / ROTATION.length;
  const bar = Math.min(14, slot * 0.5);
  const emblem = Math.min(CHART_EMBLEM, slot - 4);
  return (
    <Canvas style={{ width, height: CHART_HEIGHT + emblem + 8 }}>
      {ROTATION.map((kind, i) => {
        const solved = ledger[kind].solved;
        const h = solved === 0 ? 2 : Math.max(4, (solved / most) * CHART_HEIGHT);
        const x = i * slot + (slot - bar) / 2;
        return (
          <React.Fragment key={kind}>
            <RoundedRect x={x} y={0} width={bar} height={CHART_HEIGHT} r={bar / 2} color={theme.colors.surfaceAlt} opacity={0.55} />
            <RoundedRect x={x} y={CHART_HEIGHT - h} width={bar} height={h} r={bar / 2} color={accentColorForKind(kind)} />
            <GameEmblemGlyph kind={kind} size={emblem} x={i * slot + (slot - emblem) / 2} y={CHART_HEIGHT + 8} />
          </React.Fragment>
        );
      })}
    </Canvas>
  );
}

/**
 * One game's entry in the album: its emblem and name, what it has come to,
 * and its four stamps. A stamp waiting is claimed from the tag in the
 * entry's head; the one being worked towards fills from its foot.
 */
function AlbumEntry({
  row,
  stamps,
  retired,
  collector,
  rowWidth,
  first,
  onClaim,
}: {
  row: GameLedger;
  stamps: ReadonlyArray<Stamp>;
  retired: boolean;
  collector: boolean;
  rowWidth: number;
  first: boolean;
  onClaim: (stamps: ReadonlyArray<Stamp>) => void;
}): React.JSX.Element {
  const accent = accentColorForKind(row.kind);
  const next = stamps.find(s => !s.earned);
  const previousStep = next ? (next.rank === 0 ? 0 : STAMP_STEPS[next.rank - 1]) : 0;
  const share = next ? (row.solved - previousStep) / (next.step - previousStep) : 1;
  const ready = stamps.filter(s => s.earned && !s.claimed);
  const pays = ready.reduce((sum, s) => sum + STAMP_COINS[s.rank], 0);
  const stampWidth = Math.min(52, (rowWidth - 3 * 14) / 4);
  const perfect = row.solved > 0 ? Math.round((row.perfect / row.solved) * 100) : 0;
  // Said only once it means something: one solve is not a hint rate.
  const line = !next
    ? 'Every stamp collected'
    : row.solved >= 5 && ready.length === 0
      ? `${perfect}% without a hint, ${next.step - row.solved} to ${STAMP_NAMES[next.rank]}`
      : `${next.step - row.solved} more to ${STAMP_NAMES[next.rank]}`;

  return (
    <View style={[styles.entry, !first && styles.entryRuled]}>
      <View style={styles.entryHead}>
        <GameEmblem kind={row.kind} size={30} raised />
        <View style={styles.entryTitleBox}>
          <View style={styles.entryTitleRow}>
            <Text style={styles.entryTitle} numberOfLines={1}>
              {gameDisplayName(row.kind)}
            </Text>
            {retired && <Text style={styles.retired}>Retired</Text>}
            {/* Every set in the shop for this game owned. */}
            {collector && <Text style={styles.collector}>Collector</Text>}
          </View>
          <Text style={styles.entryLine} numberOfLines={1}>
            {line}
          </Text>
        </View>
        {ready.length > 0 ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Claim ${ready.length === 1 ? 'the stamp' : `${ready.length} stamps`} for ${pays} coins`}
            onPress={() => onClaim(ready)}
            hitSlop={8}
            scaleTo={0.94}
            style={styles.claim}
          >
            <Text style={styles.claimText}>Claim</Text>
            <CoinGlyph size={12} />
            <Text style={styles.claimText}>{pays}</Text>
          </PressableScale>
        ) : (
          <View style={styles.entryCount}>
            <Text style={styles.entryCountValue}>{row.solved}</Text>
            <Text style={styles.entryCountLabel}>solved</Text>
          </View>
        )}
      </View>
      <LedgerStampRow kind={row.kind} stamps={stamps} stampWidth={stampWidth} width={rowWidth} onClaim={stamp => onClaim([stamp])} accent={accent} toward={Math.max(0, Math.min(1, share))} />
    </View>
  );
}

/**
 * The ledger: every game's own record, and the stamp album it fills.
 * Stamps come at 10, 25, 50 and 100 solves in a game - a reason to keep
 * returning to the games you like, and a gentle count of the ones you
 * have left alone.
 */
export function LedgerScreen({ onExit, onOpenShop }: LedgerScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { progress, coins, claimStamp } = usePlayerProgress();
  const ledger = useMemo(() => ledgerOf(progress), [progress]);
  const aptitude = useMemo(() => computeAptitude(progress), [progress]);
  const [burst, setBurst] = useState(0);

  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mount, { toValue: 1, duration: 520, easing: curve.arrive, useNativeDriver: true }).start();
  }, [mount]);

  const totals = useMemo(() => {
    let solved = 0;
    let perfect = 0;
    let stamps = 0;
    let waiting = 0;
    for (const kind of ROTATION) {
      solved += ledger[kind].solved;
      perfect += ledger[kind].perfect;
      for (const s of stampsOf(progress, ledger, kind)) {
        if (s.claimed) stamps += 1;
        else if (s.earned) waiting += 1;
      }
    }
    return { solved, perfect, stamps, waiting };
  }, [ledger, progress]);

  const contentWidth = width - theme.spacing.lg * 2;
  const rowWidth = contentWidth - theme.spacing.md * 2;

  const claim = (stamps: ReadonlyArray<Stamp>) => {
    let any = false;
    for (const stamp of stamps) if (claimStamp(stamp.kind, stamp.step)) any = true;
    if (any) {
      triggerFeedback('coin');
      setBurst(b => b + 1);
    }
  };
  // The album keeps the games the player has; the rest wait in one line
  // at its foot rather than as empty pages.
  const held = useMemo(() => {
    const roster = unlockedGames(progress);
    const waiting = (kind: GameKind) => stampsOf(progress, ledger, kind).some(st => st.earned && !st.claimed);
    // A stamp waiting first, then the games played most.
    return ROTATION.filter(kind => roster.includes(kind) || ledger[kind].solved > 0).sort(
      (a, b) => Number(waiting(b)) - Number(waiting(a)) || ledger[b].solved - ledger[a].solved,
    );
  }, [progress, ledger]);
  const ahead = ROTATION.filter(kind => !held.includes(kind));

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <BackLabel label="Home" style={styles.back} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>The Ledger</Text>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Open the shop" onPress={onOpenShop} hitSlop={8} containerStyle={[styles.headerSide, styles.headerRight]}>
          <CoinBalance coins={coins} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <Animated.View
          style={[
            styles.hero,
            { opacity: mount, transform: [{ translateY: mount.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
          ]}
        >
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{totals.solved.toLocaleString('en-US')}</Text>
              <Text style={styles.figureLabel}>Solved</Text>
            </View>
            <View style={styles.figureRule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{totals.solved > 0 ? Math.round((totals.perfect / totals.solved) * 100) : 0}%</Text>
              <Text style={styles.figureLabel}>No hints</Text>
            </View>
            <View style={styles.figureRule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>
                {totals.stamps}
                <Text style={styles.figureOf}>/{ROTATION.length * STAMP_STEPS.length}</Text>
              </Text>
              <Text style={styles.figureLabel}>Stamps</Text>
            </View>
          </View>
          <Text style={styles.sectionLabel}>Solves by game</Text>
          <SolveChart ledger={ledger} width={contentWidth - theme.spacing.md * 2} />
        </Animated.View>

        {/* Puzzle IQ: one score across every game, scaled by difficulty,
            and the shape of where it comes from. Moved here from Home,
            where it was one page too many. */}
        <View style={styles.hero}>
          <View style={styles.iqHead}>
            <Text style={styles.sectionLabel}>Puzzle IQ</Text>
            {aptitude.index !== null && <Text style={styles.iqPrecision}>{`${Math.round(aptitude.precision * 100)}% precision`}</Text>}
          </View>
          {aptitude.index === null ? (
            <Text style={styles.iqPending}>Solve a few more puzzles and your score will appear here.</Text>
          ) : (
            <Text style={styles.iqNumber}>{aptitude.index}</Text>
          )}
          <View style={styles.iqChart}>
            <AptitudeChart games={aptitude.games} size={Math.min(220, contentWidth - theme.spacing.md * 2)} />
          </View>
          {aptitude.strongest && aptitude.weakest && (
            <View style={styles.figures}>
              <View style={styles.figure}>
                <Text style={styles.iqFigureValue} numberOfLines={1}>{gameDisplayName(aptitude.strongest)}</Text>
                <Text style={styles.figureLabel}>Sharpest</Text>
              </View>
              <View style={styles.figureRule} />
              <View style={styles.figure}>
                <Text style={styles.iqFigureValue} numberOfLines={1}>{gameDisplayName(aptitude.weakest)}</Text>
                <Text style={styles.figureLabel}>Most room</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.albumSheet}>
          <View style={styles.albumHead}>
            <Text style={styles.albumTitle}>The album</Text>
            {totals.waiting > 0 ? (
              <Text style={styles.albumLive}>{`${totals.waiting} to claim`}</Text>
            ) : (
              <Text style={styles.albumTally}>{`${totals.stamps} of ${ROTATION.length * STAMP_STEPS.length}`}</Text>
            )}
          </View>
          <Text style={styles.albumNote}>
            {`A stamp at ${STAMP_STEPS.slice(0, -1).join(', ')} and ${STAMP_STEPS[STAMP_STEPS.length - 1]} solves in each game, paid when you claim it.`}
          </Text>
          {/* Deliberately not animated in: twelve canvases mounting inside a
              fade is the pattern that has failed to paint on a real phone. */}
          {held.map((kind, i) => (
            <AlbumEntry
              key={kind}
              first={i === 0}
              row={ledger[kind]}
              stamps={stampsOf(progress, ledger, kind)}
              retired={progress.retired.includes(kind)}
              collector={cosmeticsFor(skinSlot(kind)).filter(item => item.price > 0).every(item => owns(progress, item.id))}
              rowWidth={rowWidth}
              onClaim={claim}
            />
          ))}
          {ahead.length > 0 && (
            <View style={[styles.entry, styles.entryRuled, styles.ahead]}>
              <View style={styles.aheadEmblems}>
                {ahead.map(kind => (
                  <View key={kind} style={styles.aheadEmblem}>
                    <GameEmblem kind={kind} size={22} />
                  </View>
                ))}
              </View>
              <Text style={styles.aheadText}>{`${ahead.length} more ${ahead.length === 1 ? 'game arrives' : 'games arrive'} as you play, each with its own page.`}</Text>
            </View>
          )}
        </View>
      </ScrollView>
      {burst > 0 && <ConfettiBurst key={burst} />}
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
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  hero: {
    padding: theme.spacing.md,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  figures: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  figure: { flex: 1, alignItems: 'center' },
  figureRule: { width: 1, alignSelf: 'stretch', backgroundColor: theme.colors.border },
  figureValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.headline, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  figureOf: { fontSize: theme.typography.sizes.body, color: theme.colors.textTertiary },
  figureLabel: { fontSize: 11.5, color: theme.colors.textTertiary, marginTop: 2, fontWeight: theme.typography.weights.semibold },
  iqHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  iqPrecision: { fontSize: theme.typography.sizes.caption, color: theme.colors.secondary, fontWeight: theme.typography.weights.semibold },
  iqNumber: { fontFamily: theme.typography.families.display, fontSize: 56, lineHeight: 62, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  iqPending: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  iqChart: { alignItems: 'center', marginVertical: theme.spacing.md },
  iqFigureValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  sectionLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, marginBottom: theme.spacing.sm, fontWeight: theme.typography.weights.semibold },
  albumSheet: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderBottomWidth: 3,
    borderColor: theme.colors.border,
    borderBottomColor: theme.colors.borderStrong,
  },
  albumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  albumTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  albumTally: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  albumLive: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.gold },
  albumNote: { marginTop: 4, marginBottom: theme.spacing.sm, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary },
  entry: { paddingVertical: theme.spacing.md, gap: theme.spacing.md },
  entryRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderStrong },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryTitleBox: { flex: 1 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryTitle: { flexShrink: 1, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  entryLine: { marginTop: 2, fontSize: 12, color: theme.colors.textSecondary, fontWeight: theme.typography.weights.medium },
  entryCount: { alignItems: 'flex-end' },
  entryCountValue: { fontFamily: theme.typography.families.figures, fontVariant: ['tabular-nums'], fontSize: 20, lineHeight: 24, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  entryCountLabel: { fontSize: 10.5, color: theme.colors.textTertiary, fontWeight: theme.typography.weights.semibold },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.goldFill, borderBottomWidth: 2.5, borderBottomColor: theme.colors.goldRim },
  claimText: { fontSize: 13, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold },
  collector: { fontSize: 8.5, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold, backgroundColor: theme.colors.goldFill, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  retired: { fontSize: 8.5, color: theme.colors.textTertiary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, fontWeight: theme.typography.weights.semibold },
  ahead: { gap: theme.spacing.sm },
  aheadEmblems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aheadEmblem: { opacity: 0.4 },
  aheadText: { fontSize: 12, lineHeight: 17, color: theme.colors.textTertiary, fontWeight: theme.typography.weights.medium },
}));

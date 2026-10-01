import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { ConfettiBurst, PressableScale } from '../components';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { GameEmblemGlyph } from '../components/GameEmblem';
import { LedgerStampRow } from '../components/LedgerStamp';
import { PageBloom } from '../components/PageBloom';
import { accentColorForKind, gameDisplayName, GameKind, ROTATION } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { AptitudeChart } from '../components/AptitudeChart';
import { GameLedger, computeAptitude, STAMP_COINS, STAMP_NAMES, STAMP_STEPS, Stamp, cosmeticsFor, ledgerOf, owns, skinSlot, stampsOf, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';

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

function AlbumPage({
  row,
  stamps,
  retired,
  collector,
  rowWidth,
  onClaim,
}: {
  row: GameLedger;
  stamps: ReadonlyArray<Stamp>;
  retired: boolean;
  collector: boolean;
  rowWidth: number;
  onClaim: (stamp: Stamp) => void;
}): React.JSX.Element {
  const accent = accentColorForKind(row.kind);
  const next = stamps.find(s => !s.earned);
  const previousStep = next ? (next.rank === 0 ? 0 : STAMP_STEPS[next.rank - 1]) : 0;
  const share = next ? (row.solved - previousStep) / (next.step - previousStep) : 1;
  const ready = stamps.filter(s => s.earned && !s.claimed);
  const stampWidth = Math.min(54, (rowWidth - 3 * 12) / 4);
  const average = row.solved > 0 ? (row.stars / row.solved).toFixed(1) : '-';
  const perfect = row.solved > 0 ? Math.round((row.perfect / row.solved) * 100) : 0;

  return (
    <View style={[styles.page, ready.length > 0 && styles.pageReady]}>
      <View style={styles.pageHead}>
        <View style={styles.pageTitleBox}>
          <View style={styles.pageTitleRow}>
            <View style={[styles.pageSwatch, { backgroundColor: accent }]} />
            <Text style={styles.pageTitle} numberOfLines={1}>
              {gameDisplayName(row.kind)}
            </Text>
            {retired && <Text style={styles.retired}>RETIRED</Text>}
            {/* Every set in the shop for this game owned. */}
            {collector && <Text style={styles.collector}>{'\u2726\uFE0E COLLECTOR'}</Text>}
          </View>
          <Text style={styles.pageStats}>
            {row.solved > 0 ? `★ ${average} AVG · ${perfect}% PERFECT · ${row.byTier.hard} HARD` : 'NOT PLAYED YET'}
          </Text>
        </View>
        <View style={styles.pageCount}>
          <Text style={styles.pageCountValue}>{row.solved}</Text>
          <Text style={styles.pageCountLabel}>SOLVED</Text>
        </View>
      </View>

      <LedgerStampRow kind={row.kind} stamps={stamps} stampWidth={stampWidth} width={rowWidth} onClaim={onClaim} />

      <View style={styles.pageFoot}>
        {ready.length > 0 ? (
          <View style={styles.claimHint}>
            <Text style={styles.claimHintText}>TAP TO CLAIM</Text>
            <CoinGlyph size={11} />
            <Text style={styles.claimHintText}>{ready.reduce((sum, s) => sum + STAMP_COINS[s.rank], 0)}</Text>
          </View>
        ) : (
          <Text style={styles.pageFootText}>
            {next ? `${next.step - row.solved} MORE FOR ${STAMP_NAMES[next.rank].toUpperCase()}` : 'PAGE COMPLETE'}
          </Text>
        )}
        <View style={styles.pageTrack}>
          <View style={[styles.pageTrackFill, { width: `${Math.max(0, Math.min(1, share)) * 100}%`, backgroundColor: accent }]} />
        </View>
      </View>
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
    Animated.timing(mount, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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

  const claim = (stamp: Stamp) => {
    if (claimStamp(stamp.kind, stamp.step)) {
      triggerFeedback('coin');
      setBurst(b => b + 1);
    }
  };

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
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
              <Text style={styles.figureLabel}>SOLVED</Text>
            </View>
            <View style={styles.figureRule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{totals.solved > 0 ? Math.round((totals.perfect / totals.solved) * 100) : 0}%</Text>
              <Text style={styles.figureLabel}>PERFECT</Text>
            </View>
            <View style={styles.figureRule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>
                {totals.stamps}
                <Text style={styles.figureOf}>/{ROTATION.length * STAMP_STEPS.length}</Text>
              </Text>
              <Text style={styles.figureLabel}>STAMPS</Text>
            </View>
          </View>
          <Text style={styles.sectionLabel}>SOLVES BY GAME</Text>
          <SolveChart ledger={ledger} width={contentWidth - theme.spacing.md * 2} />
        </Animated.View>

        {/* Puzzle IQ: one score across every game, scaled by difficulty,
            and the shape of where it comes from. Moved here from Home,
            where it was one page too many. */}
        <View style={styles.hero}>
          <View style={styles.iqHead}>
            <Text style={styles.sectionLabel}>PUZZLE IQ</Text>
            {aptitude.index !== null && <Text style={styles.iqPrecision}>{`${Math.round(aptitude.precision * 100)}% PRECISION`}</Text>}
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
                <Text style={styles.figureLabel}>SHARPEST</Text>
              </View>
              <View style={styles.figureRule} />
              <View style={styles.figure}>
                <Text style={styles.iqFigureValue} numberOfLines={1}>{gameDisplayName(aptitude.weakest)}</Text>
                <Text style={styles.figureLabel}>MOST ROOM</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.albumHead}>
          <Text style={styles.sectionTitle}>THE ALBUM</Text>
          {totals.waiting > 0 && <Text style={[styles.sectionTitle, styles.sectionLive]}>{`${totals.waiting} TO CLAIM`}</Text>}
        </View>
        <Text style={styles.albumNote}>
          {`A stamp for ${STAMP_STEPS.slice(0, -1).join(', ')} and ${STAMP_STEPS[STAMP_STEPS.length - 1]} solves in each game - each one pays when you claim it.`}
        </Text>
        {/* Deliberately not animated in: twelve canvases mounting inside a
            fade is the pattern that has failed to paint on a real phone. */}
        <View style={styles.album}>
          {ROTATION.map(kind => (
            <AlbumPage
              key={kind}
              row={ledger[kind]}
              stamps={stampsOf(progress, ledger, kind)}
              retired={progress.retired.includes(kind)}
              collector={cosmeticsFor(skinSlot(kind)).filter(i => i.price > 0).every(i => owns(progress, i.id))}
              rowWidth={rowWidth}
              onClaim={claim}
            />
          ))}
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
  figureValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 4, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  figureOf: { fontSize: theme.typography.sizes.body, color: theme.colors.textTertiary },
  figureLabel: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 1.2, color: theme.colors.textTertiary, marginTop: 2 },
  iqHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  iqPrecision: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.2, color: theme.colors.secondary },
  iqNumber: { fontFamily: theme.typography.families.display, fontSize: 56, lineHeight: 62, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  iqPending: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  iqChart: { alignItems: 'center', marginVertical: theme.spacing.md },
  iqFigureValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  sectionLabel: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4, color: theme.colors.textTertiary, marginBottom: theme.spacing.sm },
  albumHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary, marginBottom: theme.spacing.sm },
  sectionLive: { color: theme.colors.gold, fontWeight: theme.typography.weights.bold },
  albumNote: { fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary, marginBottom: theme.spacing.md },
  album: { gap: theme.spacing.sm },
  page: {
    padding: theme.spacing.md,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  pageReady: { borderColor: theme.colors.goldRim, borderWidth: 1.5, backgroundColor: theme.colors.surfaceHi },
  pageHead: { flexDirection: 'row', alignItems: 'flex-start' },
  pageTitleBox: { flex: 1 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageSwatch: { width: 10, height: 10, borderRadius: 3 },
  pageTitle: { flexShrink: 1, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  collector: { fontFamily: theme.typography.families.mono, fontSize: 8.5, letterSpacing: 1, fontWeight: theme.typography.weights.bold, color: theme.colors.onGold, backgroundColor: theme.colors.goldFill, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  retired: { fontFamily: theme.typography.families.mono, fontSize: 8.5, letterSpacing: 1, color: theme.colors.textTertiary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  pageStats: { marginTop: 4, fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.6, color: theme.colors.textSecondary },
  pageCount: { alignItems: 'flex-end' },
  pageCountValue: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, lineHeight: theme.typography.sizes.title + 6, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  pageCountLabel: { fontFamily: theme.typography.families.mono, fontSize: 8.5, letterSpacing: 1, color: theme.colors.textTertiary },
  pageFoot: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  pageFootText: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 0.8, color: theme.colors.textTertiary },
  claimHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimHintText: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 0.8, fontWeight: theme.typography.weights.bold, color: theme.colors.gold },
  pageTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  pageTrackFill: { height: 4, borderRadius: 2 },
}));

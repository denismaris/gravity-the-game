import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfettiBurst, PressableScale } from '../components';
import { CoinBalance, CoinGlyph } from '../components/Coins';
import { CosmeticPreview } from '../components/CosmeticPreview';
import { PageBloom } from '../components/PageBloom';
import { RankMedal } from '../components/RankMedal';
import { XpBar } from '../components/XpBar';
import { triggerFeedback } from '../game/rendering';
import {
  Chapter,
  LEVELS_PER_CHAPTER,
  RANKS,
  XP_PER_ERRAND,
  XP_PER_PUZZLE,
  XP_PER_STAR,
  XP_PER_STREAK_DAY,
  chapterAt,
  chaptersFinished,
  cosmeticById,
  currentChapter,
  rankOf,
  rankTitle,
  toRoman,
  usePlayerProgress,
} from '../progression';
import { rankAt } from '../progression/rank';
import { motion, theme, themedStyles } from '../theme';

export interface JourneyScreenProps {
  onExit: () => void;
  onOpenShop: () => void;
}

const fmt = (n: number): string => n.toLocaleString('en-US');

function Reward({ chapter }: { chapter: Chapter }): React.JSX.Element {
  const cosmetic = chapter.cosmetic ? cosmeticById(chapter.cosmetic) : null;
  return (
    <View style={styles.reward}>
      <View style={styles.rewardCoins}>
        <CoinGlyph size={15} />
        <Text style={styles.rewardCoinsText}>{chapter.coins}</Text>
      </View>
      {cosmetic && (
        <View style={styles.rewardItem}>
          <View style={styles.rewardPreview}>
            <CosmeticPreview item={cosmetic} size={34} />
          </View>
          <Text style={styles.rewardItemText} numberOfLines={1}>
            {cosmetic.name}
          </Text>
        </View>
      )}
    </View>
  );
}

/** A finished chapter: claim its reward, or see it claimed. */
function ChapterRow({ chapter, claimed, onClaim }: { chapter: Chapter; claimed: boolean; onClaim: () => void }): React.JSX.Element {
  const pop = useRef(new Animated.Value(1)).current;
  const claim = () => {
    pop.setValue(0.9);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    onClaim();
  };
  return (
    <Animated.View style={[styles.chapterRow, !claimed && styles.chapterRowReady, { transform: [{ scale: pop }] }]}>
      <View style={[styles.numeral, claimed && styles.numeralDone]}>
        <Text style={[styles.numeralText, claimed && styles.numeralTextDone]}>{toRoman(chapter.number)}</Text>
      </View>
      <View style={styles.chapterBody}>
        <Text style={styles.chapterName}>{chapter.name}</Text>
        <Text style={styles.chapterMeta}>
          LEVELS {chapter.firstLevel}–{chapter.lastLevel}
        </Text>
      </View>
      {claimed ? (
        <Text style={styles.claimedText}>{'✓︎ CLAIMED'}</Text>
      ) : (
        <PressableScale accessibilityRole="button" accessibilityLabel={`Claim chapter ${chapter.number} reward`} onPress={claim} style={({ pressed }) => [styles.claim, pressed && styles.pressed]}>
          <Text style={styles.claimText}>Claim</Text>
          <CoinGlyph size={13} />
          <Text style={styles.claimText}>{chapter.coins}</Text>
        </PressableScale>
      )}
    </Animated.View>
  );
}

/**
 * The player's almanac: where they stand and where the road goes - their
 * rank and experience, the chapter under way and its reward, finished
 * chapters to claim, and the ranks ahead.
 */
export function JourneyScreen({ onExit, onOpenShop }: JourneyScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress, coins, claimChapter } = usePlayerProgress();
  const rank = rankOf(progress);
  const { chapter, levelsDone } = currentChapter(progress);
  const finished = chaptersFinished(progress);
  const [burst, setBurst] = useState(0);
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(mount, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [mount]);
  const rise = (from: number) => ({
    opacity: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: mount.interpolate({ inputRange: [from, Math.min(1, from + 0.4)], outputRange: [14, 0], extrapolate: 'clamp' }) }],
  });

  const nextTitle = rankTitle(rank.number + 1);
  const ladderTop = Math.max(RANKS.length, rank.number + 2);
  const pastChapters = Array.from({ length: finished }, (_v, i) => chapterAt(finished - i));

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Your Almanac</Text>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Open the shop" onPress={onOpenShop} hitSlop={8} containerStyle={[styles.headerSide, styles.headerRight]}>
          <CoinBalance coins={coins} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <Animated.View style={[styles.hero, rise(0)]}>
          <RankMedal rank={rank.number} size={124} />
          <Text style={styles.heroKicker}>
            RANK {toRoman(rank.number)} · {fmt(rank.xp)} XP
          </Text>
          <Text style={styles.heroTitle}>{rank.title}</Text>
          <XpBar share={rank.share} style={styles.heroBar} />
          <Text style={styles.heroNext}>
            {fmt(rank.to - rank.xp)} XP TO {nextTitle.toUpperCase()}
          </Text>
          {/* How experience is earned, as a small table rather than a row
              of codes. */}
          <View style={styles.earnTable}>
            {(
              [
                ['A star', XP_PER_STAR],
                ['A puzzle solved', XP_PER_PUZZLE],
                ['An errand done', XP_PER_ERRAND],
                ['A day on your streak', XP_PER_STREAK_DAY],
              ] as const
            ).map(([label, xp]) => (
              <View key={label} style={styles.earnCell}>
                <Text style={styles.earnValue}>{`+${xp} XP`}</Text>
                <Text style={styles.earnLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={rise(0.12)}>
          <Text style={styles.sectionTitle}>THIS CHAPTER</Text>
          <View style={styles.current}>
            <Text style={styles.currentKicker}>CHAPTER {toRoman(chapter.number)}</Text>
            <Text style={styles.currentName}>{chapter.name}</Text>
            <View style={styles.ticks}>
              {Array.from({ length: LEVELS_PER_CHAPTER }, (_v, i) => (
                <View key={i} style={[styles.tick, i < levelsDone && styles.tickDone, i === levelsDone && styles.tickNow]}>
                  <Text style={[styles.tickText, i < levelsDone && styles.tickTextDone]}>{chapter.firstLevel + i}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.currentMeta}>
              {LEVELS_PER_CHAPTER - levelsDone} LEVEL{LEVELS_PER_CHAPTER - levelsDone === 1 ? '' : 'S'} TO THE REWARD
            </Text>
            <Reward chapter={chapter} />
          </View>
        </Animated.View>

        {pastChapters.length > 0 && (
          <Animated.View style={rise(0.22)}>
            <Text style={styles.sectionTitle}>FINISHED CHAPTERS</Text>
            <View style={styles.list}>
              {pastChapters.map(c => (
                <ChapterRow
                  key={c.number}
                  chapter={c}
                  claimed={progress.chaptersClaimed.includes(c.number)}
                  onClaim={() => {
                    if (claimChapter(c.number)) {
                      triggerFeedback('coin');
                      setBurst(b => b + 1);
                    }
                  }}
                />
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View style={rise(0.3)}>
          <Text style={styles.sectionTitle}>THE ROAD</Text>
          <View style={styles.list}>
            {Array.from({ length: ladderTop }, (_v, i) => i + 1).map(n => {
              const reached = n <= rank.number;
              const current = n === rank.number;
              const at = n <= RANKS.length ? RANKS[n - 1].at : rankAt(RANKS[RANKS.length - 1].at + (n - RANKS.length) * 2000).from;
              return (
                <View key={n} style={[styles.rung, current && styles.rungCurrent, !reached && styles.rungAhead]}>
                  <RankMedal rank={n} size={40} />
                  <View style={styles.rungBody}>
                    <Text style={styles.rungTitle}>{rankTitle(n)}</Text>
                    <Text style={styles.rungMeta}>{current ? 'YOU ARE HERE' : reached ? 'REACHED' : `AT ${fmt(at)} XP`}</Text>
                  </View>
                  {reached && !current && <Text style={styles.rungTick}>{'✓︎'}</Text>}
                </View>
              );
            })}
          </View>
        </Animated.View>

        <PressableScale accessibilityRole="button" accessibilityLabel="Visit the shop" onPress={onOpenShop} style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}>
          <Text style={styles.shopButtonText}>Visit the shop</Text>
          <Text style={styles.shopChevron}>›</Text>
        </PressableScale>
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
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  heroKicker: { marginTop: theme.spacing.sm, fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary },
  heroTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.headline + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  heroBar: { marginTop: theme.spacing.md },
  heroNext: { marginTop: 6, fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.textSecondary },
  earnTable: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch', marginTop: theme.spacing.lg, paddingTop: theme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, rowGap: theme.spacing.sm },
  earnCell: { width: '50%', alignItems: 'center' },
  earnValue: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  earnLabel: { fontSize: theme.typography.sizes.micro + 1, color: theme.colors.textTertiary },
  sectionTitle: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary, marginBottom: theme.spacing.sm },
  current: { padding: theme.spacing.lg, borderRadius: 22, backgroundColor: theme.colors.surfaceHi, borderWidth: 1.5, borderColor: theme.colors.accent, marginBottom: theme.spacing.xl },
  currentKicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.accent },
  currentName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  ticks: { flexDirection: 'row', gap: 4, marginTop: theme.spacing.md },
  tick: { flex: 1, height: 26, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  tickDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tickNow: { borderColor: theme.colors.accent, borderWidth: 2 },
  tickText: { fontFamily: theme.typography.families.mono, fontSize: 8.5, color: theme.colors.textTertiary },
  tickTextDone: { color: theme.colors.surfaceHi },
  currentMeta: { marginTop: theme.spacing.sm, fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.textSecondary },
  reward: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  rewardCoins: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rewardCoinsText: { fontFamily: theme.typography.families.mono, fontWeight: theme.typography.weights.bold, fontSize: theme.typography.sizes.body, color: theme.colors.textPrimary },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  rewardPreview: { width: 42, height: 42, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rewardItemText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary, flexShrink: 1 },
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chapterRowReady: { backgroundColor: theme.colors.surfaceHi, borderColor: theme.colors.accent, borderWidth: 1.5 },
  numeral: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  numeralDone: { backgroundColor: theme.colors.surfaceAlt },
  numeralText: { fontFamily: theme.typography.families.display, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi, fontSize: 14 },
  numeralTextDone: { color: theme.colors.textSecondary },
  chapterBody: { flex: 1 },
  chapterName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  chapterMeta: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary, marginTop: 2 },
  claimedText: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1, color: theme.colors.success },
  claim: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  claimText: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.caption },
  rung: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 8, paddingHorizontal: theme.spacing.md, borderRadius: 16 },
  rungCurrent: { backgroundColor: theme.colors.surfaceHi, borderWidth: 1.5, borderColor: theme.colors.accent },
  rungAhead: { opacity: 0.5 },
  rungBody: { flex: 1 },
  rungTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  rungMeta: { fontFamily: theme.typography.families.mono, fontSize: 9.5, letterSpacing: 0.8, color: theme.colors.textTertiary, marginTop: 2 },
  rungTick: { color: theme.colors.success, fontSize: 16, fontWeight: theme.typography.weights.bold },
  shopButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: theme.spacing.md, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  shopButtonText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.semibold },
  shopChevron: { color: theme.colors.surfaceHi, fontSize: 22, marginTop: -2 },
  pressed: { opacity: 0.85 },
}));

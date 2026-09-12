import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getJourneyPoint, usePlayerProgress } from '../progression';
import { getLevelById, getStarThresholds } from '../game/levels';
import { GameKind, getDailyEntry } from '../game/journey';
import { theme } from '../theme';

export interface HomeScreenProps {
  /** Open a journey puzzle (any of the three games). */
  onOpen: (target: { kind: GameKind; puzzleId: string }) => void;
}

/**
 * Home - the cover page of a puzzle almanac. A masthead, one dominant
 * Continue card for the next Journey entry (gravity, constellation or
 * trajectory), a Daily card, and a line of figures. No level select.
 */
export function HomeScreen({ onOpen }: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress, totalStars, markLevelOpened, dailyStreak, dailyCompletedToday } =
    usePlayerProgress();

  const journey = useMemo(() => getJourneyPoint(progress), [progress]);
  const entry = journey.entry;
  const isGravity = entry.kind === 'gravity';

  const gravityLevel = isGravity ? getLevelById(entry.puzzleId) : undefined;
  const par = gravityLevel ? getStarThresholds(gravityLevel).three : 0;
  const solved = journey.completedCount;
  const pct = journey.total ? solved / journey.total : 0;

  const openEntry = (): void => {
    if (gravityLevel) markLevelOpened(gravityLevel.id);
    onOpen({ kind: entry.kind, puzzleId: entry.puzzleId });
  };

  // The Daily is a fixed side quest into the whole pool, independent of the
  // Journey's own resume position - see `getDailyEntry`. Its streak lives on
  // `PlayerProgress.daily` and updates itself the moment `recordCompletion`
  // sees this exact puzzle id solved, from whichever screen plays it.
  const daily = useMemo(() => getDailyEntry(), []);
  const openDaily = (): void => onOpen({ kind: daily.kind, puzzleId: daily.puzzleId });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 36 },
      ]}
    >
      <View style={styles.masthead}>
        <Text style={styles.wordmark}>GRAVITY</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>AN ALMANAC OF PUZZLES</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${journey.allDone ? 'Replay' : 'Continue'}: ${entry.name}, No. ${
          journey.position
        } of ${journey.total}`}
        onPress={openEntry}
        style={({ pressed }) => [styles.card, styles.cardHero, pressed && styles.cardPressed]}
      >
        <Text style={styles.eyebrow}>JOURNEY · {entry.chapter.toUpperCase()}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {entry.name}
        </Text>
        <Text style={styles.heroMeta}>
          No. {journey.position} of {journey.total}
          {'      '}
          {isGravity ? `PAR ${par}` : entry.chapter.toUpperCase()}
        </Text>

        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>

        <View style={styles.heroFoot}>
          <Text style={styles.verb}>{journey.allDone ? 'Replay' : 'Continue'}</Text>
          <View style={styles.play}>
            <View style={styles.playTri} />
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Daily puzzle: ${daily.name}${
          dailyCompletedToday ? ', already solved today' : ''
        }`}
        onPress={openDaily}
        style={({ pressed }) => [styles.card, styles.cardMuted, pressed && styles.cardPressed]}
      >
        <View style={styles.dailyHead}>
          <Text style={styles.eyebrowMuted}>
            DAILY{dailyStreak > 0 ? ` · ${dailyStreak} DAY${dailyStreak > 1 ? 'S' : ''}` : ''}
          </Text>
          <Text style={styles.dailyBadge}>{dailyCompletedToday ? 'SOLVED' : 'PLAY'}</Text>
        </View>
        <Text style={styles.dailyTitle} numberOfLines={1}>
          {daily.name}
        </Text>
        <Text style={styles.dailyMeta}>
          {daily.chapter.toUpperCase()}
          {dailyCompletedToday ? ' · come back tomorrow' : ' · a new one every day'}
        </Text>
      </Pressable>

      <Text style={styles.stats}>
        {solved} of {journey.total} solved
        {'      '}
        <Text style={styles.statsStar}>★</Text> {totalStars}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },

  masthead: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: theme.typography.tracking.wordmark,
    color: theme.colors.textPrimary,
  },
  rule: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.borderStrong,
    marginVertical: theme.spacing.sm,
  },
  tagline: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 2,
    color: theme.colors.textTertiary,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: '#2A251F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHero: {
    paddingVertical: theme.spacing.xl,
  },
  cardMuted: {
    backgroundColor: theme.colors.background,
    shadowOpacity: 0,
    elevation: 0,
    borderColor: theme.colors.border,
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },

  eyebrow: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.secondary,
  },
  eyebrowMuted: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.textTertiary,
  },
  heroTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.display,
    lineHeight: theme.typography.lineHeights.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 8,
  },
  heroMeta: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginTop: 12,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.secondary,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  verb: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  play: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTri: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: theme.colors.surfaceHi,
    marginLeft: 5,
  },

  dailyHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyBadge: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.textTertiary,
  },
  dailyTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  dailyMeta: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginTop: 6,
  },

  stats: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
  statsStar: {
    color: theme.colors.accent,
  },
});

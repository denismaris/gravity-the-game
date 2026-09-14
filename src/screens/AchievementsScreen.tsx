import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { ACHIEVEMENTS, usePlayerProgress } from '../progression';
import { theme } from '../theme';

export interface AchievementsScreenProps {
  onExit: () => void;
}

/** How far into the shared `mount` driver row `index` finishes its own
 * fade/rise - spaced so the list reads as one confident cascade rather
 * than all 18 rows snapping in together, capped so a long list still
 * settles well within `MOUNT_DURATION_MS`. */
const STAGGER_STEP = 0.045;
const STAGGER_START = 0.12;
const MOUNT_DURATION_MS = 620;

function riseIn(mount: Animated.Value, endsAt: number) {
  const start = Math.max(0, endsAt - 0.3);
  return {
    opacity: mount.interpolate({ inputRange: [start, endsAt], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: mount.interpolate({ inputRange: [start, endsAt], outputRange: [10, 0], extrapolate: 'clamp' }),
      },
    ],
  };
}

/**
 * Every achievement, earned or not. Nothing here is stored - `Achievement.
 * isEarned` is recomputed live from `PlayerProgress` every time this screen
 * opens (see `src/progression/achievements.ts`), so it can never drift from
 * what the player has actually done.
 */
export function AchievementsScreen({ onExit }: AchievementsScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress } = usePlayerProgress();

  const earnedCount = ACHIEVEMENTS.filter(a => a.isEarned(progress)).length;

  // A quiet cascade every time this screen opens, the same "arrived, not
  // just present" idea Home's own masthead/cards use.
  const mount = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mount.setValue(0);
    Animated.timing(mount, {
      toValue: 1,
      duration: MOUNT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mount]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Achievements</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.summary}>
          {earnedCount} of {ACHIEVEMENTS.length} earned
        </Text>

        {ACHIEVEMENTS.map((achievement, index) => {
          const earned = achievement.isEarned(progress);
          const endsAt = Math.min(1, STAGGER_START + index * STAGGER_STEP);
          return (
            <Animated.View
              key={achievement.id}
              style={[styles.row, earned && styles.rowEarned, riseIn(mount, endsAt)]}
              accessibilityRole="text"
              accessibilityLabel={`${achievement.title}${earned ? ', earned' : ', not yet earned'}. ${achievement.description}`}
            >
              <View style={[styles.badge, earned && styles.badgeEarned]}>
                <Text style={[styles.badgeGlyph, earned && styles.badgeGlyphEarned]}>{'★'}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, !earned && styles.rowTitleLocked]}>{achievement.title}</Text>
                <Text style={styles.rowDescription}>{achievement.description}</Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56 },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  summary: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowEarned: {
    borderColor: theme.colors.accent,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  badgeEarned: {
    backgroundColor: theme.colors.accent,
  },
  badgeGlyph: {
    fontSize: 18,
    color: theme.colors.textDisabled,
  },
  badgeGlyphEarned: {
    color: theme.colors.surfaceHi,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  rowTitleLocked: {
    color: theme.colors.textSecondary,
  },
  rowDescription: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
  },
});

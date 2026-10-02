import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { PressableScale } from '../components';
import { AchievementMedal } from '../components/AchievementMedal';
import { PageBloom } from '../components/PageBloom';
import { useReducedMotion } from '../game/rendering';
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, Achievement, nearestAchievements, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';

export interface AchievementsScreenProps {
  onExit: () => void;
}

/** A ring of how much of the shelf is filled. */
function Ring({ share, size }: { share: number; size: number }): React.JSX.Element {
  const stroke = size * 0.1;
  const r = (size - stroke) / 2;
  const arc = useMemo(() => {
    const path = Skia.Path.Make();
    path.addArc({ x: stroke / 2, y: stroke / 2, width: r * 2, height: r * 2 }, -90, Math.max(0.5, share * 360));
    return path;
  }, [share, r, stroke]);
  const track = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(size / 2, size / 2, r);
    return path;
  }, [size, r]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Path path={track} color={theme.colors.surfaceAlt} style="stroke" strokeWidth={stroke} />
      <Path path={arc} color={theme.colors.accent} style="stroke" strokeWidth={stroke} strokeCap="round" />
    </Canvas>
  );
}

/** One achievement: its medal, what it asks, and - until earned - how far
 * along you are. */
function Row({ achievement, earned, value, target, style }: { achievement: Achievement; earned: boolean; value: number; target: number; style?: object }): React.JSX.Element {
  const share = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <Animated.View
      style={[styles.row, earned && styles.rowEarned, style]}
      accessible
      accessibilityLabel={`${achievement.title}${earned ? ', earned' : `, ${Math.min(value, target)} of ${target}`}. ${achievement.description}`}
    >
      <AchievementMedal achievement={achievement} earned={earned} size={44} />
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text style={[styles.rowTitle, !earned && styles.rowTitleLocked]} numberOfLines={1}>
            {achievement.title}
          </Text>
          {earned ? (
            <Text style={styles.earned}>{'Earned ✓︎'}</Text>
          ) : target > 1 ? (
            <Text style={styles.count}>{`${Math.min(value, target).toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`}</Text>
          ) : null}
        </View>
        <Text style={styles.rowDescription}>{achievement.description}</Text>
        {!earned && target > 1 && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${share * 100}%` }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Every achievement, by kind, with the closest few up front. Nothing here
 * is stored: earned state and progress are recomputed from the save each
 * time (see `achievements.ts`), so they can never drift from what the
 * player has done.
 */
export function AchievementsScreen({ onExit }: AchievementsScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress } = usePlayerProgress();
  const reduced = useReducedMotion();

  const rows = useMemo(
    () =>
      ACHIEVEMENTS.map(achievement => {
        const m = achievement.measure(progress);
        return { achievement, earned: achievement.isEarned(progress), value: m.value, target: m.target };
      }),
    [progress],
  );
  const byId = useMemo(() => new Map(rows.map(r => [r.achievement.id, r])), [rows]);
  const earnedCount = rows.filter(r => r.earned).length;
  const closest = useMemo(() => nearestAchievements(progress, 3), [progress]);

  // One driver for the whole page; each block rises on its own beat.
  const mount = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(mount, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [mount, reduced]);
  let beat = 0;
  const rise = () => {
    const end = Math.min(1, 0.25 + beat * 0.06);
    beat += 1;
    const start = Math.max(0, end - 0.25);
    return {
      opacity: mount.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
      transform: [{ translateY: mount.interpolate({ inputRange: [start, end], outputRange: [12, 0], extrapolate: 'clamp' }) }],
    };
  };

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Achievements</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <Animated.View style={[styles.hero, rise()]}>
          <Ring share={earnedCount / ACHIEVEMENTS.length} size={76} />
          <View style={styles.heroText}>
            <Text style={styles.heroCount}>
              {earnedCount}
              <Text style={styles.heroOf}>{` of ${ACHIEVEMENTS.length}`}</Text>
            </Text>
            <Text style={styles.heroLine}>{earnedCount === 0 ? 'Your first one is closer than you think.' : earnedCount === ACHIEVEMENTS.length ? 'Every one of them. Remarkable.' : 'earned so far'}</Text>
          </View>
        </Animated.View>

        {closest.length > 0 && (
          <Animated.View style={rise()}>
            <Text style={styles.groupTitle}>Closest next</Text>
            {closest.map(a => {
              const r = byId.get(a.id)!;
              return <Row key={a.id} achievement={a} earned={false} value={r.value} target={r.target} style={styles.rowClose} />;
            })}
          </Animated.View>
        )}

        {ACHIEVEMENT_GROUPS.map(group => {
          const items = rows.filter(r => r.achievement.group === group.id);
          if (items.length === 0) return null;
          const done = items.filter(r => r.earned).length;
          return (
            <Animated.View key={group.id} style={rise()}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                <Text style={styles.groupCount}>{`${done} / ${items.length}`}</Text>
              </View>
              {/* Earned first, then the closest to done. */}
              {[...items]
                .sort((x, y) => Number(y.earned) - Number(x.earned) || y.value / Math.max(1, y.target) - x.value / Math.max(1, x.target))
                .map(r => (
                  <Row key={r.achievement.id} achievement={r.achievement} earned={r.earned} value={r.value} target={r.target} />
                ))}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 80 },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heroText: { flex: 1 },
  heroCount: { fontFamily: theme.typography.families.display, fontSize: 40, lineHeight: 46, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  heroOf: { fontSize: theme.typography.sizes.title, color: theme.colors.textTertiary },
  heroLine: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  groupTitle: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  groupCount: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowEarned: { backgroundColor: theme.colors.surfaceHi },
  rowClose: { borderColor: theme.colors.goldRim },
  rowText: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
  rowTitle: { flexShrink: 1, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  rowTitleLocked: { color: theme.colors.textSecondary },
  earned: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.success },
  count: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary, fontVariant: ['tabular-nums'] },
  rowDescription: { marginTop: 2, fontSize: theme.typography.sizes.caption, lineHeight: 17, color: theme.colors.textTertiary },
  track: { height: 4, borderRadius: 2, marginTop: 8, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.accent },
}));

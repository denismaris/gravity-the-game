import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCompletedCount, getLevelPoint, TOTAL_PUZZLE_COUNT, usePlayerProgress } from '../progression';
import { getLevelById, getStarThresholds } from '../game/levels';
import { accentColorForKind, GameKind, getDailyEntry } from '../game/journey';
import { GameEmblem, GeometricRule, PressableScale } from '../components';
import { useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

/** A fade/rise that finishes at `endsAt` (a fraction of the shared `mount`
 * driver) - staggering several elements off one Animated.Value instead of
 * timing each separately. */
function riseIn(mount: Animated.Value, endsAt: number) {
  const start = Math.max(0, endsAt - 0.4);
  return {
    opacity: mount.interpolate({ inputRange: [start, endsAt], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: mount.interpolate({
          inputRange: [start, endsAt],
          outputRange: [14, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  };
}

export interface HomeScreenProps {
  /** Open a puzzle from the current level batch (any game). */
  onOpen: (target: { kind: GameKind; puzzleId: string }) => void;
  /** Open the Settings screen. */
  onOpenSettings: () => void;
  /** Open the achievements screen. */
  onOpenAchievements: () => void;
}

/**
 * Home - the cover page of a puzzle almanac. A masthead, one dominant
 * Continue card for the current level batch's next puzzle (whichever game
 * that is), a Daily card, and a line of figures. A small Settings gear and
 * the stats line itself (which opens Achievements) are the only other ways
 * out of the single Continue-driven flow - there is no level-select/browse
 * screen (see `src/progression/batches.ts`'s own comment for why: the
 * randomized level-batch system replaces that need entirely).
 */
export function HomeScreen({
  onOpen,
  onOpenSettings,
  onOpenAchievements,
}: HomeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  // A slow, endless swell behind the primary action. Deliberately the only
  // looping animation in the app: one quiet sign of life reads as alive,
  // several read as restless. Skipped outright under reduced motion -
  // this is decoration with no state behind it, so unlike the app's other
  // motion there is nothing lost by stopping it.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reducedMotion]);
  const { progress, totalStars, markLevelOpened, dailyStreak, dailyCompletedToday } =
    usePlayerProgress();

  const levelPoint = useMemo(() => getLevelPoint(progress), [progress]);
  const entry = levelPoint.entry;
  const isGravity = entry.kind === 'gravity';

  const gravityLevel = isGravity ? getLevelById(entry.puzzleId) : undefined;
  const par = gravityLevel ? getStarThresholds(gravityLevel).three : 0;
  // The hero card's own progress bar tracks *this batch* (a handful of
  // puzzles, so it actually fills up and resets at a satisfying pace) - the
  // lifetime total across every game lives in the stats line below instead
  // (`solved`/`TOTAL_PUZZLE_COUNT`), which is what the old Journey-wide
  // fraction actually meant before batches existed.
  const batchSolved = progress.currentBatch?.completedPuzzleIds.length ?? 0;
  const pct = levelPoint.batchSize ? batchSolved / levelPoint.batchSize : 0;
  const solved = getCompletedCount(progress);

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

  // A quiet cascade on every visit to Home (not just first mount - Home
  // remounts fresh each time the player backs out of a puzzle), so the hub
  // never feels like a static screen you're just returning to. The progress
  // fill animates separately so it reads as "counting up to here" rather
  // than popping straight to its resting width.
  const mount = useRef(new Animated.Value(0)).current;
  const trackFill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    mount.setValue(0);
    Animated.timing(mount, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mount]);
  useEffect(() => {
    Animated.timing(trackFill, {
      toValue: pct,
      duration: 700,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't a transform - can't use the native driver
    }).start();
  }, [pct, trackFill]);

  return (
    <View style={styles.container}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={onOpenSettings}
        hitSlop={8}
        containerStyle={[styles.settingsButton, { top: insets.top + theme.spacing.sm }]}
      >
        {/* U+FE0E forces the plain monochrome glyph - without it iOS renders
            a full-colour emoji gear that clashes with the flat paper
            palette (Android already renders plain either way). */}
        <Text style={styles.settingsGlyph}>{'⚙︎'}</Text>
      </PressableScale>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 36 },
        ]}
      >
        <Animated.View style={[styles.masthead, riseIn(mount, 0.45)]}>
          <Text style={styles.wordmark}>GRAVITY</Text>
          <GeometricRule variant="masthead" style={styles.rule} />
          <Text style={styles.tagline}>AN ALMANAC OF PUZZLES</Text>
        </Animated.View>

        <Animated.View style={riseIn(mount, 0.7)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${levelPoint.allDone ? 'Replay' : 'Continue'}: ${entry.name}, Level ${
              levelPoint.levelNumber
            }, puzzle ${levelPoint.batchPosition} of ${levelPoint.batchSize}`}
            onPress={openEntry}
            scaleTo={0.985}
            style={({ pressed }) => [styles.card, styles.cardHero, pressed && styles.cardPressed]}
          >
            <Text style={[styles.eyebrow, { color: accentColorForKind(entry.kind) }]}>
              LEVEL {levelPoint.levelNumber} · {entry.chapter.toUpperCase()}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {entry.name}
            </Text>
            <Text style={styles.heroMeta}>
              Puzzle {levelPoint.batchPosition} of {levelPoint.batchSize}
              {'      '}
              {isGravity ? `PAR ${par}` : entry.chapter.toUpperCase()}
            </Text>

            <View style={styles.track}>
              <Animated.View
                style={[
                  styles.trackFill,
                  {
                    width: trackFill.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
            </View>

            {/* The games this level is actually made of. The card already
                said "Puzzle 2 of 5" - a number that says how far along you
                are but nothing about what is coming. These say what the
                rest of the set is, and a finished one is filled while the
                ones ahead sit faded: a preview, not a mystery. */}
            {progress.currentBatch && (
              <View style={styles.setRow}>
                {progress.currentBatch.puzzles.map((entryRef, i) => {
                  const completed = progress.currentBatch!.completedPuzzleIds;
                  const done = completed.includes(entryRef.puzzleId);
                  // The one you are about to play reads as live too, not
                  // pending - otherwise a fresh set shows five faded marks
                  // and nothing on this card looks current.
                  const isCurrent = !done && completed.length === i;
                  return (
                    <View key={`${entryRef.puzzleId}-${i}`} style={done || isCurrent ? undefined : styles.setAhead}>
                      <GameEmblem kind={entryRef.kind} size={26} />
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.heroFoot}>
              <Text style={styles.verb}>{levelPoint.allDone ? 'Replay' : 'Continue'}</Text>
              <View style={styles.playWrap}>
                {/* A halo breathing out of the button - the one thing on a
                    resting Home screen that moves, so the page reads as
                    idling rather than frozen. Sits *behind* the button and
                    never intercepts touches. */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.playHalo,
                    {
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                    },
                  ]}
                />
                <View style={styles.play}>
                  <View style={styles.playTri} />
                </View>
              </View>
            </View>
          </PressableScale>
        </Animated.View>

        <Animated.View style={riseIn(mount, 0.9)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Daily puzzle: ${daily.name}${
              dailyCompletedToday ? ', already solved today' : ''
            }`}
            onPress={openDaily}
            scaleTo={0.985}
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
          </PressableScale>
        </Animated.View>

        <Animated.View style={riseIn(mount, 0.9)}>
          <GeometricRule variant="quiet" style={styles.footerRule} />
        </Animated.View>

        <Animated.View style={riseIn(mount, 1)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Achievements: ${solved} of ${TOTAL_PUZZLE_COUNT} solved, ${totalStars} stars`}
            onPress={onOpenAchievements}
            style={({ pressed }) => [pressed && styles.statsPressed]}
          >
            <Text style={styles.stats}>
              {solved} of {TOTAL_PUZZLE_COUNT} solved
              {'      '}
              <Text style={styles.statsStar}>★</Text> {totalStars}
            </Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </View>
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
  settingsButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    zIndex: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsGlyph: {
    fontSize: 20,
    color: theme.colors.textSecondary,
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
  /** Measured rather than fixed: the mark inside places itself at
   * fractions of the real width, so it keeps its rhythm on any screen. */
  rule: {
    marginVertical: theme.spacing.xs,
  },
  /** Closes the page the way the masthead opens it - the quietest variant,
   * since by here the eye has already had the full phrase up top. */
  footerRule: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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
    shadowColor: '#3B1F52',
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
  setRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  /** Games still to come, held back so the finished ones read as done. */
  setAhead: {
    opacity: 0.35,
  },
  playWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHalo: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.secondary,
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
  statsPressed: {
    opacity: 0.6,
  },
  statsStar: {
    color: theme.colors.accent,
  },
});

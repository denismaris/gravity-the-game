import React, { useMemo } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { GameEmblem } from '../components/GameEmblem';
import { PageBloom } from '../components/PageBloom';
import { LESSON_GUIDES } from '../components/lessons/guides';
import { accentColorForKind, gameDisplayName, GameKind } from '../game/journey';
import { INTRO_ORDER, ledgerOf, nextGameToArrive, unlockedGames, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';

export interface CollectionScreenProps {
  onExit: () => void;
  /** Plays a game's hands-on lesson again. */
  onReplayLesson: (kind: GameKind) => void;
}

/**
 * Your games: all twelve, in the order they arrive. The ones you have are
 * in colour, with what you have done in each and their lesson to play
 * again; the next one says how soon it comes; the rest wait, dimmed, so
 * the shape of the whole collection is always in view.
 */
export function CollectionScreen({ onExit, onReplayLesson }: CollectionScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { progress } = usePlayerProgress();
  const roster = useMemo(() => unlockedGames(progress), [progress]);
  const arriving = useMemo(() => nextGameToArrive(progress), [progress]);
  const ledger = useMemo(() => ledgerOf(progress), [progress]);
  const cardWidth = (width - theme.spacing.lg * 2 - theme.spacing.sm) / 2;

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Your games</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <Animated.View entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={styles.hero}>
          <Text style={styles.count}>
            {roster.length}
            <Text style={styles.countOf}>{` of ${INTRO_ORDER.length}`}</Text>
          </Text>
          <Text style={styles.countLabel}>{roster.length === INTRO_ORDER.length ? 'Every game is yours.' : 'games so far. Ten puzzles of the newest one bring the next.'}</Text>
          <View style={styles.track}>
            {INTRO_ORDER.map(kind => (
              <View key={kind} style={[styles.trackCell, roster.includes(kind) && { backgroundColor: accentColorForKind(kind) }]} />
            ))}
          </View>
        </Animated.View>

        <View style={styles.grid}>
          {INTRO_ORDER.map((kind, i) => {
            const have = roster.includes(kind);
            const next = arriving?.kind === kind;
            const row = ledger[kind];
            return (
              <Animated.View
                key={kind}
                entering={FadeInDown.duration(380).delay(120 + i * 35).easing(Easing.out(Easing.cubic))}
                style={[styles.card, { width: cardWidth }, have && { borderColor: accentColorForKind(kind) }, !have && styles.cardLocked]}
              >
                <View style={!have && styles.dim}>
                  <GameEmblem kind={kind} size={48} />
                </View>
                <Text style={[styles.name, !have && styles.nameLocked]} numberOfLines={1}>
                  {gameDisplayName(kind)}
                </Text>
                {have ? (
                  <>
                    <Text style={styles.stat}>{row.solved > 0 ? `${row.solved} solved · ${row.stars} ★` : 'New, not played yet'}</Text>
                    <Text style={styles.goal} numberOfLines={3}>
                      {LESSON_GUIDES[kind].goal}
                    </Text>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Play the ${gameDisplayName(kind)} lesson again`}
                      onPress={() => onReplayLesson(kind)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.replay, pressed && styles.pressed]}
                    >
                      <Text style={[styles.replayText, { color: accentColorForKind(kind) }]}>Replay lesson</Text>
                    </PressableScale>
                  </>
                ) : (
                  <Text style={[styles.stat, next && styles.next]}>{next && arriving ? `After ${arriving.inPuzzles} more ${gameDisplayName(arriving.gate)} ${arriving.inPuzzles === 1 ? 'puzzle' : 'puzzles'}` : 'Still to come'}</Text>
                )}
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 92 },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  hero: { padding: theme.spacing.md, borderRadius: 24, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  count: { fontFamily: theme.typography.families.display, fontSize: 44, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  countOf: { fontSize: theme.typography.sizes.title, color: theme.colors.textTertiary },
  countLabel: { marginTop: 2, fontSize: theme.typography.sizes.caption + 1, lineHeight: 19, color: theme.colors.textSecondary },
  track: { flexDirection: 'row', gap: 4, marginTop: theme.spacing.md },
  trackCell: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  card: { padding: 14, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, gap: 6 },
  cardLocked: { backgroundColor: theme.colors.background },
  dim: { opacity: 0.28 },
  name: { marginTop: 4, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.body + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  nameLocked: { color: theme.colors.textTertiary },
  stat: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  next: { color: theme.colors.accentText, fontWeight: theme.typography.weights.semibold },
  goal: { fontSize: theme.typography.sizes.caption, lineHeight: 17, color: theme.colors.textTertiary },
  replay: { marginTop: 4, alignSelf: 'flex-start' },
  replayText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold },
  pressed: { opacity: 0.7 },
}));

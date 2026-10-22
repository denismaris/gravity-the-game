import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoundKey } from './RoundKey';
import { Animated, View } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, gameDisplayName, GameKind, NextPuzzleOptions } from '../game/journey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { CoinBalance, useCoinPurchase } from './Coins';
import { GameLesson } from './lessons';
import { LevelSetComplete } from './LevelSetComplete';
import { PuzzleProgressMark } from './PuzzleProgressMark';
import { theme, themedStyles } from '../theme';
import { DifficultyChip } from './DifficultyChip';
import { HelpHalo } from './HelpHalo';
import { BackLabel, Icon } from './Icon';
import { InsightButton, useInsightPower } from './InsightPower';
import { PageBloom } from './PageBloom';
import { PressableScale } from './PressableScale';
import { PuzzleSolved } from './PuzzleSolved';
import { StageTopGap } from './StageTopGap';
import { MechanicsCarousel } from './MechanicsCarousel';
import { MechanicIntro, MechanicIntroCopy } from './MechanicIntro';
import { TutorialOverlay } from './TutorialOverlay';
import { TutorialSlide } from '../game/tutorials';
import { useSettings } from '../settings';
import { useSolveCelebration } from './useSolveCelebration';
import { useStageEntrance } from './useStageEntrance';

const ICON_SIZE = 14;

/** The same simple-stroke "?" every game's header carries. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

/** A board played from the Home test button: a fixed run of boards, with
 * the game's lesson before the first one the first time. */
export interface TrialMode {
  readonly type: 'trial';
  readonly index: number;
  readonly total: number;
  readonly onNext: () => void;
}

/** A board dealt in a set (or the Daily, or the Grand): its solve is
 * recorded and paid, and Next leads on through the set. */
export interface SetMode {
  readonly type: 'set';
  readonly puzzleId: string;
  readonly onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * The frame Lily Pads and Weathervanes are played in, laid out exactly as
 * the other game screens are: header with name, tier, kicker, progress
 * track and the set's dots; the board on its stage; Insight and the round
 * keys; the help carousel on "?"; the finish card, then on to the next.
 *
 * In a set it records the solve and pays for it, and Next leads on through
 * the set (or to the set's own finish). On trial it walks a fixed run of
 * boards, with the game's lesson before the first one the first time.
 */
export function PlayShell({
  kind,
  mode,
  name,
  difficulty,
  kicker,
  slides,
  renderIllustration,
  introduce,
  intros = [],
  solved,
  hints,
  canUndo,
  onExit,
  onHint,
  onUndo,
  onRestart,
  children,
}: {
  kind: GameKind;
  mode: TrialMode | SetMode;
  name: string;
  difficulty: PuzzleDifficulty;
  kicker: string;
  /** A rule this board brings for the first time, explained once. */
  introduce?: { id: string; title: string; body: string } | null;
  /** Later rules this board brings, each explained once after `introduce`. */
  intros?: ReadonlyArray<MechanicIntroCopy>;
  /** The "?" carousel: its slides and their pictures. */
  slides: ReadonlyArray<TutorialSlide>;
  renderIllustration: (kind: string) => React.ReactNode;
  solved: boolean;
  hints: number;
  canUndo: boolean;
  onExit: () => void;
  /** Called with Insight already paid for. */
  /** Shows the next move; returns `false` when there is none (then no
   * Insight is spent). */
  onHint: () => boolean | void;
  onUndo: () => void;
  onRestart: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const insight = useInsightPower();
  const { coins, shortBy } = useCoinPurchase();
  const accent = accentColorForKind(kind);
  const game = gameDisplayName(kind);
  const tutorialId = tutorialIdForGame(kind);
  const [showHelp, setShowHelp] = useState(false);
  const { ready, hasSeenTutorial, markTutorialSeen } = useSettings();
  // In a set the app plays the lesson itself before the game opens.
  const [lesson, setLesson] = useState(() => mode.type === 'trial' && mode.index === 0 && ready && !hasSeenTutorial(tutorialId));
  const showSolved = useSolveCelebration(solved);
  // Waits for settings, so a board opened before they load still explains.
  const [introDone, setIntroDone] = useState(false);
  const showIntro = !!introduce && ready && !introDone && !hasSeenTutorial(introduce.id);

  // The solve, recorded once (in a set) and paid for.
  const { progress: player, recordCompletion } = usePlayerProgress();
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const recorded = useRef(false);
  const batchCompleted = useRef(false);
  const finishedSet = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const batchRef = useRef(player.currentBatch);
  batchRef.current = player.currentBatch;
  const nextEntry = useMemo(() => (player.currentBatch ? nextInBatch(player.currentBatch) : null), [player.currentBatch]);
  useEffect(() => {
    if (!solved) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    if (mode.type === 'set') {
      finishedSet.current = batchRef.current ?? null;
      const outcome = recordCompletion(mode.puzzleId, hints);
      batchCompleted.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
    } else {
      setStars(hints === 0 ? 3 : hints === 1 ? 2 : 1);
    }
  }, [solved, hints, mode, recordCompletion]);
  const goNext = () => {
    if (mode.type === 'trial') mode.onNext();
    else if (nextEntry) mode.onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompleted.current });
  };


  if (lesson) {
    return (
      <View style={styles.container}>
        <GameLesson
          kind={kind}
          onDone={() => {
            markTutorialSeen(tutorialId);
            setLesson(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <BackLabel label="Home" style={styles.back} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {name}
          </Text>
          <View style={styles.kickerRow}>
            <DifficultyChip difficulty={difficulty} style={styles.kickerChip} />
            <Text style={[styles.kicker, { color: accent }]} numberOfLines={1}>
              {`${game} · ${kicker}`}
            </Text>
          </View>
          {mode.type === 'set' ? (
            <PuzzleProgressMark batch={player.currentBatch} puzzleId={mode.puzzleId} style={styles.batchDots} />
          ) : (
            <View style={styles.dots}>
              {Array.from({ length: mode.total }, (_v, i) => (
                <View key={i} style={[styles.dot, { borderColor: accent }, i < mode.index && { backgroundColor: accent, opacity: 1 }, i === mode.index && styles.dotNow]} />
              ))}
            </View>
          )}
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="How to play" onPress={() => setShowHelp(true)} hitSlop={8} containerStyle={styles.headerRightSpacer}>
          <HelpHalo />
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>{children}</Animated.View>
        <Animated.View style={[styles.controls, controlsIn]}>
          <InsightButton count={insight.count} onPress={() => !solved && insight.spend(onHint)} />
          {insight.sheet}
          <RoundKey accessibilityLabel="Undo" onPress={onUndo} disabled={!canUndo} dim={!canUndo}>
            <Icon name="undo" size={ICON_SIZE} color={accent} />
          </RoundKey>
          <RoundKey accessibilityLabel="Restart" onPress={onRestart}>
            <Icon name="restart" size={ICON_SIZE} color={accent} />
          </RoundKey>
        </Animated.View>
        {/* Coins only matter once Insight runs out: until then the line
            keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
      </View>

      {showSolved && stars && !showSetComplete && (
        <PuzzleSolved
          kind={kind}
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={mode.type === 'trial' ? mode.index < mode.total - 1 : nextEntry !== null && !isStandalonePuzzle(mode.puzzleId)}
          onNext={mode.type === 'set' && batchCompleted.current && finishedSet.current ? () => setShowSetComplete(true) : goNext}
        />
      )}
      {showSetComplete && finishedSet.current && (
        <LevelSetComplete levelNumber={finishedSet.current.levelNumber} kinds={finishedSet.current.puzzles.map(p => p.kind)} onContinue={goNext} />
      )}
      {showIntro && introduce && !lesson && (
        <TutorialOverlay
          copy={{ title: introduce.title, body: introduce.body }}
          accentColor={accent}
          onDismiss={() => {
            markTutorialSeen(introduce.id);
            setIntroDone(true);
          }}
        />
      )}
      {!showIntro && !lesson && intros.length > 0 && <MechanicIntro intros={intros} accent={accent} />}
      {showHelp && <MechanicsCarousel slides={slides} renderIllustration={renderIllustration} onDone={() => setShowHelp(false)} accentColor={accent} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: theme.spacing.md },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56, alignItems: 'center' },
  name: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.headline, lineHeight: theme.typography.lineHeights.headline, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 2 },
  kickerChip: { marginRight: 6 },
  kicker: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, flexShrink: 1 },
  batchDots: { marginTop: theme.spacing.sm },
  quiet: { opacity: 0 },
  coinBalance: { marginTop: theme.spacing.sm },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: theme.spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, opacity: 0.6 },
  dotNow: { width: 9, height: 9, borderRadius: 5, opacity: 1 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  stage: { borderRadius: 28, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.borderStrong },
  controls: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderTopColor: theme.colors.highlightEdge,
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 3 },
    elevation: 2,
  },
  pillPressed: { backgroundColor: theme.colors.surfaceAlt, shadowOpacity: 0.04, shadowOffset: { width: 1, height: 1 }, elevation: 1 },
  roundKey: { width: 46, height: 46, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
}));

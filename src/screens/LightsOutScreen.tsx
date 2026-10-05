import { HintNote } from '../components/HintNote';
import { HintKind } from '../game/hints';
import { PuzzleProgressMark } from '../components/PuzzleProgressMark';
import { isTodaysDaily } from '../game/journey/daily';
import { StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  initialLightsOutState,
  isLightsOutSolved,
  LightsOutCell,
  LightsOutPuzzle,
  LightsOutState,
  litCount,
  press,
  explainLightsOutHint } from '../game/lightsout';
import {
  DifficultyChip,
  GeometricRule,
  LevelSetComplete,
  LightsOutBoard,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  useSolveCelebration,
  renderLightsOutIllustration,
} from '../components';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { LIGHTSOUT_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';

const TUTORIAL_ID = tutorialIdForGame('lightsout');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 1500;

/** The same simple-stroke "?" every other screen's header carries. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

/** A restart-arrow glyph, same treatment as `HintIcon` above. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.lightsOutAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.lightsOutAccent} />
    </Canvas>
  );
}

export interface LightsOutScreenProps {
  puzzle: LightsOutPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Play screen for a Lights Out puzzle. Tap a light to flip it and its
 * four orthogonal neighbours; the board is solved the moment every light
 * is dark.
 *
 * Structurally the same screen as `FillaPixScreen`/`TowersScreen` -
 * header, a staged board, then a control row -
 * because it is the same job. No Undo here, unlike Fill-a-Pix: a press
 * is its own inverse in this game, so "undo" is just pressing the same
 * cell again, and a button for it would be a second name for a move the
 * player already has.
 */
export function LightsOutScreen({ puzzle, onExit, onNextPuzzle }: LightsOutScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { markTutorialSeen } = useSettings();

  const [showTutorial, setShowTutorial] = useState(false);
  const dismissTutorial = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowTutorial(false);
  }, [markTutorialSeen]);
  const reopenTutorial = useCallback(() => setShowTutorial(true), []);

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  const [state, setState] = useState<LightsOutState>(() => initialLightsOutState(puzzle));
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
  const [presses, setPresses] = useState(0);
  const [flashCell, setFlashCell] = useState<LightsOutCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const solved = useMemo(() => isLightsOutSolved(state), [state]);

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);

  // Deliberately no progress track, unlike this app's other logic games.
  // One was tried and had to go: it measured lights turned off against
  // the board as dealt, and in Lights Out that number goes *backwards*
  // constantly - a press that is exactly right routinely lights more
  // cells than it clears. A bar that slides back every second press is
  // worse than no bar. Gravity, the app's other press-counted game,
  // shows moves against par and no bar, so this does too: par is a
  // target to beat rather than a progress claim that cannot be kept.

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('lightsOutSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const onPressCell = useCallback(
    (row: number, col: number) => {
      setPresses(n => n + 1);
      setState(current => {
        const next = press(current, puzzle.size, row, col);
        // The solved cue fires once from the effect above, whatever press
        // triggers it - so it is not doubled up here. Otherwise the cue
        // reports what the press *did*: going darker is progress and gets
        // the warmer sound, lighting the board back up gets the plain one.
        if (!isLightsOutSolved(next)) {
          triggerFeedback(litCount(next) < litCount(current) ? 'lightsOutDarker' : 'lightsOutTap');
        }
        return next;
      });
    },
    [puzzle.size],
  );

  // Charged only when there is a hint to give, and before applying it, so
  // a refused purchase leaves the board untouched. Worked out from the live
  // \`state\` rather than inside a \`setState\` updater: React may run an
  // updater twice, which would charge twice.
  // The last hint's reason, shown over the board for a few seconds.
  const [note, setNote] = useState<{ reason: string; tip?: string; kind: HintKind; id: number } | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const useHint = useCallback(() => {
    const result = explainLightsOutHint(puzzle, state);
    if (!result) return;
    spendInsight(() => {
      setNote({ reason: result.reason, tip: result.tip, kind: result.kind, id: Date.now() });
      setState(result.state);
      setHints(n => n + 1);
      setPresses(n => n + 1);
      setFlashCell(result.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashCell(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, spendInsight]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setPresses(0);
    setFlashCell(null);
    setState(initialLightsOutState(puzzle));
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardSize = Math.max(
    0,
    Math.min(width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED),
  );


  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {puzzle.name ?? 'Lanterns'}
          </Text>
          <AnimatedKicker presses={presses} par={puzzle.par} solved={solved} difficulty={puzzle.difficulty} />
          <PuzzleProgressMark batch={progress.currentBatch} puzzleId={puzzle.id} style={styles.batchDots} />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="How to play"
          onPress={reopenTutorial}
          hitSlop={8}
          containerStyle={styles.headerRightSpacer}
        >
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          <GeometricRule variant="stage" style={styles.stageRule} />
          <LightsOutBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onPressCell={onPressCell} flashCell={flashCell} />
        </Animated.View>

        <Animated.View style={[styles.controls, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} />
          {insight.sheet}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Restart puzzle"
            onPress={restart}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          >
            <RestartIcon />
            <Text style={styles.pillText}>Restart</Text>
          </PressableScale>
        </Animated.View>
        <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        {note && !solved && <HintNote key={note.id} reason={note.reason} tip={note.tip} kind={note.kind} accent={accentColorForKind('lightsout')} onGone={clearNote} />}
      </View>

      {showSolvedCard && stars && (
        <PuzzleSolved
          kind="lightsout"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null && !isTodaysDaily(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete
          levelNumber={finishedSetRef.current.levelNumber}
          kinds={finishedSetRef.current.puzzles.map(p => p.kind)}
          onContinue={goNext}
        />
      )}

      {showTutorial && <MechanicsCarousel slides={LIGHTSOUT_MECHANICS_SLIDES} renderIllustration={renderLightsOutIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('lightsout')} />}
    </View>
  );
}

/** The kicker: presses against par, the same shape Gravity's own header
 * uses. It pops when a solve lands on or under par - the one moment in
 * this game genuinely worth marking, since the running count itself only
 * ever climbs. */
function AnimatedKicker({ presses, par, solved, difficulty }: { presses: number; par: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (solved && !previousSolved.current && presses <= par) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
  }, [solved, presses, par, scale]);

  useEffect(() => {
    if (solved && !previousSolved.current) {
      solvedScale.setValue(0);
      Animated.spring(solvedScale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previousSolved.current = solved;
  }, [solved, solvedScale]);

  return (
    <View style={styles.kickerRow}>
      <DifficultyChip difficulty={difficulty} style={styles.kickerChip} />
      <Animated.Text numberOfLines={1} style={[styles.kicker, { transform: [{ scale }] }]}>
        {`LANTERNS · ${presses} / PAR ${par}`}
      </Animated.Text>
      {solved && <Animated.View style={[styles.solvedBadge, { transform: [{ scale: solvedScale }] }]} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56, alignItems: 'center' },
  name: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    lineHeight: theme.typography.lineHeights.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 2,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.lightsOutAccent,
    flexShrink: 1,
  },
  kickerChip: { marginRight: 6 },
  solvedBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 5,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stageRule: {
    marginBottom: theme.spacing.sm,
  },
  stage: {
    borderRadius: 28,
    paddingHorizontal: STAGE_H_PADDING,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  coinBalance: { marginTop: theme.spacing.md },
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
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
}));

import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  initialLightsOutState,
  isLightsOutSolved,
  LightsOutCell,
  LightsOutPuzzle,
  LightsOutState,
  litCount,
  press,
  explainLightsOutHint } from '../game/lightsout';
import { LevelSetComplete, LightsOutBoard, MechanicsCarousel, PuzzleSolved, useSolveCelebration, renderLightsOutIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { LIGHTSOUT_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';

const TUTORIAL_ID = tutorialIdForGame('lightsout');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 1500;

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
        const next = press(current, puzzle.size, row, col, puzzle);
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
    [puzzle],
  );

  // Charged only when there is a hint to give, and before applying it, so
  // a refused purchase leaves the board untouched. Worked out from the live
  // \`state\` rather than inside a \`setState\` updater: React may run an
  // updater twice, which would charge twice.
  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const result = explainLightsOutHint(puzzle, state);
    if (!result) return;
    spendInsight(() => {
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
    Math.min(width - theme.spacing.md * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED),
  );


  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="lightsout"
        difficulty={puzzle.difficulty}
        status={`${presses} of par ${puzzle.par}`}
        solved={solved}
        puzzleId={puzzle.id}
        onExit={onExit}
        onHelp={reopenTutorial}
      />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          {/* Finished: the board takes no more touches. Never collapsed: on
              Android a flattened wrapper is re-created when its touches
              change, and the board canvas under it redraws from blank - a
              white flash at every finish. */}
          <View collapsable={false} pointerEvents={solved ? 'none' : 'auto'}>
            <LightsOutBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onPressCell={onPressCell} flashCell={flashCell} />
          </View>
        </Animated.View>

        <DockGap />
        <Animated.View style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} />
          {insight.sheet}
          <RoundKey
            accessibilityLabel="Restart puzzle"
            onPress={restart}>
            <RestartIcon />
          </RoundKey>
        </Animated.View>
        {/* Coins only matter here once Insight runs out: until then the
          line keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        <DockFloor />
      </View>

      {showSolvedCard && stars && !showSetComplete && (
        <PuzzleSolved
          kind="lightsout"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={nextEntry !== null && !isStandalonePuzzle(puzzle.id)}
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

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stage: {
    borderRadius: 28,
    paddingHorizontal: STAGE_H_PADDING,
    paddingVertical: theme.spacing.md,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coinBalance: { marginTop: theme.spacing.md },
  quiet: { opacity: 0 },
}));

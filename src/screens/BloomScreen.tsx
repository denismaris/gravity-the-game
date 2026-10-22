import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  arcsLeft,
  BloomCell,
  BloomPuzzle,
  BloomState,
  initialBloomState,
  isBloomSolved,
  rotateTile,
  traceLoops, explainBloomHint } from '../game/bloom';
import { BloomBoard, LevelSetComplete, MechanicsCarousel, PuzzleSolved, renderBloomIllustration, useSolveCelebration } from '../components';
import { PageBloom } from '../components/PageBloom';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { mechanic } from '../game/mechanics';
import { MechanicIntro } from '../components/MechanicIntro';
import { triggerFeedback } from '../game/rendering';
import { BLOOM_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';

const TUTORIAL_ID = tutorialIdForGame('bloom');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 1500;
const gameAccent = (): string => theme.colors.bloomAccent;

function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={gameAccent()} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={gameAccent()} />
    </Canvas>
  );
}

export interface BloomScreenProps {
  puzzle: BloomPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Bloom: turn curved tiles until every line meets another, and every loop
 * you close fills with colour. Same frame as every other play screen -
 * header, staged board, Hint/Restart - so a batch that deals it reads as
 * one more page of the same almanac.
 */
export function BloomScreen({ puzzle, onExit, onNextPuzzle }: BloomScreenProps): React.JSX.Element {
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
  const [state, setState] = useState<BloomState>(() => initialBloomState(puzzle));
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  // The live board, for reading outside a state updater - see `onTurn`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const [hints, setHints] = useState(0);
  const [flashCell, setFlashCell] = useState<BloomCell | null>(null);
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

  const solved = useMemo(() => isBloomSolved(puzzle, state), [puzzle, state]);
  const left = useMemo(() => arcsLeft(puzzle, state), [puzzle, state]);
  const showSolvedCard = useSolveCelebration(solved);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('bloomSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  // The move is computed from the live board and the setter called
  // plainly - never from inside a state updater, which React may run
  // twice (the bug that once made one Adjacent tap clear two runs).
  const onTurn = useCallback(
    (row: number, col: number) => {
      const current = stateRef.current;
      const next = rotateTile(puzzle, current, row, col);
      if (next === current) return;
      stateRef.current = next;
      setState(next);
      if (isBloomSolved(puzzle, next)) return;
      const closedNow = traceLoops(puzzle, next).loops.length > traceLoops(puzzle, current).loops.length;
      triggerFeedback(closedNow ? 'bloomClose' : 'bloomTurn');
    },
    [puzzle],
  );

  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const result = explainBloomHint(puzzle, stateRef.current);
    if (!result) return;
    // Charged only when there is a hint to give, and before applying it.
    spendInsight(() => {
      stateRef.current = result.state;
      setState(result.state);
      setHints(n => n + 1);
      setFlashCell(result.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashCell(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, spendInsight]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlashCell(null);
    const fresh = initialBloomState(puzzle);
    stateRef.current = fresh;
    setState(fresh);
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
        kind="bloom"
        difficulty={puzzle.difficulty}
        status={solved ? 'In full bloom' : `${left} left`}
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
            <BloomBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onTurn={onTurn} flashCell={flashCell} />
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
          kind="bloom"
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

      <MechanicIntro intros={puzzle.twins?.length ? [mechanic('mechanic:bloom-twins')] : []} accent={accentColorForKind('bloom')} />
      {showTutorial && <MechanicsCarousel slides={BLOOM_MECHANICS_SLIDES} renderIllustration={renderBloomIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('bloom')} />}
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

import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  initialMosaicState,
  isMosaicSolved,
  liftPiece,
  piecesLeft,
  MosaicCell,
  MosaicPuzzle,
  MosaicState,
  placedCells,
  placePiece,
  rotatePiece, explainMosaicHint } from '../game/mosaic';
import { MosaicPlay, LevelSetComplete, MechanicsCarousel, PuzzleSolved, renderMosaicIllustration, useSolveCelebration } from '../components';
import { PageBloom } from '../components/PageBloom';
import { mosaicTrayLayout } from '../components/MosaicPlay';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { MOSAIC_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';
import { Icon } from '../components/Icon';
import { useHistoryState } from '../components/useHistoryState';
import { isTodaysDaily } from '../game/journey';
import { savedBoard, useSaveBoard } from '../progression/boardSaves';
import { useHintNote } from '../components/HintNote';

const TUTORIAL_ID = tutorialIdForGame('mosaic');
const ICON_SIZE = 14;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 1500;
const gameAccent = (): string => theme.colors.mosaicAccent;
/** Header above the board, and the Hint/Restart row and coin line below
 * the tray - what the board's height budget leaves room for. */
const CHROME_RESERVED = 250;

function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={gameAccent()} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={gameAccent()} />
    </Canvas>
  );
}

export interface MosaicScreenProps {
  puzzle: MosaicPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Mosaic: drag coloured pieces from the tray into a silhouette until every
 * square is covered, and the picture becomes a finished mosaic. Same frame
 * as every other play screen - header, staged board, Hint/Restart - with
 * the tray living inside the stage, under the picture it fills.
 */
export function MosaicScreen({ puzzle, onExit, onNextPuzzle }: MosaicScreenProps): React.JSX.Element {
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
  // Every move can be stepped back (see `useHistoryState`).
  // A board left half played opens as it was left (not the timed Daily,
  // whose clock would start again): see `boardSaves`.
  const resumable = !isTodaysDaily(puzzle.id);
  const [resumed] = useState(() => (resumable ? savedBoard(puzzle.id, initialMosaicState(puzzle)) : null));
  const [state, setState, history] = useHistoryState<MosaicState>(() => resumed?.state ?? initialMosaicState(puzzle));
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  // The live board, for reading outside a state updater - see `commit`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const [hints, setHints] = useState(() => resumed?.extras.hints ?? 0);
  const [flashCells, setFlashCells] = useState<ReadonlyArray<MosaicCell> | null>(null);
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

  const solved = useMemo(() => isMosaicSolved(puzzle, state), [puzzle, state]);
  useSaveBoard(puzzle.id, state, solved, { hints }, resumable);
  // Why the hint made its move, said once above the keys.
  const { note: hintNote, show: showHint } = useHintNote();
  const left = useMemo(() => piecesLeft(puzzle, state), [puzzle, state]);
  const showSolvedCard = useSolveCelebration(solved);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('mosaicSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  // Every move is computed from the live board and the setter called
  // plainly - never from inside a state updater, which React may run twice.
  const commit = useCallback((next: MosaicState) => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, [setState]);
  const onPlace = useCallback((index: number, row: number, col: number) => commit(placePiece(puzzle, stateRef.current, index, row, col)), [commit, puzzle]);
  const onLift = useCallback((index: number) => commit(liftPiece(puzzle, stateRef.current, index)), [commit, puzzle]);
  const onRotate = useCallback((index: number) => commit(rotatePiece(puzzle, stateRef.current, index)), [commit, puzzle]);
  const onFeedback = useCallback((kind: 'pickup' | 'place' | 'return' | 'turn') => {
    if (kind === 'turn') triggerFeedback('tap');
    else if (kind === 'pickup') triggerFeedback('mosaicPickup');
    else if (kind === 'return') triggerFeedback('mosaicReturn');
    else if (!isMosaicSolved(puzzle, stateRef.current)) triggerFeedback('mosaicPlace');
  }, [puzzle]);

  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const result = explainMosaicHint(puzzle, stateRef.current);
    if (!result) return;
    // Charged only when there is a hint to give, and before applying it.
    spendInsight(() => {
      showHint(result as { reason?: string; tip?: string });
      commit(result.state);
      setHints(n => n + 1);
      const piece = result.state.pieces[result.index];
      setFlashCells(placedCells(puzzle, result.index, { ...piece, row: piece.at!.row, col: piece.at!.col }));
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashCells(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, spendInsight, commit, showHint]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlashCells(null);
    commit(initialMosaicState(puzzle));
    history.clear();
  }, [puzzle, commit, history]);

  const undo = useCallback(() => {
    if (history.undo() === null) return;
    triggerFeedback('tap');
  }, [history]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const playWidth = Math.max(0, width - theme.spacing.md * 2 - STAGE_H_PADDING * 2);
  const trayHeight = mosaicTrayLayout(puzzle.fixed.filter(set => !set).length, playWidth).height;
  const maxBoardHeight = Math.max(160, height - insets.top - insets.bottom - CHROME_RESERVED - trayHeight);


  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="mosaic"
        difficulty={puzzle.difficulty}
        status={solved ? 'Complete' : `${left} ${left === 1 ? 'piece' : 'pieces'} left`}
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
            <MosaicPlay
              puzzle={puzzle}
              state={state}
              width={playWidth}
              maxBoardHeight={maxBoardHeight}
              solved={solved}
              flashCells={flashCells}
              onPlace={onPlace}
              onLift={onLift}
              onRotate={onRotate}
              onFeedback={onFeedback}
            />
          </View>
        </Animated.View>

        <DockGap />
        {/* Finished: the keys take no more touches. The card is a beat
          away, and a fast Restart in that beat threw a solved board away. */}
        <Animated.View pointerEvents={solved ? "none" : "auto"} style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} progress={state} />
          {insight.sheet}
          <RoundKey accessibilityLabel="Undo" onPress={undo} disabled={!history.canUndo || solved} dim={!history.canUndo || solved}>
            <Icon name="undo" size={ICON_SIZE} color={gameAccent()} />
          </RoundKey>
          <RoundKey
            accessibilityLabel="Restart puzzle" confirm="Tap again to restart"
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

      {hintNote}

      {showSolvedCard && stars && !showSetComplete && (
        <PuzzleSolved
          kind="mosaic"
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

      {showTutorial && <MechanicsCarousel slides={MOSAIC_MECHANICS_SLIDES} renderIllustration={renderMosaicIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('mosaic')} />}
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

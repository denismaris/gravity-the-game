import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import { applyFold, explainFolioHint, FolioFold, FolioPuzzle, FolioState, initialFolioState, isCrease, isFolioSolved, isPastTarget, sheetOf } from '../game/folio';
import { LevelSetComplete, MechanicsCarousel, PuzzleSolved, useSolveCelebration, renderFolioIllustration } from '../components';
import { FolioBoard, FolioTargetCard } from '../components/FolioBoard';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { FOLIO_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';
import { Icon } from '../components/Icon';
import { useHistoryState } from '../components/useHistoryState';
import { isTodaysDaily } from '../game/journey';
import { savedBoard, useSaveBoard } from '../progression/boardSaves';
import { useHintNote } from '../components/HintNote';

const TUTORIAL_ID = tutorialIdForGame('folio');
const ICON_SIZE = 14;
/** Header, target, keys and coins: what the board must leave room for. */
const RESERVED = 360;
const HINT_FLASH_MS = 1500;

function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.folioAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.folioAccent} />
    </Canvas>
  );
}

/** The folds of a saved board, if they still fold this sheet. */
function resumeFolds(puzzle: FolioPuzzle, saved: FolioState | undefined): FolioState | null {
  if (!saved || !Array.isArray(saved.folds)) return null;
  let state = initialFolioState();
  for (const fold of saved.folds) {
    if (!fold || (fold.axis !== 'v' && fold.axis !== 'h') || !isCrease(sheetOf(puzzle, state), fold)) return null;
    state = applyFold(puzzle, state, { axis: fold.axis, at: fold.at });
  }
  return state;
}

export interface FolioScreenProps {
  puzzle: FolioPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Play screen for Folio: tap a crease and the smaller side folds over; the
 * board is solved when the sheet is the target's shape and shows its
 * squares. Undo opens the last fold back out.
 */
export function FolioScreen({ puzzle, onExit, onNextPuzzle }: FolioScreenProps): React.JSX.Element {
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
  const resumable = !isTodaysDaily(puzzle.id);
  // The fold list's length changes from board to board, so the save is
  // checked by replaying it rather than by its shape.
  const [resumed] = useState(() => {
    if (!resumable) return null;
    const save = savedBoard<{ folds?: ReadonlyArray<FolioFold> }>(puzzle.id, { folds: undefined });
    const state = resumeFolds(puzzle, save?.state as FolioState | undefined);
    return state && save ? { state, extras: save.extras } : null;
  });
  const [state, setState, history] = useHistoryState<FolioState>(() => resumed?.state ?? initialFolioState());
  const { coins, shortBy } = useCoinPurchase();
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(() => resumed?.extras.hints ?? 0);
  const [flash, setFlash] = useState<FolioFold | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
  }, []);

  const sheet = useMemo(() => sheetOf(puzzle, state), [puzzle, state]);
  const solved = useMemo(() => isFolioSolved(puzzle, state), [puzzle, state]);
  useSaveBoard(puzzle.id, state, solved, { hints }, resumable);
  const { note: hintNote, show: showHint } = useHintNote();
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

  const onFold = useCallback(
    (fold: FolioFold) => {
      setState(current => applyFold(puzzle, current, fold));
      triggerFeedback('bloomTurn');
    },
    [puzzle, setState],
  );

  const useHint = useCallback(() => {
    const result = explainFolioHint(puzzle, state);
    if (!result) return;
    spendInsight(() => {
      showHint(result);
      setState(result.state);
      setHints(n => n + 1);
      setFlash(result.fold);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, spendInsight, setState, showHint]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlash(null);
    setState(initialFolioState());
    history.clear();
  }, [history, setState]);

  const undo = useCallback(() => {
    if (history.undo() === null) return;
    triggerFeedback('tap');
  }, [history]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardWidth = Math.max(0, width - theme.spacing.md * 2);
  const boardHeight = Math.max(0, height - insets.top - insets.bottom - RESERVED);

  const made = state.folds.length;
  const status = solved
    ? `Folded in ${made}`
    : isPastTarget(puzzle, sheet)
      ? 'Too small now, undo a fold'
      : sheet.width === puzzle.target.width && sheet.height === puzzle.target.height
        ? 'Right shape, other colours'
        : `${made} of ${puzzle.par} folds`;

  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader kind="folio" difficulty={puzzle.difficulty} status={status} solved={solved} puzzleId={puzzle.id} onExit={onExit} onHelp={reopenTutorial} />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          <FolioTargetCard puzzle={puzzle} />
          {/* Never collapsed: see LightsOutScreen (a flattened wrapper
              flashes the canvas under it white on Android). */}
          <View collapsable={false} pointerEvents={solved ? 'none' : 'auto'}>
            <FolioBoard puzzle={puzzle} folds={state.folds} width={boardWidth} height={boardHeight} solved={solved} onFold={onFold} highlight={flash} />
          </View>
        </Animated.View>

        <DockGap />
        <Animated.View pointerEvents={solved ? 'none' : 'auto'} style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} progress={state} />
          {insight.sheet}
          <RoundKey accessibilityLabel="Unfold" onPress={undo} disabled={!history.canUndo || solved} dim={!history.canUndo || solved}>
            <Icon name="undo" size={ICON_SIZE} color={theme.colors.folioAccent} />
          </RoundKey>
          <RoundKey accessibilityLabel="Restart puzzle" confirm="Tap again to restart" onPress={restart}>
            <RestartIcon />
          </RoundKey>
        </Animated.View>
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        <DockFloor />
      </View>

      {hintNote}

      {showSolvedCard && stars && !showSetComplete && (
        <PuzzleSolved
          kind="folio"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={nextEntry !== null && !isStandalonePuzzle(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete levelNumber={finishedSetRef.current.levelNumber} kinds={finishedSetRef.current.puzzles.map(p => p.kind)} onContinue={goNext} />
      )}

      {showTutorial && <MechanicsCarousel slides={FOLIO_MECHANICS_SLIDES} renderIllustration={renderFolioIllustration} onDone={dismissTutorial} kind="folio" accentColor={accentColorForKind('folio')} />}
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
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coinBalance: { marginTop: theme.spacing.md },
  quiet: { opacity: 0 },
}));

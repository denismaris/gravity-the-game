import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  ArukoneCell,
  ArukonePuzzle,
  ArukoneState,
  emptyArukoneState,
  isArukoneSolved,
  remainingCells,
  remainingPairs,
  explainArukoneHint } from '../game/arukone';
import { ArukoneBoard, LevelSetComplete, MechanicsCarousel, PuzzleSolved, useSolveCelebration, renderArukoneIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { REFUSE_MS, triggerFeedback } from '../game/rendering';
import { ARUKONE_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
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

const TUTORIAL_ID = tutorialIdForGame('arukone');
const ICON_SIZE = 14;
/** How long a refused move stays marked on the board. */
/** How long a refused square stays marked: its whole shake. */
const REJECT_MS = REFUSE_MS;

/** A restart-arrow glyph, same treatment as `HintIcon` above. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.arukoneAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.arukoneAccent} />
    </Canvas>
  );
}

export interface ArukoneScreenProps {
  puzzle: ArukonePuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;

/**
 * Play screen for an Arukone+ puzzle. Drag from a number to its twin to
 * join them, around the blocked squares; the far half of the board draws
 * itself as you go.
 *
 * Structurally the same screen as `TentsScreen`/`BinairoScreen` - header
 * with a progress track, a staged board, Hint and Restart - because it is
 * the same job, and a player moving between games inside one level batch
 * should not have to relearn where anything is.
 */
export function ArukoneScreen({ puzzle, onExit, onNextPuzzle }: ArukoneScreenProps): React.JSX.Element {
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
  const [resumed] = useState(() => (resumable ? savedBoard(puzzle.id, emptyArukoneState()) : null));
  const [state, setState, history] = useHistoryState<ArukoneState>(() => resumed?.state ?? emptyArukoneState());
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(() => resumed?.extras.hints ?? 0);
  const [introKey, setIntroKey] = useState(0);
  const [rejected, setRejected] = useState<ArukoneCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  // Captured before `recordCompletion` runs - finishing a set immediately
  // generates the next one, and the finished one is otherwise gone by the
  // time the card renders. Same reason as every other screen here.
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  const rejectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (rejectTimeoutRef.current) clearTimeout(rejectTimeoutRef.current);
    };
  }, []);

  const solved = useMemo(() => isArukoneSolved(puzzle, state), [puzzle, state]);
  useSaveBoard(puzzle.id, state, solved, { hints }, resumable);
  // Why the hint made its move, said once above the keys.
  const { note: hintNote, show: showHint } = useHintNote();

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const left = remainingPairs(puzzle, state);
  const cellsLeft = remainingCells(puzzle, state);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('arukoneSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  /**
   * A legal move. The sound is chosen by what the move *did*: joining a
   * pair is a milestone and gets the heavier cue, every other step gets
   * the lightest tick in the app, since a single drag fires a lot of them.
   */
  const applyMove = useCallback(
    (next: ArukoneState) => {
      // A finished board is finished: nothing redraws it.
      if (next === state || isArukoneSolved(puzzle, state)) return;
      const joinedSomething = remainingPairs(puzzle, next) < remainingPairs(puzzle, state);
      // The solved cue fires once from the effect above, whatever move
      // triggers it - so it is not doubled up here.
      if (!isArukoneSolved(puzzle, next)) {
        triggerFeedback(joinedSomething ? 'arukoneJoin' : 'arukoneStep');
      }
      setState(next);
    },
    [puzzle, state, setState],
  );

  const rejectMove = useCallback((cell: ArukoneCell) => {
    setRejected(cell);
    triggerFeedback('refuse');
    if (rejectTimeoutRef.current) clearTimeout(rejectTimeoutRef.current);
    rejectTimeoutRef.current = setTimeout(() => setRejected(null), REJECT_MS);
  }, []);

  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    if (isArukoneSolved(puzzle, state)) return;
    const next = explainArukoneHint(puzzle, state);
    if (!next) return;
    // Charged only when there is a hint to give, and before applying it.
    spendInsight(() => {
      showHint(next as { reason?: string; tip?: string });
      setHints(n => n + 1);
      setState(next.state);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, spendInsight, setState, showHint]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setRejected(null);
    setState(emptyArukoneState());
    setIntroKey(key => key + 1);
    history.clear();
  }, [history, setState]);

  const undo = useCallback(() => {
    if (history.undo() === null) return;
    triggerFeedback('tap');
  }, [history]);

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
        kind="arukone"
        difficulty={puzzle.difficulty}
        status={solved ? 'Solved' : left > 0 ? `${left} to join` : `${cellsLeft} to fill`}
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
            <ArukoneBoard
              puzzle={puzzle}
              state={state}
              size={boardSize}
              solved={solved}
              onChange={applyMove}
              onReject={rejectMove}
              introKey={introKey}
              rejectedCell={rejected}
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
            <Icon name="undo" size={ICON_SIZE} color={theme.colors.arukoneAccent} />
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
          kind="arukone"
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

      {showTutorial && <MechanicsCarousel slides={ARUKONE_MECHANICS_SLIDES} renderIllustration={renderArukoneIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('arukone')} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  // Centred between the header and the controls, not pinned under the
  // header. Every board here is square and limited by the screen's width,
  // so on a tall phone there is always vertical slack - top-aligning it
  // pooled all of that into one dead block beneath the board, which read
  // as a layout that had run out rather than a composed page. Split either
  // side, the same slack reads as margin.
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
  // Sits with the board inside the centred group rather than pinned to the
  // bottom of the screen - the arrangement Gravity's own board already
  // used, and the reason its screen read as composed while the other five
  // read as a board at the top and two buttons stranded at the bottom.
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coinBalance: { marginTop: theme.spacing.md },
  quiet: { opacity: 0 },
}));

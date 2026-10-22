import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  emptyMirrorMazeState,
  isMirrorMazeSolved,
  MirrorMazeCell,
  MirrorMazePuzzle,
  nextMirror,
  remainingGems,
  setMirror,
  traceAll, traceBeam, explainMirrorHint } from '../game/mirror';
import { LevelSetComplete, MechanicsCarousel, MirrorMazeBoard, PuzzleSolved, renderMirrorMazeIllustration, useSolveCelebration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { mechanic } from '../game/mechanics';
import { MechanicIntro } from '../components/MechanicIntro';
import { triggerFeedback, useAnimatedBeamReveal } from '../game/rendering';
import { MIRROR_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';

const TUTORIAL_ID = tutorialIdForGame('mirror');

export interface MirrorMazeScreenProps {
  puzzle: MirrorMazePuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the eight games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

const RESERVED = 300;
/** The stage card's own horizontal inset around the board - see
 * `BinairoScreen.tsx`'s identical constant for why this is tight while
 * the stage's vertical padding (below) is generous: width is what caps
 * the board's size on a phone, so every point here is a point of board. */
const STAGE_H_PADDING = theme.spacing.sm;

function gemKey(cell: MirrorMazeCell): string {
  return `${cell.row}:${cell.col}`;
}

const ICON_SIZE = 14;

/** A circular restart arrow - see `BinairoScreen.tsx`'s identical
 * `RestartIcon` for the full rationale. Same identity-colour tint as
 * `HintIcon` above. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.mirrorAccent} />
    </Canvas>
  );
}

/**
 * Play screen for a Mirror Maze puzzle. Tap a cell to cycle no mirror ->
 * `/` -> `\` -> no mirror; the beam is retraced live from the source on
 * every change, and the puzzle solves the instant it reaches the target
 * having touched every gem.
 */
export function MirrorMazeScreen({ puzzle, onExit, onNextPuzzle }: MirrorMazeScreenProps): React.JSX.Element {
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
  const [state, setState] = useState(() => emptyMirrorMazeState(puzzle));
  // The live board, for a tap to read without waiting on a render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<MirrorMazeCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  // The batch this solve might complete. Captured *before* `recordCompletion`
  // runs, because completing a set immediately generates the next one and
  // `progress.currentBatch` is the new set by the time the card renders -
  // the finished one is otherwise gone.
  const finishedSetRef = useRef<BatchState | null>(null);
  // Finishing the last puzzle of a set shows the per-puzzle card first,
  // then this - two separate moments rather than one card trying to be
  // both. See `LevelSetComplete`'s own comment.
  const [showSetComplete, setShowSetComplete] = useState(false);
  // Mirrored into a ref rather than read straight off `progress` inside
  // the solve effect: completing a set replaces `currentBatch`, so making
  // the effect depend on it would mean depending on something the effect
  // itself causes to change. Refreshed every render, so when the effect
  // runs it still holds the batch from the render that triggered it.
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const path = useMemo(() => traceBeam(puzzle, state), [puzzle, state]);
  const solved = useMemo(() => isMirrorMazeSolved(puzzle, state), [puzzle, state]);

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const { revealProgress } = useAnimatedBeamReveal(path, solved);
  const left = remainingGems(puzzle, state);
  const totalGems = puzzle.gems.length;


  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('mirrorSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const cycleCell = useCallback(
    (row: number, col: number) => {
      // Worked out from the live board, not inside a state updater: the
      // click and haptic then land on the tap itself, not a render later.
      const s = stateRef.current;
      if (isMirrorMazeSolved(puzzle, s)) return;
      const next = setMirror(s, puzzle, row, col, nextMirror(s.mirrors[row][col]));
      if (next === s) return;
      stateRef.current = next;
      setState(next);

      // The gem chime the instant this placement makes the beam newly
      // reach a gem it wasn't touching before; otherwise the glassy click
      // of a mirror turning.
      const before = traceAll(puzzle, s).lit;
      const after = traceAll(puzzle, next).lit;
      const gainedGem = puzzle.gems.some(g => !before.has(gemKey(g)) && after.has(gemKey(g)));
      triggerFeedback(gainedGem ? 'mirrorGem' : 'mirrorPlace');
    },
    [puzzle],
  );

  // Charged only when there is a hint to give, and before applying it, so
  // a refused purchase leaves the board untouched. Worked out from the live
  // \`state\` rather than inside a \`setState\` updater: React may run an
  // updater twice, which would charge twice.
  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const h = explainMirrorHint(puzzle, state);
    if (!h) return;
    spendInsight(() => {
      setState(h.state);
      setHints(n => n + 1);
      setFlash(h.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 1500);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, spendInsight]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setState(emptyMirrorMazeState(puzzle));
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
        kind="mirror"
        difficulty={puzzle.difficulty}
        status={solved ? 'Solved' : totalGems > 0 ? `${left} ${left === 1 ? 'gem' : 'gems'} left` : 'Guide the light home'}
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
            <MirrorMazeBoard
              puzzle={puzzle}
              state={state}
              size={boardSize}
              path={path}
              revealProgress={revealProgress}
              solved={solved}
              onCycleCell={cycleCell}
              flashCell={flash}
            />
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
          kind="mirror"
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

      <MechanicIntro intros={[...(puzzle.filters?.length ? [mechanic('mechanic:mirror-ruby')] : []), ...(puzzle.splitters?.length ? [mechanic('mechanic:mirror-splitter')] : [])]} accent={accentColorForKind('mirror')} />
      {showTutorial && <MechanicsCarousel slides={MIRROR_MECHANICS_SLIDES} renderIllustration={renderMirrorMazeIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('mirror')} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  // Anchored to the header, not centred in leftover space - see
  // `BinairoScreen.tsx`'s own `styles.boardArea` for the full rationale
  // (a small board used to float adrift in a mostly-empty screen; any
  // spare room now collects below the controls instead).
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

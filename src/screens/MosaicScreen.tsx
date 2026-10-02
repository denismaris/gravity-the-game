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
import {
  MosaicPlay,
  DifficultyChip,
  GeometricRule,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  renderMosaicIllustration,
  useSolveCelebration,
} from '../components';
import { PageBloom } from '../components/PageBloom';
import { mosaicTrayLayout } from '../components/MosaicPlay';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { MOSAIC_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { CoinBalance, CoinCost, useCoinPurchase } from '../components/Coins';
import { HINT_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';

const TUTORIAL_ID = tutorialIdForGame('mosaic');
const ICON_SIZE = 14;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 650;
const gameAccent = (): string => theme.colors.mosaicAccent;
/** Header above the board, and the Hint/Restart row and coin line below
 * the tray - what the board's height budget leaves room for. */
const CHROME_RESERVED = 250;

function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

/** The lightbulb every play screen's Hint pill carries, in Mosaic's lapis. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={gameAccent()} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={gameAccent()} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={gameAccent()} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={gameAccent()} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

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
  const { ready: settingsReady, hasSeenTutorial, markTutorialSeen } = useSettings();

  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (settingsReady && !hasSeenTutorial(TUTORIAL_ID)) setShowTutorial(true);
  }, [settingsReady, hasSeenTutorial]);
  const dismissTutorial = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowTutorial(false);
  }, [markTutorialSeen]);
  const reopenTutorial = useCallback(() => setShowTutorial(true), []);

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  const [state, setState] = useState<MosaicState>(() => initialMosaicState(puzzle));
  const { coins, shortBy, buy } = useCoinPurchase();
  const [coinsEarned, setCoinsEarned] = useState(0);
  // The live board, for reading outside a state updater - see `commit`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const [hints, setHints] = useState(0);
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
  }, []);
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
  const [note, setNote] = useState<{ reason: string; kind: HintKind; id: number } | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const useHint = useCallback(() => {
    const result = explainMosaicHint(puzzle, stateRef.current);
    if (!result) return;
    // Charged only when there is a hint to give, and before applying it.
    buy(HINT_COST, () => {
      setNote({ reason: result.reason, kind: result.kind, id: Date.now() });
      commit(result.state);
      setHints(n => n + 1);
      const piece = result.state.pieces[result.index];
      setFlashCells(placedCells(puzzle, result.index, { ...piece, row: piece.at!.row, col: piece.at!.col }));
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashCells(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, buy, commit]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlashCells(null);
    commit(initialMosaicState(puzzle));
  }, [puzzle, commit]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const playWidth = Math.max(0, width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2);
  const trayHeight = mosaicTrayLayout(puzzle.fixed.filter(set => !set).length, playWidth).height;
  const maxBoardHeight = Math.max(160, height - insets.top - insets.bottom - CHROME_RESERVED - trayHeight);

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {puzzle.name ?? 'Mosaic'}
          </Text>
          <AnimatedKicker left={left} solved={solved} difficulty={puzzle.difficulty} />
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
          {note && <HintNote key={note.id} reason={note.reason} kind={note.kind} accent={accentColorForKind('mosaic')} onGone={clearNote} />}
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
        </Animated.View>

        <Animated.View style={[styles.controls, controlsIn]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Reveal a hint"
            onPress={useHint}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          >
            <HintIcon />
            <Text style={styles.pillText}>Hint</Text>
            <CoinCost cost={HINT_COST} />
          </PressableScale>
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
      </View>

      {showSolvedCard && stars && (
        <PuzzleSolved
          kind="mosaic"
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

      {showTutorial && (
        <MechanicsCarousel
          slides={MOSAIC_MECHANICS_SLIDES}
          renderIllustration={renderMosaicIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('mosaic')}
        />
      )}
    </View>
  );
}

/** The kicker: pieces still in the tray, popping as each one is set. */
function AnimatedKicker({ left, solved, difficulty }: { left: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(left);
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (left < previous.current) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = left;
  }, [left, scale]);

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
        {solved ? 'MOSAIC · COMPLETE' : `MOSAIC · ${left} ${left === 1 ? 'PIECE' : 'PIECES'} LEFT`}
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
    color: gameAccent(),
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

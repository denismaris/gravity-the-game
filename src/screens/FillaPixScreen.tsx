import { HintNote } from '../components/HintNote';
import { HintKind } from '../game/hints';
import { PuzzleProgressMark } from '../components/PuzzleProgressMark';
import { isTodaysDaily } from '../game/journey/daily';
import { StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  clueStatus,
  givenFills,
  initialFillaPixState,
  FillaPixCell,
  FillaPixPuzzle,
  FillaPixState,
  isFillaPixSolved,
  toggleCell, explainFillaPixHint } from '../game/fillapix';
import {
  DifficultyChip,
  FillaPixBoard,
  GeometricRule,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  useSolveCelebration,
  renderFillaPixIllustration,
} from '../components';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { FILLAPIX_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, CoinCost, useCoinPurchase } from '../components/Coins';
import { HINT_COST, UNDO_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';

/** How many of `puzzle`'s revealed clues `state` currently satisfies -
 * shared by the progress track and `applyState`'s own "did this move
 * satisfy a new clue" check, so there is exactly one place this counting
 * logic lives. */
function countSatisfiedClues(puzzle: FillaPixPuzzle, state: FillaPixState): number {
  return puzzle.clues.filter(cell => clueStatus(puzzle, state, cell.row, cell.col) === 'satisfied').length;
}

const TUTORIAL_ID = tutorialIdForGame('fillapix');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const TRACK_MS = 220;
const HINT_FLASH_MS = 450;

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

/** A small lightbulb, the same glyph every other play screen's Hint pill
 * carries, in this game's own accent. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

/** A restart-arrow glyph, same treatment as `HintIcon` above. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.fillapixAccent} />
    </Canvas>
  );
}

/** An undo glyph - `RestartIcon`'s own arc and arrowhead, mirrored
 * horizontally, so "step back one move" reads as the opposite of
 * "start over" rather than an unrelated new shape. */
function UndoIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 9.83 3.63 A 4.4 4.4 0 1 1 3.63 4.17" color={theme.colors.fillapixAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 4.34 3.33 L 1.21 4.1 L 4.12 6.54 Z" color={theme.colors.fillapixAccent} />
    </Canvas>
  );
}

export interface FillaPixScreenProps {
  puzzle: FillaPixPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Play screen for a Fill-a-Pix puzzle. Tap a cell to fill it, tap again to
 * clear it - every clue's number counts how many of its 8 neighbours are
 * filled, and the puzzle is solved the instant every revealed clue agrees
 * with the player's own grid.
 *
 * Structurally the same screen as `ArukoneScreen`/`TowersScreen` - header
 * with a progress track, a staged board, then a control row - because it
 * is the same job. The one addition, Undo, is new to this game and stays
 * purely local screen state (a plain stack of prior `FillaPixState`s) -
 * nothing about it touches the shared progression/scoring architecture.
 */
export function FillaPixScreen({ puzzle, onExit, onNextPuzzle }: FillaPixScreenProps): React.JSX.Element {
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
  const [state, setState] = useState<FillaPixState>(() => initialFillaPixState(puzzle));
  // Squares that open already filled - locked, so a tap on one does nothing.
  const givens = useMemo(() => givenFills(puzzle), [puzzle]);
  const { coins, shortBy, buy } = useCoinPurchase();
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
  const [flashCell, setFlashCell] = useState<FillaPixCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  // Undo stack - a plain array of prior states, mutated through a ref
  // rather than `useState` since nothing on screen needs to re-render off
  // its length (Undo, like every other assist button in this app, is
  // never disabled - it simply no-ops once the stack is empty).
  const historyRef = useRef<FillaPixState[]>([]);

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const solved = useMemo(() => isFillaPixSolved(puzzle, state), [puzzle, state]);

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const satisfiedCount = useMemo(() => countSatisfiedClues(puzzle, state), [puzzle, state]);
  const totalClues = puzzle.clues.length;
  const unsatisfied = totalClues - satisfiedCount;
  const filled = totalClues > 0 ? satisfiedCount / totalClues : 0;
  const trackFill = useRef(new Animated.Value(filled)).current;
  useEffect(() => {
    Animated.timing(trackFill, {
      toValue: filled,
      duration: TRACK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true, // a scaleX from the left edge, so it runs on the UI thread
    }).start();
  }, [filled, trackFill]);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('fillapixSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const applyState = useCallback(
    (next: FillaPixState) => {
      if (next === state) return;
      historyRef.current.push(state);
      // The solved cue fires once from the effect above, whatever move
      // triggers it - so it is not doubled up here. Otherwise: a clue
      // newly satisfied is this game's own milestone; anything else is
      // just a toggle.
      if (!isFillaPixSolved(puzzle, next)) {
        const satisfiedMore = countSatisfiedClues(puzzle, next) > countSatisfiedClues(puzzle, state);
        triggerFeedback(satisfiedMore ? 'fillapixClueSatisfied' : 'fillapixToggle');
      }
      setState(next);
    },
    [puzzle, state],
  );

  const onToggleCell = useCallback(
    (row: number, col: number) => {
      if (givens[row][col]) return;
      applyState(toggleCell(state, row, col));
    },
    [applyState, state, givens],
  );

  // The last hint's reason, shown over the board for a few seconds.
  const [note, setNote] = useState<{ reason: string; kind: HintKind; id: number } | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const useHint = useCallback(() => {
    const result = explainFillaPixHint(puzzle, state);
    if (!result) return;
    // Charged only when there is a hint to give, and before applying it.
    buy(HINT_COST, () => {
      setNote({ reason: result.reason, kind: result.kind, id: Date.now() });
      historyRef.current.push(state);
      setHints(n => n + 1);
      setState(result.state);
      setFlashCell(result.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlashCell(null), HINT_FLASH_MS);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, buy]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    buy(UNDO_COST, () => {
      const previous = historyRef.current.pop();
      if (previous) setState(previous);
    });
  }, [buy]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlashCell(null);
    historyRef.current = [];
    setState(initialFillaPixState(puzzle));
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
            {puzzle.name ?? 'Fill-a-Pix'}
          </Text>
          <AnimatedKicker unsatisfied={unsatisfied} solved={solved} difficulty={puzzle.difficulty} />
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  width: '100%', transformOrigin: 'left', transform: [{ scaleX: trackFill.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }],
                },
              ]}
            />
          </View>
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
          {note && <HintNote key={note.id} reason={note.reason} kind={note.kind} accent={accentColorForKind('fillapix')} onGone={clearNote} />}
          <FillaPixBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onToggleCell={onToggleCell} flashCell={flashCell} givens={givens} />
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
            accessibilityLabel="Undo last move"
            onPress={undo}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          >
            <UndoIcon />
            <Text style={styles.pillText}>Undo</Text>
            <CoinCost cost={UNDO_COST} />
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
          kind="fillapix"
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
          slides={FILLAPIX_MECHANICS_SLIDES}
          renderIllustration={renderFillaPixIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('fillapix')}
        />
      )}
    </View>
  );
}

/** The kicker, popping on each decrement - the same component every other
 * screen here carries. Counts unsatisfied clues while any remain, so
 * "0 LEFT" never has to be read from a board that is not actually
 * solved. */
function AnimatedKicker({ unsatisfied, solved, difficulty }: { unsatisfied: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(unsatisfied);
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (unsatisfied < previous.current) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = unsatisfied;
  }, [unsatisfied, scale]);

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
        {solved ? 'FILL-A-PIX · SOLVED' : `FILL-A-PIX · ${unsatisfied} LEFT`}
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
    color: theme.colors.fillapixAccent,
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
  track: {
    width: 140,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  trackFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.fillapixAccent,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  // Centred between the header and the controls, not pinned under the
  // header - the same reasoning (and the same fix, this same session)
  // every other board screen here already got.
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
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  coinBalance: { marginTop: theme.spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
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

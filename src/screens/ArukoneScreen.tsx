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
  ArukoneCell,
  ArukonePuzzle,
  ArukoneState,
  emptyArukoneState,
  isArukoneSolved,
  remainingCells,
  remainingPairs,
  explainArukoneHint } from '../game/arukone';
import {
  ArukoneBoard,
  DifficultyChip,
  GeometricRule,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  useSolveCelebration,
  renderArukoneIllustration,
} from '../components';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { ARUKONE_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, CoinCost, useCoinPurchase } from '../components/Coins';
import { HINT_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';

const TUTORIAL_ID = tutorialIdForGame('arukone');
const ICON_SIZE = 14;
/** How long a refused move stays marked on the board. */
const REJECT_MS = 260;

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

/** A small lightbulb - the same glyph the other play screens carry on
 * their Hint pill, in this game's own accent. Tents and Arukone+ were the
 * two screens whose pills were still bare text while Binairo, Skyscrapers
 * and Mirror Maze had icons; three out of five is the kind of gap that
 * reads as unfinished rather than as restraint. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.arukoneAccent} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.arukoneAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.arukoneAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.arukoneAccent} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

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
const TRACK_MS = 220;

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
  const [state, setState] = useState<ArukoneState>(() => emptyArukoneState());
  const { coins, shortBy, buy } = useCoinPurchase();
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
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

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const left = remainingPairs(puzzle, state);
  const cellsLeft = remainingCells(puzzle, state);
  const freeCells = puzzle.size * puzzle.size - puzzle.obstacles.length;

  // The track measures squares filled, not pairs joined. Pairs are the
  // coarser of the two - a board can have every pair joined and still be a
  // third empty - so counting squares is the honest reading of how close
  // the board actually is to done.
  const filled = freeCells > 0 ? (freeCells - cellsLeft) / freeCells : 0;
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
      if (next === state) return;
      const joinedSomething = remainingPairs(puzzle, next) < remainingPairs(puzzle, state);
      // The solved cue fires once from the effect above, whatever move
      // triggers it - so it is not doubled up here.
      if (!isArukoneSolved(puzzle, next)) {
        triggerFeedback(joinedSomething ? 'arukoneJoin' : 'arukoneStep');
      }
      setState(next);
    },
    [puzzle, state],
  );

  const rejectMove = useCallback((cell: ArukoneCell) => {
    setRejected(cell);
    triggerFeedback('arukoneReject');
    if (rejectTimeoutRef.current) clearTimeout(rejectTimeoutRef.current);
    rejectTimeoutRef.current = setTimeout(() => setRejected(null), REJECT_MS);
  }, []);

  // The last hint's reason, shown over the board for a few seconds.
  const [note, setNote] = useState<{ reason: string; kind: HintKind; id: number } | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const useHint = useCallback(() => {
    const next = explainArukoneHint(puzzle, state);
    if (!next) return;
    // Charged only when there is a hint to give, and before applying it.
    buy(HINT_COST, () => {
      setNote({ reason: next.reason, kind: next.kind, id: Date.now() });
      setHints(n => n + 1);
      setState(next.state);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, buy]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setRejected(null);
    setState(emptyArukoneState());
    setIntroKey(key => key + 1);
  }, []);

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
            {puzzle.name ?? 'Arukone+'}
          </Text>
          <AnimatedKicker left={left} cellsLeft={cellsLeft} solved={solved} difficulty={puzzle.difficulty} />
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
          {note && <HintNote key={note.id} reason={note.reason} kind={note.kind} accent={accentColorForKind('arukone')} onGone={clearNote} />}
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
          kind="arukone"
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
          slides={ARUKONE_MECHANICS_SLIDES}
          renderIllustration={renderArukoneIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('arukone')}
        />
      )}
    </View>
  );
}

/**
 * The kicker, popping on each decrement - the same component every other
 * screen here carries.
 *
 * It counts pairs while pairs are the thing standing in the way, then
 * switches to squares once they are all joined. Showing "0 TO JOIN" on a
 * board that is not solved would read as a bug rather than as the last
 * third of the puzzle.
 */
function AnimatedKicker({ left, cellsLeft, solved, difficulty }: { left: number; cellsLeft: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const count = left > 0 ? left : cellsLeft;
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(count);
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (count < previous.current) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = count;
  }, [count, scale]);

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
        {solved
          ? 'ARUKONE+ · SOLVED'
          : left > 0
            ? `ARUKONE+ · ${left} TO JOIN`
            : `ARUKONE+ · ${cellsLeft} TO FILL`}
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
    color: theme.colors.arukoneAccent,
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
    backgroundColor: theme.colors.arukoneAccent,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
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
  // Sits with the board inside the centred group rather than pinned to the
  // bottom of the screen - the arrangement Gravity's own board already
  // used, and the reason its screen read as composed while the other five
  // read as a board at the top and two buttons stranded at the bottom.
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

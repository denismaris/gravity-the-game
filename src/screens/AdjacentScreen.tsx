import { PuzzleProgressMark } from '../components/PuzzleProgressMark';
import { isTodaysDaily } from '../game/journey/daily';
import { StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  AdjacentCoord,
  AdjacentPuzzle,
  AdjacentState,
  applyTap,
  explainAdjacentHint,
  groupAt,
  initialAdjacentState,
  isAdjacentSolved,
  isAdjacentStuck,
  tileCount,
} from '../game/adjacent';
import {
  AdjacentAnimation,
  AdjacentBoard,
  AdjacentPopup,
  DifficultyChip,
  GeometricRule,
  LevelFailedCard,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  useSolveCelebration,
  renderAdjacentIllustration,
} from '../components';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { ADJACENT_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, CoinCost, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { HintNote } from '../components/HintNote';
import { HintKind } from '../game/hints';
import { UNDO_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';

const TUTORIAL_ID = tutorialIdForGame('adjacent');
const ICON_SIZE = 14;
const RESERVED = 320;
const STAGE_H_PADDING = theme.spacing.sm;

/** Matches `ScorePopup`'s own animation, so a pop-up is pruned exactly
 * when it has finished playing rather than while still on screen. */
const POPUP_MS = 700;

/**
 * Three, as specified. Undo is this game's equivalent of the hint every
 * other non-Gravity screen offers, and it is scored the same way -
 * `recordCompletion` takes the count through its `moves` slot, so a
 * board finished without one is worth three stars (see
 * `HINT_STAR_THRESHOLDS`). Capping it is what keeps that meaningful:
 * unlimited undo would make every board a three-star board eventually.
 */
const MAX_UNDOS = 3;
/** How long Insight shows its group before tapping it. */
const INSIGHT_TAP_DELAY_MS = 700;

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

/** An undo arrow - a curve back on itself with a head, in this game's
 * own accent, matching every other screen's control glyphs. */
function UndoIcon({ muted }: { muted: boolean }): React.JSX.Element {
  const colour = muted ? theme.colors.textTertiary : theme.colors.adjacentAccent;
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 9.83 3.63 A 4.4 4.4 0 1 1 3.63 4.17" color={colour} style="stroke" strokeWidth={1.6} />
      <Path path="M 4.34 3.33 L 1.21 4.1 L 4.12 6.54 Z" color={colour} />
    </Canvas>
  );
}

/** A restart-arrow glyph, same treatment. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.adjacentAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.adjacentAccent} />
    </Canvas>
  );
}

export interface AdjacentScreenProps {
  puzzle: AdjacentPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the batch (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Play screen for an Adjacent board. Tap a run of two or more matching
 * tiles to clear it; whatever was above falls into the gap. The board is
 * finished the moment the target score is reached, or the tray is empty.
 *
 * Structurally the same screen as `LightsOutScreen`/`FillaPixScreen` -
 * header, a staged board, a control row - because it is the same job.
 * Two differences, both following from this being a scoring game rather
 * than a deduction one:
 *
 *  - **No Hint.** There is nothing to deduce, so there is no hidden fact
 *    a hint could reveal; the best it could do is play a move for you,
 *    which is a different (and worse) thing to offer. Undo takes its
 *    place, and its place in the star maths.
 *  - **A real progress track.** Lights Out deliberately has none because
 *    its lit count runs backwards; a score only ever climbs, so a bar
 *    against the target is an honest claim here.
 */
export function AdjacentScreen({ puzzle, onExit, onNextPuzzle }: AdjacentScreenProps): React.JSX.Element {
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

  const [state, setState] = useState<AdjacentState>(() => initialAdjacentState(puzzle));
  const { coins, shortBy, buy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const [insightsUsed, setInsightsUsed] = useState(0);
  const [note, setNote] = useState<{ reason: string; tip?: string; kind: HintKind; id: number } | null>(null);
  const clearNote = useCallback(() => setNote(null), []);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [history, setHistory] = useState<ReadonlyArray<AdjacentState>>([]);
  const [undosUsed, setUndosUsed] = useState(0);
  const [preview, setPreview] = useState<ReadonlyArray<AdjacentCoord> | null>(null);
  const [animation, setAnimation] = useState<AdjacentAnimation | null>(null);
  const [popups, setPopups] = useState<ReadonlyArray<AdjacentPopup>>([]);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);

  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;
  const popupId = useRef(0);

  // Every timer this screen starts, cleared on unmount - a score pop-up
  // that expires after the screen is gone would set state on a dead
  // component, and a board is left mid-puzzle often (every "Home").
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const track = useCallback((timer: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(timer);
    return timer;
  }, []);
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current = [];
    };
  }, []);

  // The live board, readable from the press handlers without capturing a
  // stale copy of it through a `useCallback` dependency.
  const stateRef = useRef(state);
  stateRef.current = state;

  const solved = useMemo(() => isAdjacentSolved(puzzle, state), [puzzle, state]);

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const stuck = useMemo(() => isAdjacentStuck(puzzle, state), [puzzle, state]);
  // Only the finish states stop input now. The preview no longer locks
  // anything - it is just a highlight that follows the finger.
  const locked = solved || stuck;

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, undosUsed + insightsUsed);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('adjacentSolve');
    }
  }, [solved, undosUsed, insightsUsed, puzzle.id, recordCompletion]);

  /**
   * Finger down: highlight the run immediately.
   *
   * The run preview used to be a 200ms timer that also locked input,
   * which is the single thing that made this game feel laggy - every tap
   * sat dead for a fifth of a second before anything moved, in a game
   * whose rhythm is clearing runs in quick succession. Tying it to the
   * finger instead gives the same "see what you are about to clear"
   * beat with no latency at all, and hands its length to the player:
   * hold to look, lift to clear.
   */
  const onPressInCell = useCallback(
    (row: number, col: number) => {
      if (locked) return;
      const group = groupAt(stateRef.current.grid, row, col);
      // A press on a lone tile is a real no-op, and stays silent: this
      // board has thirty-odd pressable squares and most of them do
      // nothing, so rewarding a dead press with a click would teach
      // exactly the wrong thing.
      if (group.length < 2) return;
      setPreview(group);
      triggerFeedback('tap');
    },
    [locked],
  );

  const onPressCancel = useCallback(() => setPreview(null), []);

  const onPressCell = useCallback(
    (row: number, col: number) => {
      if (solved || stuck) return;

      // The move is computed here and the setters called plainly, rather
      // than inside a `setState` updater. An earlier version did the
      // latter and it applied the tap **twice** from one press - 6 tiles
      // gone and 400 points scored where the run was 3 tiles and 200. A
      // state updater has to be pure and may be invoked more than once;
      // this one pushed history, queued an animation, spawned a pop-up
      // and fired haptics, all of which then happened twice.
      const current = stateRef.current;
      const move = applyTap(current, row, col);
      setPreview(null);
      if (!move) return;

      setState(move.state);
      setHistory(past => [...past, current]);
      setAnimation({
        at: Date.now(),
        removed: move.removed.map(cell => ({ ...cell, colour: current.grid[cell.row][cell.col] as number })),
        falls: move.falls,
      });

      popupId.current += 1;
      const popup: AdjacentPopup = { id: popupId.current, row, col, gained: move.gained, multiplier: move.multiplier };
      setPopups(list => [...list, popup]);
      track(setTimeout(() => setPopups(list => list.filter(p => p.id !== popup.id)), POPUP_MS));

      // A run big enough to earn a bonus band gets the louder cue - the
      // one moment in a move worth marking by ear.
      triggerFeedback(move.multiplier > 1 ? 'adjacentCombo' : 'adjacentPop');
    },
    [solved, stuck, track],
  );

  /** Insight: light up the best group and say why, then make the tap a
   * moment later, so the player sees which run it was and what fell. */
  const revealInsight = useCallback(() => {
    if (solved || stuck) return;
    const hint = explainAdjacentHint(puzzle, stateRef.current);
    if (!hint) return;
    insight.spend(() => {
      setInsightsUsed(n => n + 1);
      setNote({ reason: hint.reason, tip: hint.tip, kind: 'nudge', id: Date.now() });
      setPreview(hint.group);
      triggerFeedback('targetReached');
      track(setTimeout(() => onPressCell(hint.tap.row, hint.tap.col), INSIGHT_TAP_DELAY_MS));
    });
  }, [solved, stuck, puzzle, insight, track, onPressCell]);

  const undo = useCallback(() => {
    if (history.length === 0 || undosUsed >= MAX_UNDOS || solved) return;
    buy(UNDO_COST, () => {
      setState(history[history.length - 1]);
      setHistory(past => past.slice(0, -1));
      setUndosUsed(n => n + 1);
      setAnimation(null);
      setPreview(null);
      triggerFeedback('tap');
    });
  }, [history, undosUsed, solved, buy]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setState(initialAdjacentState(puzzle));
    setHistory([]);
    setUndosUsed(0);
    setInsightsUsed(0);
    setNote(null);
    setPreview(null);
    setAnimation(null);
    setPopups([]);
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardMaxWidth = Math.max(0, width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2);
  const boardMaxHeight = Math.max(0, height - insets.top - insets.bottom - RESERVED);

  const undosLeft = MAX_UNDOS - undosUsed;
  const canUndo = history.length > 0 && undosLeft > 0 && !solved;


  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {puzzle.name ?? 'Adjacent'}
          </Text>
          <AnimatedKicker score={state.score} target={puzzle.targetScore} solved={solved} difficulty={puzzle.difficulty} />
          <ScoreTrack score={state.score} target={puzzle.targetScore} />
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
          <AdjacentBoard
            puzzle={puzzle}
            state={state}
            maxWidth={boardMaxWidth}
            maxHeight={boardMaxHeight}
            solved={solved}
            preview={preview}
            animation={animation}
            popups={popups}
            disabled={locked}
            onPressInCell={onPressInCell}
            onPressCell={onPressCell}
            onPressCancel={onPressCancel}
          />
        </Animated.View>

        <Animated.View style={[styles.controls, controlsIn]}>
          <InsightButton count={insight.count} onPress={revealInsight} />
          {insight.sheet}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Undo the last clear, ${undosLeft} of ${MAX_UNDOS} left`}
            accessibilityState={{ disabled: !canUndo }}
            onPress={undo}
            style={({ pressed }) => [styles.pill, pressed && styles.pillPressed, !canUndo && styles.pillDisabled]}
          >
            <UndoIcon muted={!canUndo} />
            <Text style={[styles.pillText, !canUndo && styles.pillTextDisabled]}>Undo {undosLeft}</Text>
            <CoinCost cost={UNDO_COST} muted={!canUndo} />
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
        {/* Coins only matter here once Insight runs out: until then the
          line keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        {note && !solved && <HintNote key={note.id} reason={note.reason} tip={note.tip} kind={note.kind} accent={accentColorForKind('adjacent')} onGone={clearNote} />}
      </View>

      {showSolvedCard && stars && (
        <PuzzleSolved
          kind="adjacent"
          stars={stars}
          hintsUsed={undosUsed}
          coinsEarned={coinsEarned}
          note={`${state.score} points · ${state.cascades} cascade${state.cascades === 1 ? '' : 's'}${
            tileCount(state.grid) === 0 ? ' · tray cleared' : ''
          }`}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null && !isTodaysDaily(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {stuck && (
        <LevelFailedCard
          title="NO MOVES LEFT"
          message={`The tray is down to single tiles at ${state.score} of ${puzzle.targetScore}. Nothing left connects.`}
          onRetry={restart}
          onExit={onExit}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete
          levelNumber={finishedSetRef.current.levelNumber}
          kinds={finishedSetRef.current.puzzles.map(p => p.kind)}
          onContinue={goNext}
        />
      )}

      {showTutorial && <MechanicsCarousel slides={ADJACENT_MECHANICS_SLIDES} renderIllustration={renderAdjacentIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('adjacent')} />}
    </View>
  );
}

/** The running total against the target - the one number this game is
 * actually about, so it pops on every gain rather than only at the end. */
function AnimatedKicker({ score, target, solved, difficulty }: { score: number; target: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousScore = useRef(score);
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (score > previousScore.current) {
      scale.setValue(0.88);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previousScore.current = score;
  }, [score, scale]);

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
        {`ADJACENT · ${score} / ${target}`}
      </Animated.Text>
      {solved && <Animated.View style={[styles.solvedBadge, { transform: [{ scale: solvedScale }] }]} />}
    </View>
  );
}

/** A bar toward the target. Honest here in a way it would not be in
 * Lights Out: a score only ever climbs, so this never slides backwards. */
function ScoreTrack({ score, target }: { score: number; target: number }): React.JSX.Element {
  const fill = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, target > 0 ? score / target : 0);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: pct,
      duration: 420,
      useNativeDriver: true, // a scaleX from the left edge, so it runs on the UI thread
    }).start();
  }, [pct, fill]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.trackFill,
          { width: '100%', transformOrigin: 'left', transform: [{ scaleX: fill.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }) }] },
        ]}
      />
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
    color: theme.colors.adjacentAccent,
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
    height: 3,
    width: 132,
    borderRadius: 1.5,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 6,
  },
  trackFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.adjacentAccent,
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
  pillDisabled: { opacity: 0.5, shadowOpacity: 0 },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  pillTextDisabled: { color: theme.colors.textTertiary },
  quiet: { opacity: 0 },
}));

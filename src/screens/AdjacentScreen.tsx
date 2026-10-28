import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
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
  GOLD,
  STONE,
} from '../game/adjacent';
import { AdjacentAnimation, AdjacentBoard, AdjacentPopup, LevelFailedCard, LevelSetComplete, MechanicsCarousel, PuzzleSolved, SOLVE_CELEBRATION_MS, useSolveCelebration, renderAdjacentIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { ADJACENT_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { MechanicIntro } from '../components/MechanicIntro';
import { mechanic } from '../game/mechanics';
import { UNDO_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';
import { isTodaysDaily } from '../game/journey';
import { savedBoard, useSaveBoard } from '../progression/boardSaves';
import { useHintNote } from '../components/HintNote';

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

  // A board left half played opens as it was left (not the timed Daily,
  // whose clock would start again): see `boardSaves`.
  const resumable = !isTodaysDaily(puzzle.id);
  const [resumed] = useState(() => (resumable ? savedBoard(puzzle.id, initialAdjacentState(puzzle)) : null));
  const [state, setState] = useState<AdjacentState>(() => resumed?.state ?? initialAdjacentState(puzzle));
  const { coins, shortBy, buy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const [insightsUsed, setInsightsUsed] = useState(() => resumed?.extras.insightsUsed ?? 0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [history, setHistory] = useState<ReadonlyArray<AdjacentState>>([]);
  const [undosUsed, setUndosUsed] = useState(() => resumed?.extras.undosUsed ?? 0);
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
  useSaveBoard(puzzle.id, state, solved, { insightsUsed, undosUsed }, resumable);
  // Why the hint made its move, said once above the keys.
  const { note: hintNote, show: showHint } = useHintNote();

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  // A little longer than the shared beat: the finish waits for the last
  // move's tiles to land before it sweeps (see AdjacentBoardView).
  const showSolvedCard = useSolveCelebration(solved, SOLVE_CELEBRATION_MS + 400);
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
      const golden = move.removed.some(cell => current.grid[cell.row][cell.col] === GOLD);
      const popup: AdjacentPopup = { id: popupId.current, row, col, gained: move.gained, multiplier: move.multiplier, golden, crumbled: move.crumbled };
      setPopups(list => [...list, popup]);
      track(setTimeout(() => setPopups(list => list.filter(p => p.id !== popup.id)), POPUP_MS));

      // A run big enough to earn a bonus band gets the louder cue - the
      // one moment in a move worth marking by ear.
      triggerFeedback(move.multiplier > 1 || golden || move.crumbled ? 'adjacentCombo' : 'adjacentPop');
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
      showHint(hint as { reason?: string; tip?: string });
      setInsightsUsed(n => n + 1);
      setPreview(hint.group);
      triggerFeedback('targetReached');
      track(setTimeout(() => onPressCell(hint.tap.row, hint.tap.col), INSIGHT_TAP_DELAY_MS));
    });
  }, [solved, stuck, puzzle, insight, track, onPressCell, showHint]);

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
    setPreview(null);
    setAnimation(null);
    setPopups([]);
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardMaxWidth = Math.max(0, width - theme.spacing.md * 2 - STAGE_H_PADDING * 2);
  const boardMaxHeight = Math.max(0, height - insets.top - insets.bottom - RESERVED);

  const undosLeft = MAX_UNDOS - undosUsed;
  const canUndo = history.length > 0 && undosLeft > 0 && !solved;


  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="adjacent"
        difficulty={puzzle.difficulty}
        status={`${state.score} of ${puzzle.targetScore}`}
        solved={solved}
        puzzleId={puzzle.id}
        onExit={onExit}
        onHelp={reopenTutorial}
      />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
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

        <DockGap />
        {/* Finished: the keys take no more touches. The card is a beat
          away, and a fast Restart in that beat threw a solved board away. */}
        <Animated.View pointerEvents={solved ? "none" : "auto"} style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={revealInsight} progress={state} />
          {insight.sheet}
          <RoundKey
            accessibilityLabel={`Undo the last clear, ${undosLeft} of ${MAX_UNDOS} left`}
            accessibilityState={{ disabled: !canUndo }}
            onPress={undo}
            dim={!canUndo}>
            <UndoIcon muted={!canUndo} />
            {/* Undos left, as a small count on the key. */}
            <View style={[styles.keyBadge, !canUndo && styles.keyBadgeMuted]}>
              <Text style={[styles.keyBadgeText, !canUndo && styles.keyBadgeTextMuted]}>{undosLeft}</Text>
            </View>
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
          kind="adjacent"
          stars={stars}
          hintsUsed={undosUsed}
          coinsEarned={coinsEarned}
          note={state.score.toLocaleString('en-US')}
          noteLabel="points"
          onDone={onExit}
          hasNext={nextEntry !== null && !isStandalonePuzzle(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {stuck && (
        <LevelFailedCard
          title="No moves left"
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

      <MechanicIntro intros={introsFor(puzzle)} accent={accentColorForKind('adjacent')} />
      {showTutorial && <MechanicsCarousel slides={ADJACENT_MECHANICS_SLIDES} renderIllustration={renderAdjacentIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('adjacent')} />}
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
  keyBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.secondary },
  keyBadgeMuted: { backgroundColor: theme.colors.borderStrong },
  keyBadgeTextMuted: { color: theme.colors.textPrimary },
  keyBadgeText: { fontSize: 11, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
}));

/** The rules this tray brings, for the one-time card. */
function introsFor(puzzle: AdjacentPuzzle) {
  const cells = puzzle.initial.flat();
  return [...(cells.includes(STONE) ? [mechanic('mechanic:adjacent-stone')] : []), ...(cells.includes(GOLD) ? [mechanic('mechanic:adjacent-gold')] : [])];
}

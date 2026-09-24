import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView, triggerFeedback, useAnimatedMovables } from '../game/rendering';
import {
  canUndo,
  createGameSession,
  Direction,
  gameSessionReducer,
  getCurrentState,
  gravityChangesState,
  isPuzzleFailed,
  isPuzzleSolved,
  StaticCellType,
} from '../game/engine';
import { createGameStateFromLevel, getStarThresholds, LevelDefinition } from '../game/levels';
import {
  BatchProgressDots,
  LevelCompleteCard,
  LevelFailedCard,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  renderGravityIllustration,
  SessionControls,
  TutorialOverlay,
  useSwipeGesture,
} from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { copyForTutorial, GRAVITY_MECHANICS_SLIDES, mechanicsOf, pickTutorial, tutorialIdForGame, tutorialIdForMechanic } from '../game/tutorials';
import { BatchState, CompletionOutcome, getLevelResult, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme } from '../theme';

const GAME_TUTORIAL_ID = tutorialIdForGame('gravity');
const ICON_SIZE = 14;

/** A plain "?" glyph - see `BinairoScreen.tsx`'s identical `HelpIcon` for
 * the full rationale. Always reopens the base "how to play Gravity"
 * carousel, never one of the progressive per-mechanic overlays - those
 * stay tied to the level that introduces them, not to a general-purpose
 * reopen button. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

/** Approximate height reserved below the board for the header text above it
 * and the Undo/Restart row beneath it - there is no direction pad any more,
 * gravity is triggered purely by swiping the board (see `useSwipeGesture`),
 * which made the pad a redundant second control for the same input. */
const CONTROLS_AREA_HEIGHT = 190;
/** The board's own plinth's horizontal inset - see `BinairoScreen.tsx`'s
 * identical `STAGE_H_PADDING` for why this is tight (every point here is
 * a point of board) while the plinth's vertical padding (below) is
 * generous. */
const STAGE_H_PADDING = theme.spacing.sm;

export interface GameScreenProps {
  /** The level to play. Changing this remounts the board at a fresh state. */
  level: LevelDefinition;
  /** Called when the player wants to return to the level select screen. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the three games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/** The most recent action dispatched, used to decide whether the visible
 * transition should be an animated slide (`gravity`) or an instant snap
 * (`undo`/`restart`/initial mount - see `useAnimatedMovables`). */
type LastAction = 'init' | 'gravity' | 'undo' | 'restart';

/** Computes the set of movable ids currently resting on a target cell, for
 * the "reached its target" visual/haptic cue. Pure and cheap: bounded by
 * board size, recomputed only when the logical game state changes. */
function computeOnTargetIds(state: ReturnType<typeof getCurrentState>): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const movable of state.movables) {
    if (movable.anchored) continue; // anchored objects never count as "on target"
    if (state.staticGrid[movable.row]?.[movable.col] === StaticCellType.Target) {
      ids.add(movable.id);
    }
  }

  return ids;
}

/**
 * GameScreen
 *
 * Hosts the puzzle board and its controls for a single `level`. This
 * component is UI-only: it measures available screen space, owns the
 * current puzzle `GameSession` in React state, and forwards user input
 * (button presses / swipes) to the pure engine (`gameSessionReducer`,
 * which itself calls `applyGravity`) to compute the next state.
 *
 * Flow: user input -> game engine (gameSessionReducer/applyGravity) -> new
 * GameState -> Skia draws the result via `BoardView`. Completion detection
 * (`isPuzzleSolved`) and history management (undo/restart) also live
 * entirely in `src/game/engine` - this component never implements game
 * rules itself, it only reads the resulting state.
 *
 * The engine itself is instantaneous (a gravity move resolves to its
 * final positions synchronously). `useAnimatedMovables` interpolates that
 * instantaneous result into a short slide purely for rendering - it never
 * changes what the "current state" is, only what is drawn on the way
 * there, so engine determinism/testability is untouched.
 */
/**
 * The live move count, popping on each move.
 *
 * Gravity grades every attempt on moves against the level's PAR, but the
 * header only ever showed PAR and BEST - both fixed for the whole attempt
 * - so the one number actually being scored was the one the player could
 * not see. `kick` rather than `pop`: this ticks on every single move, far
 * too often for the reward-tier bounce, matching how the other four
 * screens animate their own "N LEFT" kickers.
 */
function AnimatedMoveCount({ moves }: { moves: number }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(moves);

  useEffect(() => {
    if (moves !== previous.current) {
      scale.setValue(moves > previous.current ? 0.85 : 1.1);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.kick }).start();
    }
    previous.current = moves;
  }, [moves, scale]);

  return (
    <Animated.Text style={[styles.levelMoves, { transform: [{ scale }] }]}>{moves}</Animated.Text>
  );
}

export function GameScreen({ level, onExit, onNextPuzzle }: GameScreenProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initialState = useMemo(() => createGameStateFromLevel(level), [level]);
  const [session, dispatch] = useReducer(gameSessionReducer, initialState, createGameSession);

  const gameState = getCurrentState(session);
  const solved = isPuzzleSolved(gameState);
  const failed = isPuzzleFailed(gameState);

  // Gravity moves made in the current attempt. Each successful gravity push
  // adds one history entry (no-ops don't); undo pops one; restart resets to
  // one entry. So this is exactly "moves used to reach the state on screen",
  // which is what the star thresholds score against.
  const moveCount = session.history.length - 1;

  const { progress, recordCompletion, markLevelOpened } = usePlayerProgress();
  const { settings, ready: settingsReady, markTutorialSeen } = useSettings();

  // Which one-time "how this works" overlay (if any) this level should
  // offer: the game intro on a player's very first Gravity puzzle, or the
  // first not-yet-seen mechanic this level actually uses (see `mechanicsOf`
  // - it lists them in teaching order, so only the most foundational unseen
  // one shows even if a level combines several). In practice a level's
  // existing unlock requirements mean a player has always already met every
  // earlier mechanic by the time they reach a later one, so this rarely (if
  // ever) has more than one real candidate at a time.
  const tutorialCandidates = useMemo(
    () => [GAME_TUTORIAL_ID, ...mechanicsOf(level).map(tutorialIdForMechanic)],
    [level],
  );
  const [tutorialToShow, setTutorialToShow] = useState<ReturnType<typeof pickTutorial>>(null);
  useEffect(() => {
    if (settingsReady) setTutorialToShow(pickTutorial(settings.seenTutorials, tutorialCandidates));
  }, [settingsReady, settings.seenTutorials, tutorialCandidates]);
  const dismissTutorial = useCallback(() => {
    if (tutorialToShow) markTutorialSeen(tutorialToShow);
    setTutorialToShow(null);
  }, [tutorialToShow, markTutorialSeen]);
  // The header's "?" icon always reopens the base game-intro carousel,
  // bypassing `pickTutorial` - a manual reopen is always "show me how
  // Gravity itself works again", never one of the progressive mechanic
  // overlays.
  const reopenTutorial = useCallback(() => setTutorialToShow(GAME_TUTORIAL_ID), []);

  // Par (the optimal / 3-star move count) shown up front, plus the player's
  // best so far - reframes each level as a target to beat rather than an
  // open sandbox.
  const par = useMemo(() => getStarThresholds(level).three, [level]);
  const priorBest = getLevelResult(progress, level.id)?.bestMoves ?? null;

  // The next entry to offer on completion: whatever the interleaved Journey
  // deals after this puzzle - not necessarily another Gravity level. `null`
  // at the very end of the Journey - the card then shows "Back to Home"
  // instead of "Next Puzzle".
  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  // The set this solve might complete. Captured before `recordCompletion`
  // runs: finishing a set immediately generates the next one, so
  // `progress.currentBatch` is already the *new* set afterwards. Mirrored
  // through a ref so the solve effect need not depend on a value that the
  // effect itself causes to change.
  const finishedSetRef = useRef<BatchState | null>(null);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;
  // Finishing the last puzzle of a set shows the level card first, then
  // the set card - two separate moments. See `LevelSetComplete`.
  const [showSetComplete, setShowSetComplete] = useState(false);

  // Keep the resume cursor pointed at whatever level is on screen.
  useEffect(() => {
    markLevelOpened(level.id);
  }, [level.id, markLevelOpened]);

  // Result of scoring the solve currently on screen. Set once when the board
  // settles into a solved state, cleared when it leaves one (undo). Drives
  // the completion card; never re-recorded by incidental re-renders.
  const [outcome, setOutcome] = useState<CompletionOutcome | null>(null);

  // Which kind of transition produced the current `gameState`, so we know
  // whether to animate (gravity) or snap instantly (undo/restart/mount).
  const lastActionRef = useRef<LastAction>('init');
  const instant = lastActionRef.current !== 'gravity';

  const { movables: displayMovables, isAnimating, justLandedIds } = useAnimatedMovables(
    gameState.movables,
    instant,
  );
  const displayState = useMemo(
    () => ({ ...gameState, movables: displayMovables }),
    [gameState, displayMovables],
  );

  const onTargetIds = useMemo(() => computeOnTargetIds(gameState), [gameState]);
  const previousOnTargetRef = useRef<ReadonlySet<string>>(onTargetIds);
  const previousSolvedRef = useRef(false);

  // Refs mirroring the latest render values, so the input handlers below can
  // stay referentially stable (no re-subscribing the swipe responder / no
  // prop churn on the control pads every animation frame) while still reading
  // fresh state.
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const isAnimatingRef = useRef(isAnimating);
  isAnimatingRef.current = isAnimating;

  // Synchronous "a move is already committed, don't accept another" latch.
  // `isAnimating` is React state and does not update between two handler
  // calls in the same tick (a double-tap, or a button press racing a swipe
  // release); this ref does, so repeated gestures can never stack up two
  // moves into one slide or add phantom undo steps.
  const movePendingRef = useRef(false);
  const wasAnimatingRef = useRef(false);
  useEffect(() => {
    if (wasAnimatingRef.current && !isAnimating) {
      movePendingRef.current = false;
    }
    wasAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  // Haptics: a subtle tick the moment a piece newly lands on its target,
  // and a slightly firmer double-pulse the moment the whole puzzle is
  // solved. Gated on `!isAnimating` so the tick lands together with the
  // piece settling on screen, not ~200ms earlier when the logical move is
  // dispatched. Both are one-shot - re-renders that don't change the
  // underlying sets/booleans never re-trigger them.
  useEffect(() => {
    if (isAnimating) return;

    const previous = previousOnTargetRef.current;
    const gainedTarget = [...onTargetIds].some(id => !previous.has(id));
    previousOnTargetRef.current = onTargetIds;

    if (solved) {
      if (!previousSolvedRef.current) {
        previousSolvedRef.current = true;
        triggerFeedback('solved');
        // Record the solve exactly once per settled win. Replays re-enter
        // here after `restart` flips `solved` back to false and clears the
        // guard, so a better replay still updates the persisted best.
        finishedSetRef.current = currentBatchRef.current ?? null;
        setOutcome(recordCompletion(level.id, moveCount));
      }
    } else {
      previousSolvedRef.current = false;
      if (outcome !== null) setOutcome(null);
      if (gainedTarget) triggerFeedback('targetReached');
    }
  }, [onTargetIds, solved, isAnimating, moveCount, level.id, recordCompletion, outcome]);

  // A single, unmistakable buzz the instant a hazard destroys a piece -
  // separate from the win/progress effect above since it's the one outcome
  // that isn't a flavour of "things are going fine". Gated on `!isAnimating`
  // for the same reason as the win haptic: it should land with the piece
  // visibly reaching the hazard, not the moment the logical move commits.
  // The same moment also kicks the board with a quick shake - the one
  // outcome that's allowed to visibly rattle the board, not just overlay a
  // card on top of it.
  const previousFailedRef = useRef(false);
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isAnimating) return;

    if (failed) {
      if (!previousFailedRef.current) {
        previousFailedRef.current = true;
        triggerFeedback('failed');
        shake.setValue(0);
        Animated.sequence(
          [1, -1, 0.6, -0.6, 0.3, 0].map(to =>
            Animated.timing(shake, { toValue: to, duration: 45, useNativeDriver: true }),
          ),
        ).start();
      }
    } else {
      previousFailedRef.current = false;
    }
  }, [failed, isAnimating, shake]);

  // One flash value per edge, so firing a direction needs no re-render -
  // the bars are always mounted and only the struck one animates.
  const edgeFlashes = useRef<Record<Direction, Animated.Value>>({
    up: new Animated.Value(0),
    down: new Animated.Value(0),
    left: new Animated.Value(0),
    right: new Animated.Value(0),
  }).current;

  const handleDirection = useCallback((direction: Direction) => {
    // Ignore new gravity input while a move is already committed or still
    // sliding into place - this is what keeps rapid taps/swipes from piling
    // up overlapping animations or racing ahead of what's on screen. Undo
    // and Restart deliberately bypass this (see their handlers below).
    if (movePendingRef.current || isAnimatingRef.current) return;

    // A press that can't move anything is a silent no-op: no state change,
    // no haptic, no "something moved" cue.
    if (!gravityChangesState(gameStateRef.current, direction)) return;

    movePendingRef.current = true;
    lastActionRef.current = 'gravity';
    triggerFeedback('gravityChange');
    // Fired only past the no-op guard above, so the flash always means
    // "that input landed and moved something" - never "you swiped at a
    // wall". It confirms the swipe well before the pieces finish sliding,
    // which is the whole reason a swipe-only board needs it: there is no
    // pressed state to fall back on.
    const flash = edgeFlashes[direction];
    flash.stopAnimation();
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
    dispatch({ type: 'gravity', direction });
  }, [edgeFlashes]);

  const handleUndo = useCallback(() => {
    movePendingRef.current = false;
    lastActionRef.current = 'undo';
    dispatch({ type: 'undo' });
  }, []);

  const handleRestart = useCallback(() => {
    movePendingRef.current = false;
    lastActionRef.current = 'restart';
    dispatch({ type: 'restart' });
  }, []);

  const handleNext = useCallback(() => {
    if (!nextEntry) return;
    // A no-op for a non-Gravity entry - `markLevelOpened` only moves the
    // resume cursor when it can resolve a world for the id.
    markLevelOpened(nextEntry.puzzleId);
    onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: outcome?.batchCompleted ?? false });
  }, [nextEntry, onNextPuzzle, markLevelOpened, outcome]);

  const swipeHandlers = useSwipeGesture(handleDirection, isAnimating);

  const padding = theme.spacing.lg;
  const availableWidth = width - padding * 2 - STAGE_H_PADDING * 2;
  const availableHeight =
    height - insets.top - insets.bottom - padding * 2 - CONTROLS_AREA_HEIGHT;
  const boardSize = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={onExit}
          hitSlop={8}
          style={styles.backButton}
        >
          <Text style={styles.backButtonLabel}>{'‹ Home'}</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.levelName} numberOfLines={1}>
            {level.name}
          </Text>
          <View style={styles.levelStats}>
            <Text style={styles.levelPar}>MOVES </Text>
            <AnimatedMoveCount moves={moveCount} />
            <Text style={styles.levelPar}>
              {' · '}PAR {par}
              {priorBest !== null ? ` · BEST ${priorBest}` : ''}
            </Text>
          </View>
          {progress.currentBatch && <BatchProgressDots batch={progress.currentBatch} style={styles.batchDots} />}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="How to play"
          onPress={reopenTutorial}
          hitSlop={8}
          containerStyle={styles.backButtonSpacer}
        >
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.board,
            {
              width: boardSize,
              height: boardSize,
              transform: [
                { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) },
              ],
            },
          ]}
          {...swipeHandlers}
        >
          <Canvas style={styles.canvas}>
            <BoardView
              state={displayState}
              size={boardSize}
              onTargetIds={onTargetIds}
              pulsingIds={justLandedIds}
            />
          </Canvas>
          {/* The edge gravity just pulled toward, lit briefly. Inside the
              board container so it tracks the board (shake included) - it
              is feedback about the board, not about the screen. */}
          {(['up', 'down', 'left', 'right'] as const).map(edge => (
            <Animated.View
              key={`pull-${edge}`}
              pointerEvents="none"
              style={[styles.pullEdge, styles[`pullEdge_${edge}` as const], { opacity: edgeFlashes[edge] }]}
            />
          ))}
        </Animated.View>
      </View>

      <View style={styles.sessionControls}>
        <SessionControls
          onUndo={handleUndo}
          onRestart={handleRestart}
          // Once a hazard has claimed a piece, Undo is off the table - the
          // failure has to mean something, and `LevelFailedCard` frames
          // Retry/Exit as the only ways out. Undoing a *solve* stays
          // allowed (see the recordCompletion effect above): that's a
          // deliberate "try for a better run" path, not an escape from a
          // stated loss condition.
          undoDisabled={!canUndo(session) || failed}
        />
      </View>

      {/* Both outcome cards sit at the screen root, not inside the board.
          They cover the screen with `absoluteFill`, so nested inside the
          board container that only ever covered the *board* - and worse,
          that container carries the board's own shake transform, so a card
          rendered in it shook along with the board it was reporting on. */}
      {solved && !isAnimating && outcome && (
        <LevelCompleteCard
          stars={outcome.best.stars}
          runStars={outcome.runStars}
          moves={outcome.runMoves}
          bestMoves={outcome.best.bestMoves}
          hasNextLevel={nextEntry !== null}
          onReplay={handleRestart}
          onNext={outcome.batchCompleted && finishedSetRef.current ? () => setShowSetComplete(true) : handleNext}
          onExit={onExit}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete
          levelNumber={finishedSetRef.current.levelNumber}
          kinds={finishedSetRef.current.puzzles.map((entry: BatchState['puzzles'][number]) => entry.kind)}
          onContinue={handleNext}
        />
      )}
      {failed && !isAnimating && <LevelFailedCard onRetry={handleRestart} onExit={onExit} />}

      {tutorialToShow === GAME_TUTORIAL_ID ? (
        <MechanicsCarousel
          slides={GRAVITY_MECHANICS_SLIDES}
          renderIllustration={renderGravityIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('gravity')}
        />
      ) : (
        tutorialToShow && <TutorialOverlay copy={copyForTutorial(tutorialToShow)} onDismiss={dismissTutorial} />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  backButtonSpacer: {
    minWidth: 60,
    alignItems: 'center',
  },
  backButtonLabel: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  levelName: {
    textAlign: 'center',
    fontFamily: theme.typography.families.display,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
  },
  levelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  levelPar: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.secondary,
  },
  /** The one number that changes during an attempt, so it carries a touch
   * more weight than the fixed PAR/BEST either side of it. */
  levelMoves: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1,
    color: theme.colors.secondary,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  // The board's own plinth - see `BinairoScreen.tsx`'s `styles.stage`.
  stage: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 28,
    paddingHorizontal: STAGE_H_PADDING,
    paddingVertical: theme.spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
  },
  board: {
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  /** The gravity-pull flash: a soft bar hugging the edge the board was
   * just pulled toward. Kept thin and brief - a confirmation, not a
   * spotlight. */
  pullEdge: {
    position: 'absolute',
    backgroundColor: theme.colors.secondary,
    borderRadius: 4,
  },
  pullEdge_up: { top: 0, left: 0, right: 0, height: 6 },
  pullEdge_down: { bottom: 0, left: 0, right: 0, height: 6 },
  pullEdge_left: { left: 0, top: 0, bottom: 0, width: 6 },
  pullEdge_right: { right: 0, top: 0, bottom: 0, width: 6 },
  sessionControls: {
    marginTop: theme.spacing.xl,
  },
});

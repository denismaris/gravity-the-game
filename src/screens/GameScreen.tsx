import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView, triggerHaptic, useAnimatedMovables } from '../game/rendering';
import {
  canUndo,
  createGameSession,
  Direction,
  gameSessionReducer,
  getCurrentState,
  gravityChangesState,
  isPuzzleSolved,
  StaticCellType,
} from '../game/engine';
import { createGameStateFromLevel, getStarThresholds, LevelDefinition } from '../game/levels';
import { LevelCompleteCard, SessionControls, useSwipeGesture } from '../components';
import { GameKind, getNextJourneyEntry } from '../game/journey';
import { CompletionOutcome, getLevelResult, usePlayerProgress } from '../progression';
import { theme } from '../theme';

/** Approximate height reserved below the board for the header text above it
 * and the Undo/Restart row beneath it - there is no direction pad any more,
 * gravity is triggered purely by swiping the board (see `useSwipeGesture`),
 * which made the pad a redundant second control for the same input. */
const CONTROLS_AREA_HEIGHT = 190;

export interface GameScreenProps {
  /** The level to play. Changing this remounts the board at a fresh state. */
  level: LevelDefinition;
  /** Called when the player wants to return to the level select screen. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the three games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
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
export function GameScreen({ level, onExit, onNextPuzzle }: GameScreenProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initialState = useMemo(() => createGameStateFromLevel(level), [level]);
  const [session, dispatch] = useReducer(gameSessionReducer, initialState, createGameSession);

  const gameState = getCurrentState(session);
  const solved = isPuzzleSolved(gameState);

  // Gravity moves made in the current attempt. Each successful gravity push
  // adds one history entry (no-ops don't); undo pops one; restart resets to
  // one entry. So this is exactly "moves used to reach the state on screen",
  // which is what the star thresholds score against.
  const moveCount = session.history.length - 1;

  const { progress, recordCompletion, markLevelOpened } = usePlayerProgress();

  // Par (the optimal / 3-star move count) shown up front, plus the player's
  // best so far - reframes each level as a target to beat rather than an
  // open sandbox.
  const par = useMemo(() => getStarThresholds(level).three, [level]);
  const priorBest = getLevelResult(progress, level.id)?.bestMoves ?? null;

  // The next entry to offer on completion: whatever the interleaved Journey
  // deals after this puzzle - not necessarily another Gravity level. `null`
  // at the very end of the Journey - the card then shows "Back to Home"
  // instead of "Next Puzzle".
  const nextEntry = useMemo(() => getNextJourneyEntry(level.id), [level.id]);

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
        triggerHaptic('solved');
        // Record the solve exactly once per settled win. Replays re-enter
        // here after `restart` flips `solved` back to false and clears the
        // guard, so a better replay still updates the persisted best.
        setOutcome(recordCompletion(level.id, moveCount));
      }
    } else {
      previousSolvedRef.current = false;
      if (outcome !== null) setOutcome(null);
      if (gainedTarget) triggerHaptic('targetReached');
    }
  }, [onTargetIds, solved, isAnimating, moveCount, level.id, recordCompletion, outcome]);

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
    triggerHaptic('gravityChange');
    dispatch({ type: 'gravity', direction });
  }, []);

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
    onNextPuzzle(nextEntry.kind, nextEntry.puzzleId);
  }, [nextEntry, onNextPuzzle, markLevelOpened]);

  const swipeHandlers = useSwipeGesture(handleDirection, isAnimating);

  const padding = theme.spacing.lg;
  const availableWidth = width - padding * 2;
  const availableHeight =
    height - insets.top - insets.bottom - padding * 2 - CONTROLS_AREA_HEIGHT;
  const boardSize = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={onExit}
          hitSlop={8}
          style={styles.backButton}
        >
          <Text style={styles.backButtonLabel}>{'‹ Home'}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.levelName} numberOfLines={1}>
            {level.name}
          </Text>
          <Text style={styles.levelPar}>
            PAR {par}
            {priorBest !== null ? `   ·   BEST ${priorBest}` : ''}
          </Text>
        </View>
        <View style={styles.backButtonSpacer} />
      </View>

      <View
        style={[styles.board, { width: boardSize, height: boardSize }]}
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
        {solved && !isAnimating && outcome && (
          <LevelCompleteCard
            stars={outcome.best.stars}
            runStars={outcome.runStars}
            moves={outcome.runMoves}
            bestMoves={outcome.best.bestMoves}
            hasNextLevel={nextEntry !== null}
            onReplay={handleRestart}
            onNext={handleNext}
            onExit={onExit}
          />
        )}
      </View>

      <View style={styles.sessionControls}>
        <SessionControls
          onUndo={handleUndo}
          onRestart={handleRestart}
          undoDisabled={!canUndo(session)}
        />
      </View>
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
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  levelPar: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  board: {
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  sessionControls: {
    marginTop: theme.spacing.xl,
  },
});

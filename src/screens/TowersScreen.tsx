import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  computeConflicts,
  emptyTowersState,
  isColComplete,
  isRowComplete,
  isTowersSolved,
  remainingCells,
  revealHint,
  setCell,
  TowersCell,
  TowersPuzzle,
} from '../game/towers';
import { BatchProgressDots, GeometricRule, LevelSetComplete, MechanicsCarousel, NumberKeypad, PressableScale, PuzzleSolved, TowersBoard, renderTowersIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { TOWERS_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme } from '../theme';

const TUTORIAL_ID = tutorialIdForGame('towers');
const ICON_SIZE = 14;

/** A plain "?" glyph - see `BinairoScreen.tsx`'s identical `HelpIcon` for
 * the full rationale. Reopens the same `MechanicsCarousel` the first-run
 * auto-open shows. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

/** A small lightbulb - see `BinairoScreen.tsx`'s identical `HintIcon` for
 * the full rationale. Tinted this game's own identity accent
 * (`towersAccent`, echoing the board's own frame and the header's
 * kicker/progress-track) rather than plain ink, so the two primary
 * actions on this screen carry the same accent the board itself does. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.towersAccent} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.towersAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.towersAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.towersAccent} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

/** A restart-arrow glyph, same `towersAccent` treatment as `HintIcon` above
 * - see `BinairoScreen.tsx`'s identical `RestartIcon` for the sweep-flag
 * rationale. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.towersAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.towersAccent} />
    </Canvas>
  );
}

export interface TowersScreenProps {
  puzzle: TowersPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

const RESERVED = 360;
/** The stage card's own horizontal inset around the board - see
 * `BinairoScreen.tsx`'s identical constant for why this is tight while
 * the stage's vertical padding (below) is generous. */
const STAGE_H_PADDING = theme.spacing.sm;
/** How long the progress track's fill animates to its new width. */
const TRACK_MS = 220;

/**
 * Play screen for a Skyscrapers puzzle. Tap a cell to select it, tap a
 * height below to fill it (or the eraser to clear it); the grid is solved
 * the instant every row/column holds 1..N once and every clue matches.
 */
export function TowersScreen({ puzzle, onExit, onNextPuzzle }: TowersScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { ready: settingsReady, hasSeenTutorial, markTutorialSeen } = useSettings();

  const digits = useMemo(() => Array.from({ length: puzzle.size }, (_v, i) => i + 1), [puzzle.size]);

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
  const [state, setState] = useState(() => emptyTowersState(puzzle));
  const [selected, setSelected] = useState<TowersCell | null>(null);
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<TowersCell | null>(null);
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

  const solved = useMemo(() => isTowersSolved(puzzle, state), [puzzle, state]);
  const left = remainingCells(state);
  const totalCells = puzzle.size * puzzle.size;

  // The header's own progress track - see `styles.track`.
  const trackFill = useRef(new Animated.Value(totalCells ? (totalCells - left) / totalCells : 0)).current;
  useEffect(() => {
    Animated.timing(trackFill, {
      toValue: totalCells ? (totalCells - left) / totalCells : 0,
      duration: TRACK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't a transform - can't use the native driver
    }).start();
  }, [left, totalCells, trackFill]);

  const heightCounts = useMemo(() => {
    const tally: Record<number, number> = {};
    for (const row of state.values) for (const v of row) if (v !== 0) tally[v] = (tally[v] ?? 0) + 1;
    return tally;
  }, [state]);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      triggerFeedback('towersSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const selectCell = useCallback((row: number, col: number) => {
    setSelected({ row, col });
  }, []);

  const enterHeight = useCallback(
    (value: number) => {
      if (!selected || solved) return;
      const { row, col } = selected;
      setState(s => {
        const next = setCell(s, row, col, value);
        if (next === s) return next;

        // The solved sound fires exactly once from the `solved` effect
        // above, regardless of which action triggers it - skipped entirely
        // here, or a solving move would sound twice in the same tick. Short
        // of that: a conflict at the cell just touched beats a completed
        // line (a wrong entry that happens to fill a line isn't a
        // milestone); a genuinely new line completion beats the plain
        // per-entry sound.
        if (!isTowersSolved(puzzle, next)) {
          if (computeConflicts(next).has(`${row}:${col}`)) {
            triggerFeedback('towersConflict');
          } else if (
            (isRowComplete(puzzle, next, row) && !isRowComplete(puzzle, s, row)) ||
            (isColComplete(puzzle, next, col) && !isColComplete(puzzle, s, col))
          ) {
            triggerFeedback('towersRowComplete');
          } else {
            triggerFeedback('towersPlace');
          }
        }
        return next;
      });
    },
    [selected, solved, puzzle],
  );

  const erase = useCallback(() => {
    if (!selected) return;
    setState(s => setCell(s, selected.row, selected.col, 0));
  }, [selected]);

  const useHint = useCallback(() => {
    setState(s => {
      const h = revealHint(s, puzzle);
      if (!h) return s;
      setHints(n => n + 1);
      setFlash(h.cell);
      setSelected(h.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 450);
      triggerFeedback('targetReached');
      return h.state;
    });
  }, [puzzle]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setSelected(null);
    setState(emptyTowersState(puzzle));
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
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1}>
            {puzzle.name ?? 'Skyscrapers'}
          </Text>
          <AnimatedKicker left={left} solved={solved} />
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  width: trackFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
                },
              ]}
            />
          </View>
          {progress.currentBatch && <BatchProgressDots batch={progress.currentBatch} style={styles.batchDots} />}
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
        <View style={styles.stage}>
          <GeometricRule variant="stage" style={styles.stageRule} />
          <TowersBoard
            puzzle={puzzle}
            state={state}
            size={boardSize}
            selected={selected}
            onSelectCell={selectCell}
            flashCell={flash}
          />
        </View>
      </View>

      <View style={styles.keypadArea}>
        <NumberKeypad
          digits={digits}
          counts={heightCounts}
          disabled={!selected || solved}
          onPressDigit={enterHeight}
          onErase={erase}
        />
      </View>

      <View style={styles.controls}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Reveal a hint"
          onPress={useHint}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <HintIcon />
          <Text style={styles.pillText}>Hint</Text>
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
      </View>

      {solved && stars && (
        <PuzzleSolved
          kind="towers"
          stars={stars}
          hintsUsed={hints}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null}
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
          slides={TOWERS_MECHANICS_SLIDES}
          renderIllustration={renderTowersIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('towers')}
        />
      )}
    </View>
  );
}

/** The "N LEFT" kicker, popping (`spring.pop`) on each decrement only -
 * mirrors `BinairoScreen.tsx`'s own `AnimatedKicker` exactly. */
function AnimatedKicker({ left, solved }: { left: number; solved: boolean }): React.JSX.Element {
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
      <Animated.Text style={[styles.kicker, { transform: [{ scale }] }]}>
        {solved ? 'SKYSCRAPERS · SOLVED' : `SKYSCRAPERS · ${left} LEFT`}
      </Animated.Text>
      {solved && <Animated.View style={[styles.solvedBadge, { transform: [{ scale: solvedScale }] }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.towersAccent,
  },
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
    backgroundColor: theme.colors.towersAccent,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  // Anchored to the header, not centred in leftover space - see
  // `BinairoScreen.tsx`'s own `styles.boardArea`.
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: theme.spacing.lg,
  },
  // The board's own plinth - see `BinairoScreen.tsx`'s `styles.stage`. No
  // fill of its own now - just the page's background plus a snug
  // top/bottom rule hugging the board, not a second boxed card behind it.
  /** The signature rule standing in for the stage's old plain top
   * hairline - same job, carrying the app's own mark. */
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
  keypadArea: {
    marginBottom: theme.spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderTopColor: '#FBF6EB',
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    shadowColor: '#3B1F52',
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
});

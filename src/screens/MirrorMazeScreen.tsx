import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  emptyMirrorMazeState,
  isMirrorMazeSolved,
  MirrorMazeCell,
  MirrorMazePuzzle,
  nextMirror,
  remainingGems,
  revealHint,
  setMirror,
  traceBeam,
} from '../game/mirror';
import { BatchProgressDots, GeometricRule, LevelSetComplete, MechanicsCarousel, MirrorMazeBoard, PressableScale, PuzzleSolved, renderMirrorMazeIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback, useAnimatedBeamReveal } from '../game/rendering';
import { MIRROR_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme } from '../theme';

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
/** How long the progress track's fill animates to its new width on a
 * placement - a quiet "state indication" beat, not a celebration. */
const TRACK_MS = 220;

function gemKey(cell: MirrorMazeCell): string {
  return `${cell.row}:${cell.col}`;
}

const ICON_SIZE = 14;

/** A small lightbulb - see `BinairoScreen.tsx`'s identical `HintIcon` for
 * the full rationale. Tinted this game's own identity colour
 * (`mirrorAccent`, echoing the board's own frame and the header's
 * kicker/progress-track) rather than plain ink, so the accent has a
 * second, more prominent home than one thin line up in the header. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.mirrorAccent} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

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

/**
 * Play screen for a Mirror Maze puzzle. Tap a cell to cycle no mirror ->
 * `/` -> `\` -> no mirror; the beam is retraced live from the source on
 * every change, and the puzzle solves the instant it reaches the target
 * having touched every gem.
 */
export function MirrorMazeScreen({ puzzle, onExit, onNextPuzzle }: MirrorMazeScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
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
  const [state, setState] = useState(() => emptyMirrorMazeState(puzzle));
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
  const { revealProgress } = useAnimatedBeamReveal(path, solved);
  const left = remainingGems(puzzle, state);
  const totalGems = puzzle.gems.length;

  // The header's own progress track - see `styles.track`. Animates toward
  // its new fraction on every gem lit rather than jumping.
  const trackFill = useRef(new Animated.Value(totalGems ? (totalGems - left) / totalGems : 0)).current;
  useEffect(() => {
    if (!totalGems) return;
    Animated.timing(trackFill, {
      toValue: (totalGems - left) / totalGems,
      duration: TRACK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't a transform - can't use the native driver
    }).start();
  }, [left, totalGems, trackFill]);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      triggerFeedback('mirrorSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const cycleCell = useCallback(
    (row: number, col: number) => {
      setState(s => {
        if (isMirrorMazeSolved(puzzle, s)) return s;
        const next = setMirror(s, puzzle, row, col, nextMirror(s.mirrors[row][col]));
        if (next === s) return next;

        // The gem chime the instant this placement makes the beam newly
        // reach a gem it wasn't touching before; otherwise the glassy click
        // of a mirror turning.
        const litBefore = new Set(traceBeam(puzzle, s).map(gemKey));
        const litAfter = traceBeam(puzzle, next);
        const gainedGem = puzzle.gems.some(
          g => !litBefore.has(gemKey(g)) && litAfter.some(c => c.row === g.row && c.col === g.col),
        );
        triggerFeedback(gainedGem ? 'mirrorGem' : 'mirrorPlace');

        return next;
      });
    },
    [puzzle],
  );

  const useHint = useCallback(() => {
    setState(s => {
      const h = revealHint(s, puzzle);
      if (!h) return s;
      setHints(n => n + 1);
      setFlash(h.cell);
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
    setState(emptyMirrorMazeState(puzzle));
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
            {puzzle.name ?? 'Mirror Maze'}
          </Text>
          <AnimatedKicker left={left} total={totalGems} solved={solved} />
          {totalGems > 0 && (
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
          )}
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
          kind="mirror"
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
          slides={MIRROR_MECHANICS_SLIDES}
          renderIllustration={renderMirrorMazeIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('mirror')}
        />
      )}
    </View>
  );
}

/** The "N GEMS LEFT" kicker, popping (`spring.pop`) on each decrement only -
 * mirrors `BinairoScreen.tsx`'s own `AnimatedKicker` exactly, so every
 * puzzle screen's header counter moves the same way. On solve, it swaps to
 * "SOLVED" with a small filled dot popping in beside it. */
function AnimatedKicker({ left, total, solved }: { left: number; total: number; solved: boolean }): React.JSX.Element {
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
        {solved ? 'MIRROR MAZE · SOLVED' : `MIRROR MAZE${total > 0 ? ` · ${left} GEM${left === 1 ? '' : 'S'} LEFT` : ''}`}
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
    color: theme.colors.mirrorAccent,
  },
  solvedBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 5,
  },
  // The header's own progress track - see `BinairoScreen.tsx`'s identical
  // pattern (itself following `HomeScreen.tsx`'s hero-card track), tinted
  // with this game's own identity colour instead of the app-wide
  // `secondary`.
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
    backgroundColor: theme.colors.mirrorAccent,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  // Anchored to the header, not centred in leftover space - see
  // `BinairoScreen.tsx`'s own `styles.boardArea` for the full rationale
  // (a small board used to float adrift in a mostly-empty screen; any
  // spare room now collects below the controls instead).
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: theme.spacing.lg,
  },
  // The board's own plinth - see `BinairoScreen.tsx`'s `styles.stage` for
  // the full rationale: no fill of its own now (the board's own panel
  // already carries its own fill/border/shadow, so a filled plinth here
  // stacked a second box around the first), just the page's own
  // background plus a snug top/bottom rule hugging the board closely.
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
    // A slightly lighter top edge than the other three sides - see
    // `BinairoScreen.tsx`'s identical `pill` style for why (a small
    // "catching the light" cue rather than one flat border colour).
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

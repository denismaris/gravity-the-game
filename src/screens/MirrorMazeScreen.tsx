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
import { MechanicsCarousel, MirrorMazeBoard, PressableScale, PuzzleSolved, renderMirrorMazeIllustration } from '../components';
import { accentColorForKind, GameKind, getNextJourneyEntry } from '../game/journey';
import { triggerFeedback, useAnimatedBeamReveal } from '../game/rendering';
import { MIRROR_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme } from '../theme';

const TUTORIAL_ID = tutorialIdForGame('mirror');

export interface MirrorMazeScreenProps {
  puzzle: MirrorMazePuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the eight games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
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
  const { recordCompletion } = usePlayerProgress();
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

  const nextEntry = useMemo(() => getNextJourneyEntry(puzzle.id), [puzzle.id]);
  const [state, setState] = useState(() => emptyMirrorMazeState(puzzle));
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<MirrorMazeCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
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
      const outcome = recordCompletion(puzzle.id, hints);
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
    setStars(null);
    setHints(0);
    setState(emptyMirrorMazeState(puzzle));
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId);
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
          <Text style={styles.pillText}>Hint</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Restart puzzle"
          onPress={restart}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <Text style={styles.pillText}>Restart</Text>
        </PressableScale>
      </View>

      {solved && stars && (
        <PuzzleSolved
          stars={stars}
          hintsUsed={hints}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null}
          onNext={goNext}
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
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The board's own plinth - see `BinairoScreen.tsx`'s `styles.stage` for
  // the full rationale (tight horizontal padding since width caps the
  // board on every phone, generous vertical since that's the axis with
  // spare room; lighter top/darker bottom border reads as a shallow
  // recessed well catching light from above).
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
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  pill: {
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
    shadowColor: '#2A251F',
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

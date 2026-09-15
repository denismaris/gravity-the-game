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
import { MechanicsCarousel, NumberKeypad, PressableScale, PuzzleSolved, renderTowersIllustration, TowersBoard } from '../components';
import { accentColorForKind, GameKind, getNextJourneyEntry } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { TOWERS_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { usePlayerProgress } from '../progression';
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

export interface TowersScreenProps {
  puzzle: TowersPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
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
  const { recordCompletion } = usePlayerProgress();
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

  const nextEntry = useMemo(() => getNextJourneyEntry(puzzle.id), [puzzle.id]);
  const [state, setState] = useState(() => emptyTowersState(puzzle));
  const [selected, setSelected] = useState<TowersCell | null>(null);
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<TowersCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
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
      const outcome = recordCompletion(puzzle.id, hints);
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
    setStars(null);
    setHints(0);
    setSelected(null);
    setState(emptyTowersState(puzzle));
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
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  keypadArea: {
    marginBottom: theme.spacing.lg,
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cluesEqual,
  ConstellationCell,
  ConstellationPuzzle,
  ConstellationState,
  emptyConstellationState,
  isConstellationSolved,
  nextMark,
  remainingCells,
  revealHint,
  runsOf,
  setMark,
} from '../game/constellation';
import { ConstellationBoard, PuzzleSolved } from '../components';
import { GameKind, getNextJourneyEntry } from '../game/journey';
import { triggerHaptic } from '../game/rendering';
import { usePlayerProgress } from '../progression';
import { theme } from '../theme';

export interface ConstellationScreenProps {
  puzzle: ConstellationPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the three games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
}

const RESERVED = 300;

/**
 * Play screen for a Constellation (nonogram) puzzle. Tap a cell to cycle
 * blank -> filled -> crossed; a filled set matching the solution wins.
 */
export function ConstellationScreen({
  puzzle,
  onExit,
  onNextPuzzle,
}: ConstellationScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { recordCompletion } = usePlayerProgress();

  const nextEntry = useMemo(() => getNextJourneyEntry(puzzle.id), [puzzle.id]);
  const [state, setState] = useState(() => emptyConstellationState(puzzle));
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<ConstellationCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);

  const solved = useMemo(() => isConstellationSolved(state, puzzle), [state, puzzle]);
  const left = remainingCells(state, puzzle);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      const outcome = recordCompletion(puzzle.id, hints);
      setStars(outcome.best.stars);
      triggerHaptic('solved');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const toggle = useCallback(
    (row: number, col: number) => {
      setState(s => {
        if (isConstellationSolved(s, puzzle)) return s;
        const next = setMark(s, row, col, nextMark(s.marks[row][col]));
        if (next === s) return next;

        // A firmer tick the instant this cell completes its row or column
        // clue; otherwise the same faint per-step tick Trajectory uses.
        const rowDone = (line: ConstellationState['marks'][number]) =>
          cluesEqual(runsOf(line.map(m => m === 'filled')), puzzle.rowClues[row]);
        const colDone = (marks: ConstellationState['marks']) =>
          cluesEqual(runsOf(marks.map(r => r[col] === 'filled')), puzzle.colClues[col]);
        const justDone =
          (!rowDone(s.marks[row]) && rowDone(next.marks[row])) ||
          (!colDone(s.marks) && colDone(next.marks));
        triggerHaptic(justDone ? 'targetReached' : 'step');

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
      setTimeout(() => setFlash(null), 450);
      triggerHaptic('targetReached');
      return h.state;
    });
  }, [puzzle]);

  const restart = useCallback(() => {
    recorded.current = false;
    setStars(null);
    setHints(0);
    setState(emptyConstellationState(puzzle));
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId);
  }, [nextEntry, onNextPuzzle]);

  const boardSize = Math.max(
    0,
    Math.min(width - theme.spacing.lg * 2, height - insets.top - insets.bottom - RESERVED),
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1}>
            {puzzle.name ?? 'Constellation'}
          </Text>
          <Text style={styles.kicker}>CONSTELLATION · {left} LEFT</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={styles.boardArea}>
        <ConstellationBoard
          puzzle={puzzle}
          state={state}
          size={boardSize}
          onToggleCell={toggle}
          flashCell={flash}
        />
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reveal a hint"
          onPress={useHint}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <Text style={styles.pillText}>Hint</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart puzzle"
          onPress={restart}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <Text style={styles.pillText}>Restart</Text>
        </Pressable>
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
  headerRightSpacer: { width: 56 },
  name: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: theme.colors.border,
  },
  pillPressed: { backgroundColor: theme.colors.surfaceAlt },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

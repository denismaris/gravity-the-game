import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { NumberKeypad, PressableScale, PuzzleSolved, TowersBoard, TutorialOverlay } from '../components';
import { accentColorForKind, GameKind, getNextJourneyEntry } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { copyForTutorial, tutorialIdForGame } from '../game/tutorials';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme } from '../theme';

const TUTORIAL_ID = tutorialIdForGame('towers');

export interface TowersScreenProps {
  puzzle: TowersPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
}

const RESERVED = 360;

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
    Math.min(width - theme.spacing.lg * 2, height - insets.top - insets.bottom - RESERVED),
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
          <Text style={styles.kicker}>SKYSCRAPERS · {left} LEFT</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={styles.boardArea}>
        <TowersBoard
          puzzle={puzzle}
          state={state}
          size={boardSize}
          selected={selected}
          onSelectCell={selectCell}
          flashCell={flash}
        />
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
        <TutorialOverlay
          copy={copyForTutorial(TUTORIAL_ID)}
          onDismiss={dismissTutorial}
          accentColor={accentColorForKind('towers')}
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
    color: theme.colors.towersAccent,
    marginTop: 2,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: theme.colors.border,
  },
  pillPressed: { backgroundColor: theme.colors.surfaceAlt },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

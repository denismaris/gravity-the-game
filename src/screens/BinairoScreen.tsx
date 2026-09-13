import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BinairoCell,
  BinairoPuzzle,
  emptyBinairoState,
  isBinairoSolved,
  nextValue,
  remainingCells,
  revealHint,
  setValue,
} from '../game/binairo';
import { BinairoBoard, PressableScale, PuzzleSolved, TutorialOverlay } from '../components';
import { accentColorForKind, GameKind, getNextJourneyEntry } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { copyForTutorial, tutorialIdForGame } from '../game/tutorials';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme } from '../theme';

const TUTORIAL_ID = tutorialIdForGame('binairo');

export interface BinairoScreenProps {
  puzzle: BinairoPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string) => void;
}

const RESERVED = 300;

/**
 * Play screen for a Binairo puzzle. Tap a cell to cycle blank -> ring ->
 * dot -> blank; matching every row and column's balance, with no run of
 * three and no repeated line, solves it.
 */
export function BinairoScreen({ puzzle, onExit, onNextPuzzle }: BinairoScreenProps): React.JSX.Element {
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

  const nextEntry = useMemo(() => getNextJourneyEntry(puzzle.id), [puzzle.id]);
  const [state, setState] = useState(() => emptyBinairoState(puzzle));
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<BinairoCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const solved = useMemo(() => isBinairoSolved(puzzle, state), [puzzle, state]);
  const left = remainingCells(state);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      const outcome = recordCompletion(puzzle.id, hints);
      setStars(outcome.best.stars);
      triggerFeedback('solved');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const toggle = useCallback(
    (row: number, col: number) => {
      setState(s => {
        if (isBinairoSolved(puzzle, s)) return s;
        const next = setValue(s, puzzle, row, col, nextValue(s.values[row][col]));
        if (next === s) return next;
        triggerFeedback(isBinairoSolved(puzzle, next) ? 'solved' : 'step');
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
    setState(emptyBinairoState(puzzle));
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
            {puzzle.name ?? 'Binairo'}
          </Text>
          <Text style={styles.kicker}>BINAIRO · {left} LEFT</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={styles.boardArea}>
        <BinairoBoard puzzle={puzzle} state={state} size={boardSize} onToggleCell={toggle} flashCell={flash} />
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
          accentColor={accentColorForKind('binairo')}
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
    color: theme.colors.binairoAccent,
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

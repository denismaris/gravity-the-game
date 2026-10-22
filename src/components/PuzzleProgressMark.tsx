import React, { useRef } from 'react';
import { View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { grandWeekOf, isTodaysDaily } from '../game/journey';
import { useIsPractice } from '../progression/PlayerProgressProvider';
import type { BatchState } from '../progression/batches';
import { theme, themedStyles } from '../theme';
import { BatchProgressDots } from './BatchProgressDots';

/**
 * Under a puzzle's title: where this puzzle sits. A puzzle from the level
 * set shows the set's progress; today's Daily is played on its own, so it
 * says so instead of showing a set it is not part of.
 */
export function PuzzleProgressMark({ batch, puzzleId, style }: { batch: BatchState | null; puzzleId: string; style?: ViewStyle }): React.JSX.Element | null {
  const practice = useIsPractice();
  // The set this puzzle was dealt in. Solving a set's last puzzle deals the
  // next set at once; the screen still shows the finished one, so its dots
  // stay - all filled - rather than jumping to the new set's empty ones.
  const dealtIn = useRef<BatchState | null>(null);
  if (batch && batch.puzzles.some(p => p.puzzleId === puzzleId)) dealtIn.current = batch;
  // Played on its own, outside any set: say what it is instead of showing
  // a set's dots it is not part of.
  const label = practice ? 'Practice' : isTodaysDaily(puzzleId) ? "Today's Daily" : grandWeekOf(puzzleId) !== null ? 'Weekly Grand' : null;
  if (label) {
    return (
      <View style={[styles.daily, label === 'Weekly Grand' && styles.grand, style]} accessibilityRole="text" accessibilityLabel={label}>
        <Text style={[styles.dailyText, label === 'Weekly Grand' && styles.grandText]}>{label}</Text>
      </View>
    );
  }
  const shown = dealtIn.current;
  if (!shown) return null;
  // Its set already replaced: this puzzle was the one that finished it.
  const finished = shown !== batch && !shown.completedPuzzleIds.includes(puzzleId) ? { ...shown, completedPuzzleIds: [...shown.completedPuzzleIds, puzzleId] } : shown;
  return <BatchProgressDots batch={finished} currentId={puzzleId} style={style} />;
}

const styles = themedStyles(() => ({
  daily: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.secondary },
  dailyText: { fontSize: 11.5, fontWeight: theme.typography.weights.bold, color: theme.colors.secondary },
  grand: { borderColor: theme.colors.goldRim },
  grandText: { color: theme.colors.gold },
}));

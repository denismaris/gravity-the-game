import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { isTodaysDaily } from '../game/journey';
import type { BatchState } from '../progression/batches';
import { theme, themedStyles } from '../theme';
import { BatchProgressDots } from './BatchProgressDots';

/**
 * Under a puzzle's title: where this puzzle sits. A puzzle from the level
 * set shows the set's progress; today's Daily is played on its own, so it
 * says so instead of showing a set it is not part of.
 */
export function PuzzleProgressMark({ batch, puzzleId, style }: { batch: BatchState | null; puzzleId: string; style?: ViewStyle }): React.JSX.Element | null {
  if (isTodaysDaily(puzzleId)) {
    return (
      <View style={[styles.daily, style]} accessibilityRole="text" accessibilityLabel="Today's Daily">
        <Text style={styles.dailyText}>TODAY'S DAILY</Text>
      </View>
    );
  }
  return batch ? <BatchProgressDots batch={batch} style={style} /> : null;
}

const styles = themedStyles(() => ({
  daily: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.secondary },
  dailyText: { fontFamily: theme.typography.families.mono, fontSize: 9, letterSpacing: 1.4, fontWeight: theme.typography.weights.bold, color: theme.colors.secondary },
}));

import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { theme, themedStyles } from '../theme';

export interface DifficultyChipProps {
  readonly difficulty: PuzzleDifficulty;
  /** Gravity's own fourth tier. The shared `PuzzleDifficulty` vocabulary
   * has no `'expert'` (see `puzzleDisplayInfo`), but Gravity's screen
   * holds the richer value and there is no reason to hide it from a
   * player standing in front of one. */
  readonly expert?: boolean;
  /** The challenge slot in a level's batch - the deliberately hard one
   * the rhythm plants every few puzzles. Says so outright rather than
   * leaving the player to infer it from the tier label. */
  readonly challenge?: boolean;
  /** Spacing only. Each caller owns where its own chip sits, the same way
   * `BatchProgressDots` and the header hint buttons take theirs. */
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * How hard this puzzle is, in a word. Every game screen carries one, and
 * so does Home's hero card, because until now the app never told the
 * player how hard anything was - a complaint that applied equally to a
 * board that turned out trivial and one that turned out brutal.
 *
 * Colour is doing real work and is deliberately narrow: the per-game
 * accents are spoken for by game identity (an amber chip on the Binairo
 * screen would read as part of Binairo, not as a difficulty), and
 * `danger` is reserved across this whole app for failure and hazards -
 * a hard puzzle is not a mistake. So easy and medium sit in the quiet ink
 * greys and only hard/expert spends `accent`, the same ochre the stars
 * use, which is the one colour in this palette that already means
 * "this one counts".
 */
export function DifficultyChip({ difficulty, expert = false, challenge = false, style }: DifficultyChipProps): React.JSX.Element {
  const label = challenge ? 'CHALLENGE' : expert ? 'EXPERT' : difficulty.toUpperCase();
  const loud = challenge || expert || difficulty === 'hard';

  return (
    <View style={[styles.chip, loud ? styles.chipLoud : styles.chipQuiet, style]}>
      <Text style={[styles.label, loud ? styles.labelLoud : difficulty === 'easy' ? styles.labelEasy : styles.labelMedium]}>
        {label}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
  },
  chipQuiet: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipLoud: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(183, 137, 47, 0.12)',
  },
  label: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
  },
  labelEasy: { color: theme.colors.textTertiary },
  labelMedium: { color: theme.colors.textSecondary },
  labelLoud: {
    color: theme.colors.accent,
    fontWeight: theme.typography.weights.bold,
  },
}));

import React, { useContext, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Text } from './Text';
import { useCurrentBatch } from '../progression/PlayerProgressProvider';
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
  /** The hardest challenge (level 15 on): says EXTREME. */
  readonly extreme?: boolean;
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
/**
 * The puzzle open on screen, set by the app around a game screen. Home
 * labels a puzzle with how its set dealt it (a hard board can be dealt as
 * the set's extreme challenge); with this the game's own chip says the
 * same, instead of only the board's tier.
 */
export const PlayingPuzzle = React.createContext<string | null>(null);

export function DifficultyChip({ difficulty, expert = false, challenge: challengeProp = false, extreme: extremeProp = false, style }: DifficultyChipProps): React.JSX.Element {
  const playing = useContext(PlayingPuzzle);
  const batch = useCurrentBatch();
  const dealt = playing ? batch?.puzzles.find(p => p.puzzleId === playing) : undefined;
  // Remembered: solving a set's last puzzle deals the next set at once,
  // and the chip must not drop from Extreme to Hard under the finish.
  const flags = useRef<{ id: string | null; challenge: boolean; extreme: boolean }>({ id: null, challenge: false, extreme: false });
  if (dealt) flags.current = { id: playing, challenge: !!dealt.challenge, extreme: !!dealt.extreme };
  const known = flags.current.id === playing && playing !== null;
  const challenge = challengeProp || (known && flags.current.challenge);
  const extreme = extremeProp || (known && flags.current.extreme);
  const label = extreme ? 'Extreme' : challenge ? 'Challenge' : expert ? 'Expert' : difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const loud = extreme || challenge || expert || difficulty === 'hard';

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
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
  },
  labelEasy: { color: theme.colors.textTertiary },
  labelMedium: { color: theme.colors.textSecondary },
  labelLoud: {
    color: theme.colors.accentText,
    fontWeight: theme.typography.weights.bold,
  },
}));

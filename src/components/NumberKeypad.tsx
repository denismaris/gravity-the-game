import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { theme } from '../theme';

export interface NumberKeypadProps {
  /** The digits offered, in order (Sudoku: 1..9; Skyscrapers: 1..N). */
  digits: ReadonlyArray<number>;
  /** How many of each digit are already placed on the board, keyed by the
   * digit itself. A digit dims once its count reaches `digits.length` -
   * true for any Latin-square-shaped puzzle (Sudoku included), where every
   * digit must appear exactly once per row/column (Sudoku adds "per box"
   * on top, but the completion target is the same either way). */
  counts: Readonly<Record<number, number>>;
  /** No cell selected yet - every key is inert until one is. */
  disabled: boolean;
  onPressDigit: (value: number) => void;
  onErase: () => void;
}

/**
 * The digit entry row beneath a Latin-square board, plus an eraser. A digit
 * dims once every copy of it is already on the board - a standard courtesy
 * that turns "did I already place all my 7s?" into a glance instead of a
 * recount. Dimmed digits still work (one too many is still just a wrong
 * entry, visible the moment it's placed via the board's own conflict
 * highlight) - this is a hint, never a hard block. Shared by Sudoku and
 * Skyscrapers, the two games where tapping a cell then a number is how you
 * play, rather than tapping a cell to cycle it directly.
 */
export function NumberKeypad({ digits, counts, disabled, onPressDigit, onErase }: NumberKeypadProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {digits.map(digit => {
        const complete = (counts[digit] ?? 0) >= digits.length;
        return (
          <PressableScale
            key={digit}
            accessibilityRole="button"
            accessibilityLabel={`Enter ${digit}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onPressDigit(digit)}
            scaleTo={0.9}
            style={[styles.key, disabled && styles.keyDisabled]}
          >
            <Text style={[styles.keyLabel, complete && styles.keyLabelComplete]}>{digit}</Text>
          </PressableScale>
        );
      })}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Erase"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onErase}
        scaleTo={0.9}
        style={[styles.key, styles.eraseKey, disabled && styles.keyDisabled]}
      >
        <Text style={styles.eraseLabel}>{'⌫'}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  key: {
    width: 30,
    height: 42,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyLabel: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  keyLabelComplete: {
    color: theme.colors.textDisabled,
  },
  eraseKey: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  eraseLabel: {
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textSecondary,
  },
});

/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { BOX_SIZE, computeConflicts, isGiven, SIZE, SudokuPuzzle, SudokuState } from '../game/sudoku';
import { motion, theme } from '../theme';

export interface SudokuBoardProps {
  puzzle: SudokuPuzzle;
  state: SudokuState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  selected: { row: number; col: number } | null;
  onSelectCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: { row: number; col: number } | null;
}

/**
 * A classic 9x9 Sudoku grid drawn with plain views: thin hairlines between
 * cells, a heavier rule every three cells for the 3x3 boxes. Selecting a
 * cell softly highlights its row, column and box (the standard "what am I
 * allowed to look at" assist every Sudoku app offers) and every other cell
 * sharing its value, plus flags anything currently breaking the one-of-each
 * rule - no separate "check" step, wrong is visible the moment it happens.
 */
export function SudokuBoard({
  puzzle,
  state,
  size,
  selected,
  onSelectCell,
  flashCell,
}: SudokuBoardProps): React.JSX.Element {
  const cell = Math.floor(size / SIZE);
  const boardSize = cell * SIZE;

  const conflicts = useMemo(() => computeConflicts(state), [state]);
  const selectedValue = selected ? state.values[selected.row][selected.col] : 0;

  return (
    <View
      style={{
        width: boardSize,
        height: boardSize,
        backgroundColor: theme.colors.surfaceHi,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.colors.borderStrong,
        overflow: 'hidden',
      }}
    >
      {state.values.map((line, r) => (
        <View key={`row-${r}`} style={{ flexDirection: 'row' }}>
          {line.map((value, c) => {
            const given = isGiven(puzzle, r, c);
            const isSelected = selected?.row === r && selected?.col === c;
            const inSelectedLine =
              !!selected && (selected.row === r || selected.col === c || sameBox(selected, { row: r, col: c }));
            const matchesSelectedValue = selectedValue !== 0 && value === selectedValue && !isSelected;
            const hasConflict = conflicts.has(`${r}:${c}`);
            const flash = flashCell && flashCell.row === r && flashCell.col === c;

            return (
              <Pressable
                key={`cell-${r}-${c}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ', blank'}`}
                onPress={() => onSelectCell(r, c)}
                style={{
                  width: cell,
                  height: cell,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: flash
                    ? theme.colors.accent
                    : isSelected
                    ? theme.colors.surfaceAlt
                    : hasConflict
                    ? 'rgba(140, 35, 24, 0.10)'
                    : matchesSelectedValue
                    ? 'rgba(183, 137, 47, 0.14)'
                    : inSelectedLine
                    ? theme.colors.background
                    : theme.colors.surfaceHi,
                  borderRightWidth: (c + 1) % BOX_SIZE === 0 && c !== SIZE - 1 ? 2 : StyleSheet.hairlineWidth,
                  borderBottomWidth: (r + 1) % BOX_SIZE === 0 && r !== SIZE - 1 ? 2 : StyleSheet.hairlineWidth,
                  borderRightColor: (c + 1) % BOX_SIZE === 0 ? theme.colors.borderStrong : theme.colors.border,
                  borderBottomColor: (r + 1) % BOX_SIZE === 0 ? theme.colors.borderStrong : theme.colors.border,
                }}
              >
                {value !== 0 && (
                  <AnimatedDigit
                    value={value}
                    style={{
                      fontFamily: theme.typography.families.display,
                      fontSize: cell * 0.52,
                      fontWeight: given ? theme.typography.weights.bold : theme.typography.weights.medium,
                      color: hasConflict
                        ? theme.colors.danger
                        : given
                        ? theme.colors.textPrimary
                        : theme.colors.sudokuAccent,
                    }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function sameBox(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return (
    Math.floor(a.row / BOX_SIZE) === Math.floor(b.row / BOX_SIZE) &&
    Math.floor(a.col / BOX_SIZE) === Math.floor(b.col / BOX_SIZE)
  );
}

/**
 * A cell's digit, popping in with a spring whenever `value` changes to a new
 * non-zero digit (a player entering or correcting a cell) - never on mount,
 * so a given or a restored value never pops, only something the player just
 * did. Erasing (value -> 0) is a plain instant disappearance; entering is
 * the action worth calling out.
 */
function AnimatedDigit({ value, style }: { value: number; style: TextStyle }): React.JSX.Element | null {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current !== value && value !== 0) {
      scale.setValue(0.5);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = value;
  }, [value, scale]);

  if (value === 0) return null;
  return <Animated.Text style={[style, { transform: [{ scale }] }]}>{value}</Animated.Text>;
}

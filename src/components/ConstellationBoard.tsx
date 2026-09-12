/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cluesEqual, ConstellationPuzzle, ConstellationState, runsOf } from '../game/constellation';
import { theme } from '../theme';

export interface ConstellationBoardProps {
  puzzle: ConstellationPuzzle;
  state: ConstellationState;
  /** Pixel width available for the whole board (grid + clue gutters). */
  size: number;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (e.g. a hint reveal). */
  flashCell?: { row: number; col: number } | null;
}

/**
 * A nonogram board drawn with plain views: a clue gutter on the top and
 * left, then the grid. Tapping a cell cycles blank -> filled -> marked.
 * A clue dims once the player's line matches it.
 */
export function ConstellationBoard({
  puzzle,
  state,
  size,
  onToggleCell,
  flashCell,
}: ConstellationBoardProps): React.JSX.Element {
  const { cols, rowClues, colClues } = puzzle;

  const layout = useMemo(() => {
    const maxRowClue = Math.max(1, ...rowClues.map(c => c.length));
    const maxColClue = Math.max(1, ...colClues.map(c => c.length));
    const clueUnit = Math.max(14, Math.round(size / (cols + maxRowClue) / 1.6));
    const rowGutter = maxRowClue * clueUnit;
    const colGutter = maxColClue * clueUnit;
    const cell = Math.floor((size - rowGutter) / cols);
    return { clueUnit, rowGutter, colGutter, cell };
  }, [size, cols, rowClues, colClues]);

  const rowFilled = (r: number): number[] =>
    runsOf(state.marks[r].map(m => m === 'filled'));
  const colFilled = (c: number): number[] =>
    runsOf(state.marks.map(row => row[c] === 'filled'));

  return (
    <View style={{ width: layout.rowGutter + cols * layout.cell }}>
      {/* column clues */}
      <View style={{ flexDirection: 'row', height: layout.colGutter }}>
        <View style={{ width: layout.rowGutter }} />
        {colClues.map((clue, c) => {
          const done = cluesEqual(colFilled(c), colClues[c]);
          return (
            <View key={`cc-${c}`} style={[styles.colClue, { width: layout.cell }]}>
              {(clue.length ? clue : [0]).map((n, i) => (
                <Text
                  key={i}
                  style={[
                    styles.clueText,
                    { fontSize: layout.clueUnit * 0.62 },
                    done && styles.clueDone,
                  ]}
                >
                  {n}
                </Text>
              ))}
            </View>
          );
        })}
      </View>

      {/* grid rows */}
      {state.marks.map((line, r) => {
        const rDone = cluesEqual(rowFilled(r), rowClues[r]);
        return (
          <View key={`row-${r}`} style={{ flexDirection: 'row' }}>
            <View style={[styles.rowClue, { width: layout.rowGutter, height: layout.cell }]}>
              {(rowClues[r].length ? rowClues[r] : [0]).map((n, i) => (
                <Text
                  key={i}
                  style={[
                    styles.clueText,
                    { fontSize: layout.clueUnit * 0.62, marginHorizontal: 2 },
                    rDone && styles.clueDone,
                  ]}
                >
                  {n}
                </Text>
              ))}
            </View>
            {line.map((mark, c) => {
              const flash = flashCell && flashCell.row === r && flashCell.col === c;
              return (
                <Pressable
                  key={`cell-${r}-${c}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Cell ${r + 1}, ${c + 1}, ${mark}`}
                  onPress={() => onToggleCell(r, c)}
                  style={[
                    styles.cell,
                    { width: layout.cell, height: layout.cell },
                    mark === 'filled' && styles.cellFilled,
                    flash && styles.cellFlash,
                  ]}
                >
                  {mark === 'marked' && (
                    <Text style={[styles.mark, { fontSize: layout.cell * 0.5 }]}>×</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  colClue: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  rowClue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 6,
  },
  clueText: {
    fontFamily: theme.typography.families.mono,
    color: theme.colors.textSecondary,
    lineHeight: undefined,
  },
  clueDone: {
    color: theme.colors.textDisabled,
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellFilled: {
    backgroundColor: theme.colors.primary,
  },
  cellFlash: {
    backgroundColor: theme.colors.accent,
  },
  mark: {
    color: theme.colors.textTertiary,
    fontFamily: theme.typography.families.ui,
  },
});

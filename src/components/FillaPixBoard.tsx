/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { clueStatus, clueValue, FillaPixCell, FillaPixPuzzle, FillaPixState } from '../game/fillapix';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { theme } from '../theme';
import { FillaPixBoardView } from './FillaPixBoardView';

export interface FillaPixBoardProps {
  puzzle: FillaPixPuzzle;
  state: FillaPixState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: FillaPixCell | null;
  /** Squares that opened already filled, drawn locked. */
  givens?: ReadonlyArray<ReadonlyArray<boolean>>;
}

/**
 * Composes the Skia-drawn board (`FillaPixBoardView`) with an
 * absolutely-positioned overlay of one `Pressable` per cell - the same
 * split `BinairoBoard` already proved, needed here because there is no
 * Skia font anywhere in this app, so a clue's digit has to be plain RN
 * `<Text>` layered above the canvas rather than drawn inside it. Every
 * cell gets a `Pressable` (unlike Binairo, nothing here is a printed
 * given) - a tap always toggles that cell's fill, full stop; the clue
 * digit some cells also carry is non-interactive text drawn on top,
 * never a second gesture competing with the toggle.
 */
export function FillaPixBoard({ puzzle, state, size, solved, onToggleCell, flashCell, givens }: FillaPixBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);

  const clueByCell = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of puzzle.clues) map.set(`${cell.row}:${cell.col}`, clueValue(puzzle, cell.row, cell.col));
    return map;
  }, [puzzle]);

  return (
    <View
      style={{
        width: layout.boardSize,
        height: layout.boardSize,
        // Same "board is a physical slab resting above the page" shadow
        // every other board casts, offset toward the same upper-left
        // light source.
        shadowColor: theme.colors.shadow,
        shadowOpacity: 0.14,
        shadowRadius: 9,
        shadowOffset: { width: 2, height: 4 },
        elevation: 4,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <FillaPixBoardView puzzle={puzzle} state={state} size={size} solved={solved} flashCell={flashCell} givens={givens} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {Array.from({ length: puzzle.size }).map((_, row) =>
          Array.from({ length: puzzle.size }).map((__, col) => {
            const origin = getCellOrigin(layout, row, col);
            const filled = state.filled[row][col];
            return (
              <Pressable
                key={`tap-${row}-${col}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1}, column ${col + 1}, ${filled ? 'filled' : 'empty'}`}
                onPress={() => onToggleCell(row, col)}
                style={{
                  position: 'absolute',
                  left: origin.x,
                  top: origin.y,
                  width: layout.cellSize,
                  height: layout.cellSize,
                }}
              />
            );
          }),
        )}
      </View>

      {/* Clue digits - non-interactive RN text over the canvas, coloured
          live per `clueStatus` so "why is this cell right or wrong" is
          always visible at a glance rather than behind a second gesture. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {puzzle.clues.map(cell => {
          const origin = getCellOrigin(layout, cell.row, cell.col);
          const status = clueStatus(puzzle, state, cell.row, cell.col);
          return (
            <View
              key={`clue-${cell.row}-${cell.col}`}
              style={{
                position: 'absolute',
                left: origin.x,
                top: origin.y,
                width: layout.cellSize,
                height: layout.cellSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.typography.families.mono,
                  fontSize: layout.cellSize * 0.36,
                  fontWeight: theme.typography.weights.bold,
                  color: status === 'satisfied' ? theme.colors.success : theme.colors.danger,
                }}
              >
                {clueByCell.get(`${cell.row}:${cell.col}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

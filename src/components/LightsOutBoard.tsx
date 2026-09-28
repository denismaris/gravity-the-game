/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { LightsOutCell, LightsOutPuzzle, LightsOutState } from '../game/lightsout';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { LightsOutBoardView } from './LightsOutBoardView';

export interface LightsOutBoardProps {
  puzzle: LightsOutPuzzle;
  state: LightsOutState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  onPressCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: LightsOutCell | null;
}

/**
 * Composes the Skia-drawn board with an absolutely-positioned overlay of
 * one `Pressable` per cell - the same split `BinairoBoard` and
 * `FillaPixBoard` already use. Every cell is pressable, including one
 * whose own light is already off: pressing it still flips its
 * neighbours, which is the entire puzzle.
 */
export function LightsOutBoard({ puzzle, state, size, solved, onPressCell, flashCell }: LightsOutBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);

  return (
    <View
      style={{
        width: layout.boardSize,
        height: layout.boardSize,
        // The one shadow this board casts against the page, offset toward
        // the same upper-left light every other board here shades from.
        shadowColor: '#1C2038',
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 2, height: 5 },
        elevation: 5,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <LightsOutBoardView puzzle={puzzle} state={state} size={size} solved={solved} flashCell={flashCell} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {Array.from({ length: puzzle.size }).map((_, row) =>
          Array.from({ length: puzzle.size }).map((__, col) => {
            const origin = getCellOrigin(layout, row, col);
            return (
              <Pressable
                key={`tap-${row}-${col}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1}, column ${col + 1}, ${state.lights[row][col] ? 'lit' : 'off'}`}
                accessibilityHint="Toggles this light and the four beside it"
                onPress={() => onPressCell(row, col)}
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
    </View>
  );
}

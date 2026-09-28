/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { BloomCell, BloomPuzzle, BloomState, isRotatable } from '../game/bloom';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { BloomBoardView } from './BloomBoardView';

export interface BloomBoardProps {
  puzzle: BloomPuzzle;
  state: BloomState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  onTurn: (row: number, col: number) => void;
  flashCell?: BloomCell | null;
}

/**
 * The Skia board with one invisible `Pressable` per turnable tile laid
 * over it - the same split every tap-to-play board here uses.
 *
 * Turns on touch-down (`onPressIn`), not on release: a quarter turn is the
 * whole game and players tap in quick runs, so waiting for the finger to
 * lift made every turn feel a beat late - the same lesson Adjacent's
 * board taught ("laggy" was input latency, not frame rate).
 */
export function BloomBoard({ puzzle, state, size, solved, onTurn, flashCell }: BloomBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.rows, size), [puzzle.rows, size]);

  return (
    <View style={{ width: layout.boardSize, height: layout.boardSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <BloomBoardView puzzle={puzzle} state={state} size={size} solved={solved} flashCell={flashCell} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents={solved ? 'none' : 'box-none'}>
        {Array.from({ length: puzzle.rows }).map((_, row) =>
          Array.from({ length: puzzle.cols }).map((__, col) => {
            if (!isRotatable(puzzle, row, col)) return null;
            const origin = getCellOrigin(layout, row, col);
            return (
              <Pressable
                key={`tap-${row}-${col}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1}, column ${col + 1}, arc facing ${['north-east', 'south-east', 'south-west', 'north-west'][state.rotations[row][col] % 4]}`}
                accessibilityHint="Turns this tile a quarter clockwise"
                onPressIn={() => onTurn(row, col)}
                style={{ position: 'absolute', left: origin.x, top: origin.y, width: layout.cellSize, height: layout.cellSize }}
              />
            );
          }),
        )}
      </View>
    </View>
  );
}

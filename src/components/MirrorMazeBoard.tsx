/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { isEligible, MirrorKind, MirrorMazeCell, MirrorMazePuzzle, MirrorMazeState } from '../game/mirror';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { MirrorMazeBoardView } from './MirrorMazeBoardView';

export interface MirrorMazeBoardProps {
  puzzle: MirrorMazePuzzle;
  state: MirrorMazeState;
  /** Pixel width (and height - always square) available for the board. */
  size: number;
  /** The beam's current traced path (see `MirrorMazeBoardView`). */
  path: ReadonlyArray<MirrorMazeCell>;
  /** How far the solve ignition has swept along `path`, 0..1 (see
   * `useAnimatedBeamReveal`). */
  revealProgress: number;
  solved: boolean;
  onCycleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: MirrorMazeCell | null;
}

function mirrorLabel(mirror: MirrorKind | null): string {
  if (mirror === 'fwd') return 'forward mirror';
  if (mirror === 'back') return 'back mirror';
  return 'empty';
}

/**
 * Composes the Skia-drawn board (`MirrorMazeBoardView`) with an
 * absolutely-positioned overlay of one `Pressable` per eligible cell on top
 * of the `<Canvas>`, so tapping a cell cycles its mirror. The overlay is
 * positioned with the exact same `computeBoardLayout`/`getCellOrigin` math
 * the Skia layer itself uses, which is what keeps the two pixel-aligned -
 * there is no other precedent in this app for per-cell touch input on a
 * Skia canvas (Gravity's board takes input as a single whole-board swipe).
 * Source, target and obstacle cells never take mirrors, so they get no
 * `Pressable` at all.
 */
export function MirrorMazeBoard({
  puzzle,
  state,
  size,
  path,
  revealProgress,
  solved,
  onCycleCell,
  flashCell,
}: MirrorMazeBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.rows, size), [puzzle.rows, size]);

  const eligibleCells = useMemo(() => {
    const cells: MirrorMazeCell[] = [];
    for (let row = 0; row < puzzle.rows; row += 1) {
      for (let col = 0; col < puzzle.cols; col += 1) {
        if (isEligible(puzzle, row, col)) cells.push({ row, col });
      }
    }
    return cells;
  }, [puzzle]);

  return (
    <View style={{ width: layout.boardSize, height: layout.boardSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <MirrorMazeBoardView
          puzzle={puzzle}
          state={state}
          size={size}
          path={path}
          revealProgress={revealProgress}
          solved={solved}
          flashCell={flashCell}
        />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {eligibleCells.map(({ row, col }) => {
          const origin = getCellOrigin(layout, row, col);
          return (
            <Pressable
              key={`tap-${row}-${col}`}
              accessibilityRole="button"
              accessibilityLabel={`Cell ${row + 1}, ${col + 1}, ${mirrorLabel(state.mirrors[row][col])}`}
              onPress={() => onCycleCell(row, col)}
              style={{
                position: 'absolute',
                left: origin.x,
                top: origin.y,
                width: layout.cellSize,
                height: layout.cellSize,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

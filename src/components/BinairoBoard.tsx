/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { BinairoCell, BinairoPuzzle, BinairoState, constraintPartner, isConstraintViolated, isGiven } from '../game/binairo';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { BinairoBoardView } from './BinairoBoardView';

export interface BinairoBoardProps {
  puzzle: BinairoPuzzle;
  state: BinairoState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: BinairoCell | null;
}

function valueLabel(value: BinairoState['values'][number][number]): string {
  if (value === 1) return 'circle';
  if (value === 0) return 'square';
  return 'blank';
}

/** Describes any constraint tile(s) touching `(row, col)`, phrased from
 * that cell's own point of view (the anchor's "right" reads as "left"
 * from the partner's side) - a sighted player reads the badge itself, so
 * this is the same information relayed for a screen reader. */
function constraintDescriptions(puzzle: BinairoPuzzle, state: BinairoState, row: number, col: number): string[] {
  const descriptions: string[] = [];
  for (const constraint of puzzle.constraints ?? []) {
    const partner = constraintPartner(constraint);
    const isAnchor = constraint.row === row && constraint.col === col;
    const isPartner = partner.row === row && partner.col === col;
    if (!isAnchor && !isPartner) continue;
    const relative = constraint.direction === 'right' ? (isAnchor ? 'right' : 'left') : isAnchor ? 'below' : 'above';
    const verb = constraint.kind === 'same' ? 'must match the cell' : 'must differ from the cell';
    const violated = isConstraintViolated(state, constraint) ? ', currently violated' : '';
    descriptions.push(`${verb} ${relative}${violated}`);
  }
  return descriptions;
}

/**
 * Composes the Skia-drawn board (`BinairoBoardView`) with an
 * absolutely-positioned overlay of one `Pressable` per non-given cell on
 * top of the `<Canvas>` - the same split Mirror Maze's board already
 * proved (`MirrorMazeBoard`), needed here because the two fillable
 * symbols are real path geometry a plain `View` can't draw. Given cells
 * get no `Pressable` at all, matching the old board's `disabled={given}`.
 */
export function BinairoBoard({ puzzle, state, size, solved, onToggleCell, flashCell }: BinairoBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);

  const editableCells = useMemo(() => {
    const cells: BinairoCell[] = [];
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (!isGiven(puzzle, row, col)) cells.push({ row, col });
      }
    }
    return cells;
  }, [puzzle]);

  return (
    <View style={{ width: layout.boardSize, height: layout.boardSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <BinairoBoardView puzzle={puzzle} state={state} size={size} solved={solved} flashCell={flashCell} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {editableCells.map(({ row, col }) => {
          const origin = getCellOrigin(layout, row, col);
          const constraints = constraintDescriptions(puzzle, state, row, col);
          const label = [`Row ${row + 1}, column ${col + 1}, ${valueLabel(state.values[row][col])}`, ...constraints].join(', ');
          return (
            <Pressable
              key={`tap-${row}-${col}`}
              accessibilityRole="button"
              accessibilityLabel={label}
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
        })}
      </View>
    </View>
  );
}

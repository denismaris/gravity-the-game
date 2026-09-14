/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { colTentCount, isTreeCell, rowTentCount, TentsTreesCell, TentsTreesPuzzle, TentsTreesState } from '../game/tents';
import { motion, theme } from '../theme';
import { TentsBoardView } from './TentsBoardView';

export interface TentsBoardProps {
  puzzle: TentsTreesPuzzle;
  state: TentsTreesState;
  /** Pixel width available for the whole board (grid + clue gutter). */
  size: number;
  solved: boolean;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (e.g. a hint reveal). */
  flashCell?: TentsTreesCell | null;
}

function markLabel(mark: TentsTreesState['marks'][number][number]): string {
  return mark;
}

/**
 * A row/column clue: crossfades `textSecondary -> success` over 180ms
 * (`Easing.out(quad)`) the instant its count is satisfied, plus a
 * checkmark that pops in (`spring.pop`) - fixing the earlier version's
 * "dimming reads as disabled" bug by using colour-plus-a-real-glyph
 * instead of just fading the number out.
 */
function AnimatedClue({ count, done, fontSize }: { count: number; done: boolean; fontSize: number }): React.JSX.Element {
  const progress = useRef(new Animated.Value(done ? 1 : 0)).current;
  const checkScale = useRef(new Animated.Value(done ? 1 : 0)).current;
  const previous = useRef(done);

  useEffect(() => {
    if (done !== previous.current) {
      Animated.timing(progress, { toValue: done ? 1 : 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      checkScale.setValue(0);
      if (done) Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = done;
  }, [done, progress, checkScale]);

  const color = progress.interpolate({ inputRange: [0, 1], outputRange: [theme.colors.textSecondary, theme.colors.success] });

  return (
    <View style={styles.clueRow}>
      <Animated.Text style={[styles.clueText, { fontSize, color }]}>{count}</Animated.Text>
      {done && (
        <Animated.Text style={[styles.checkmark, { fontSize: fontSize * 0.8, transform: [{ scale: checkScale }] }]}>✓</Animated.Text>
      )}
    </View>
  );
}

/**
 * Composes the Skia-drawn grid (`TentsBoardView`) with a plain-RN clue
 * gutter on the top and left, plus an absolutely-positioned overlay of one
 * `Pressable` per non-tree cell - the same Canvas-plus-overlay split
 * Mirror Maze's board proved, needed here because the illustrated tree/
 * tent icons and the lantern glow are real path/circle geometry a plain
 * `View` can't draw. The row/column clue numbers stay in RN text (they're
 * just numbers, with their own crossfade+checkmark handled in the screen).
 */
export function TentsBoard({ puzzle, state, size, solved, onToggleCell, flashCell }: TentsBoardProps): React.JSX.Element {
  const { rows, cols, rowCounts, colCounts } = puzzle;

  const layout = useMemo(() => {
    const clueUnit = Math.max(22, Math.round(size / (cols + 1) / 1.3));
    const cell = Math.floor((size - clueUnit) / cols);
    return { clueUnit, cell };
  }, [size, cols]);

  const editableCells = useMemo(() => {
    const cells: TentsTreesCell[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (!isTreeCell(puzzle, r, c)) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }, [puzzle, rows, cols]);

  return (
    <View style={{ width: layout.clueUnit + cols * layout.cell }}>
      <View style={{ flexDirection: 'row', height: layout.clueUnit }}>
        <View style={{ width: layout.clueUnit }} />
        {colCounts.map((count, c) => (
          <View key={`cc-${c}`} style={[styles.colClue, { width: layout.cell }]}>
            <AnimatedClue count={count} done={colTentCount(state, c) === count} fontSize={layout.clueUnit * 0.55} />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: layout.clueUnit }}>
          {rowCounts.map((count, r) => (
            <View key={`rc-${r}`} style={[styles.rowClue, { height: layout.cell }]}>
              <AnimatedClue count={count} done={rowTentCount(state, r) === count} fontSize={layout.clueUnit * 0.55} />
            </View>
          ))}
        </View>

        <View style={{ width: cols * layout.cell, height: rows * layout.cell }}>
          <Canvas style={StyleSheet.absoluteFill}>
            <TentsBoardView puzzle={puzzle} state={state} cellSize={layout.cell} solved={solved} flashCell={flashCell} />
          </Canvas>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {editableCells.map(({ row, col }) => (
              <Pressable
                key={`tap-${row}-${col}`}
                accessibilityRole="button"
                accessibilityLabel={`Row ${row + 1}, column ${col + 1}, ${markLabel(state.marks[row][col])}`}
                onPress={() => onToggleCell(row, col)}
                style={{
                  position: 'absolute',
                  left: col * layout.cell,
                  top: row * layout.cell,
                  width: layout.cell,
                  height: layout.cell,
                }}
              />
            ))}
          </View>
        </View>
      </View>
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
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clueText: {
    fontFamily: theme.typography.families.mono,
  },
  checkmark: {
    marginLeft: 3,
    color: theme.colors.success,
    fontWeight: theme.typography.weights.bold,
  },
});

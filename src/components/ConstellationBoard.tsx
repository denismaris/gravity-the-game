/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { cluesEqual, ConstellationPuzzle, ConstellationState, runsOf } from '../game/constellation';
import { theme } from '../theme';
import { AnimatedMark } from './AnimatedMark';

export interface ConstellationBoardProps {
  puzzle: ConstellationPuzzle;
  state: ConstellationState;
  /** Pixel width available for the whole board (grid + clue gutters). */
  size: number;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (e.g. a hint reveal). */
  flashCell?: { row: number; col: number } | null;
  /** True once the picture is fully and correctly filled - draws a thin
   * gold line tracing every filled cell's connections to its filled
   * neighbours over the top, so the finished grid reads as an actual star
   * chart for a moment instead of just a block of ink. Fades in once, the
   * moment this flips true. */
  solved?: boolean;
}

/** One segment of the reveal line-art: the shared edge between two
 * orthogonally-adjacent filled cells. */
interface Segment {
  readonly r1: number;
  readonly c1: number;
  readonly r2: number;
  readonly c2: number;
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
  solved = false,
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

  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!solved) {
      reveal.setValue(0);
      return;
    }
    Animated.timing(reveal, {
      toValue: 1,
      duration: 520,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [solved, reveal]);

  // The picture's own connectivity graph - every filled cell linked to its
  // filled right/down neighbour. Computed only once solved; this is what
  // makes the finished grid read as a drawn constellation rather than a
  // block of filled squares.
  const segments = useMemo<Segment[]>(() => {
    if (!solved) return [];
    const marks = state.marks;
    const segs: Segment[] = [];
    for (let r = 0; r < marks.length; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (marks[r][c] !== 'filled') continue;
        if (c + 1 < cols && marks[r][c + 1] === 'filled') segs.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        if (r + 1 < marks.length && marks[r + 1][c] === 'filled') {
          segs.push({ r1: r, c1: c, r2: r + 1, c2: c });
        }
      }
    }
    return segs;
  }, [solved, state.marks, cols]);

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
                  {mark === 'marked' && <AnimatedMark size={layout.cell * 0.5} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}

      {/* solved reveal - a thin gold line over every filled-to-filled edge,
          fading in once, echoing an actual star chart. */}
      {segments.length > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal }]} pointerEvents="none">
          {segments.map((s, i) => {
            const thickness = Math.max(2, layout.cell * 0.09);
            const x1 = layout.rowGutter + s.c1 * layout.cell + layout.cell / 2;
            const y1 = layout.colGutter + s.r1 * layout.cell + layout.cell / 2;
            const x2 = layout.rowGutter + s.c2 * layout.cell + layout.cell / 2;
            const y2 = layout.colGutter + s.r2 * layout.cell + layout.cell / 2;
            const horizontal = s.r1 === s.r2;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: Math.min(x1, x2) - (horizontal ? 0 : thickness / 2),
                  top: Math.min(y1, y2) - (horizontal ? thickness / 2 : 0),
                  width: horizontal ? Math.abs(x2 - x1) : thickness,
                  height: horizontal ? thickness : Math.abs(y2 - y1),
                  borderRadius: thickness / 2,
                  backgroundColor: theme.colors.accent,
                }}
              />
            );
          })}
        </Animated.View>
      )}
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
});

/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  colTentCount,
  isTreeCell,
  rowTentCount,
  TentsTreesCell,
  TentsTreesPuzzle,
  TentsTreesState,
} from '../game/tents';
import { theme } from '../theme';
import { AnimatedMark } from './AnimatedMark';

export interface TentsBoardProps {
  puzzle: TentsTreesPuzzle;
  state: TentsTreesState;
  /** Pixel width available for the whole board (grid + clue gutters). */
  size: number;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (e.g. a hint reveal). */
  flashCell?: TentsTreesCell | null;
}

/** A solid triangle - the shared shape behind both a tree's canopy and a
 * tent's silhouette, using the classic CSS zero-size-box-with-one-coloured-
 * border trick already proven in this codebase (`GameMark`'s glyphs). */
function Triangle({ width, height, color }: { width: number; height: number; color: string }): React.JSX.Element {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
}

/** A tree: a triangular canopy over a trunk - given, fixed content, so it
 * always draws in ink. */
function TreeGlyph({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <View style={styles.glyphBox}>
      <Triangle width={size * 0.7} height={size * 0.55} color={color} />
      <View style={{ width: Math.max(2, size * 0.14), height: size * 0.22, backgroundColor: color }} />
    </View>
  );
}

/** A tent: the same canopy triangle, with no trunk (nothing is planted) -
 * the player's own placement, so it draws in `tentsAccent`. */
function TentGlyph({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <View style={styles.glyphBox}>
      <Triangle width={size * 0.7} height={size * 0.55} color={color} />
    </View>
  );
}

/**
 * A Tents and Trees board drawn with plain views: a count gutter on the top
 * and left, then the grid. Tapping a non-tree cell cycles empty -> tent ->
 * marked -> empty, exactly Constellation's tap-cycle idiom. A row/column's
 * count dims once the player's placement already matches it - the same
 * "you're done here" cue Constellation's own clues give.
 */
export function TentsBoard({ puzzle, state, size, onToggleCell, flashCell }: TentsBoardProps): React.JSX.Element {
  const { rows, cols, rowCounts, colCounts } = puzzle;

  const layout = useMemo(() => {
    const clueUnit = Math.max(22, Math.round(size / (cols + 1) / 1.3));
    const cell = Math.floor((size - clueUnit) / cols);
    return { clueUnit, cell };
  }, [size, cols]);

  return (
    <View style={{ width: layout.clueUnit + cols * layout.cell }}>
      {/* column count headers */}
      <View style={{ flexDirection: 'row', height: layout.clueUnit }}>
        <View style={{ width: layout.clueUnit }} />
        {colCounts.map((count, c) => {
          const done = colTentCount(state, c) === count;
          return (
            <View key={`cc-${c}`} style={[styles.colClue, { width: layout.cell }]}>
              <Text style={[styles.clueText, { fontSize: layout.clueUnit * 0.55 }, done && styles.clueDone]}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>

      {/* grid rows */}
      {Array.from({ length: rows }, (_unused, r) => {
        const rowDone = rowTentCount(state, r) === rowCounts[r];
        return (
          <View key={`row-${r}`} style={{ flexDirection: 'row' }}>
            <View style={[styles.rowClue, { width: layout.clueUnit, height: layout.cell }]}>
              <Text style={[styles.clueText, { fontSize: layout.clueUnit * 0.55 }, rowDone && styles.clueDone]}>
                {rowCounts[r]}
              </Text>
            </View>
            {Array.from({ length: cols }, (_unused2, c) => {
              const isTree = isTreeCell(puzzle, r, c);
              const mark = state.marks[r][c];
              const flash = flashCell && flashCell.row === r && flashCell.col === c;
              return (
                <Pressable
                  key={`cell-${r}-${c}`}
                  disabled={isTree}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isTree ? `Tree at row ${r + 1}, column ${c + 1}` : `Row ${r + 1}, column ${c + 1}, ${mark}`
                  }
                  onPress={() => onToggleCell(r, c)}
                  style={[styles.cell, { width: layout.cell, height: layout.cell }, flash && styles.cellFlash]}
                >
                  {isTree && <TreeGlyph size={layout.cell * 0.72} color={theme.colors.primary} />}
                  {!isTree && mark === 'tent' && <TentGlyph size={layout.cell * 0.72} color={theme.colors.tentsAccent} />}
                  {!isTree && mark === 'marked' && <AnimatedMark size={layout.cell * 0.5} />}
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
  cellFlash: {
    backgroundColor: theme.colors.accent,
  },
  glyphBox: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

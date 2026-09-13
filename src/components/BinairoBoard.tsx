/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BinairoCell, BinairoPuzzle, BinairoState, isGiven } from '../game/binairo';
import { computeBoardLayout } from '../game/rendering';
import { theme } from '../theme';

export interface BinairoBoardProps {
  puzzle: BinairoPuzzle;
  state: BinairoState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: BinairoCell | null;
}

/** A filled dot (1) - reuses Gravity's own filled-circle-vs-hollow-ring
 * grammar (`MovablePiece`/`TargetMarker`) rather than inventing new icons,
 * and sidesteps this app's confirmed iOS gotcha where a literal sun/moon
 * glyph renders as a full-colour emoji regardless of surrounding text
 * colour. */
function Dot({ size, color }: { size: number; color: string }): React.JSX.Element {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** A hollow ring (0). */
function Ring({ size, color }: { size: number; color: string }): React.JSX.Element {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(2, size * 0.16),
        borderColor: color,
      }}
    />
  );
}

/**
 * A Binairo grid drawn with plain views - the simplest of the four new
 * boards, with no header gutters at all (`computeBoardLayout` handles the
 * square-grid math directly, exactly like Mirror Maze's board). Tapping a
 * non-given cell cycles blank -> ring -> dot -> blank. Givens draw in ink;
 * the player's own entries draw in `binairoAccent`.
 */
export function BinairoBoard({ puzzle, state, size, onToggleCell, flashCell }: BinairoBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);
  const markSize = layout.cellSize * 0.46;

  return (
    <View
      style={{
        width: layout.boardSize,
        height: layout.boardSize,
        backgroundColor: theme.colors.surfaceHi,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.colors.borderStrong,
        overflow: 'hidden',
      }}
    >
      {state.values.map((line, r) => (
        <View key={`row-${r}`} style={styles.row}>
          {line.map((value, c) => {
            const given = isGiven(puzzle, r, c);
            const flash = flashCell && flashCell.row === r && flashCell.col === c;
            const color = given ? theme.colors.primary : theme.colors.binairoAccent;

            return (
              <Pressable
                key={`cell-${r}-${c}`}
                disabled={given}
                accessibilityRole="button"
                accessibilityLabel={`Row ${r + 1}, column ${c + 1}, ${
                  value === null ? 'blank' : value === 1 ? 'dot' : 'ring'
                }`}
                onPress={() => onToggleCell(r, c)}
                style={{
                  width: layout.cellSize,
                  height: layout.cellSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: flash ? theme.colors.accent : theme.colors.surfaceHi,
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderRightColor: theme.colors.border,
                  borderBottomColor: theme.colors.border,
                }}
              >
                {value === 1 && <Dot size={markSize} color={color} />}
                {value === 0 && <Ring size={markSize} color={color} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});

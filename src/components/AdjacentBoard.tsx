/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { AdjacentCoord, AdjacentPuzzle, AdjacentState, groupAt } from '../game/adjacent';
import { theme } from '../theme';
import { AdjacentAnimation, AdjacentBoardView, adjacentTileColor, computeAdjacentLayout } from './AdjacentBoardView';

/** Plain-language colour names, for the screen reader - a board whose
 * entire content is colour is exactly the one that cannot rely on it. */
const COLOR_NAMES: ReadonlyArray<string> = ['terracotta', 'gold', 'green', 'blue', 'violet'];

export function adjacentColorName(colour: number): string {
  return COLOR_NAMES[colour % COLOR_NAMES.length];
}

/** How long a score pop-up stays up. Long enough to read a three-digit
 * number, short enough to be gone before the next tap lands. */
const POPUP_MS = 700;

export interface AdjacentPopup {
  readonly id: number;
  readonly row: number;
  readonly col: number;
  readonly gained: number;
  readonly multiplier: number;
}

/**
 * The size of the run each square belongs to, for the whole grid, in one
 * pass.
 *
 * Replaces a `groupAt` call *per square* built into the accessibility
 * label of every `Pressable` - forty-nine flood fills, each allocating
 * its own set and array, on every render of this component. One
 * component-labelling sweep does the same job: every square is visited
 * once, and the run it belongs to is stamped onto all of its members at
 * the same time.
 */
function runSizes(grid: AdjacentState['grid']): ReadonlyMap<string, number> {
  const sizes = new Map<string, number>();
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      if (grid[row][col] === null || sizes.has(`${row}:${col}`)) continue;
      const group = groupAt(grid, row, col);
      for (const cell of group) sizes.set(`${cell.row}:${cell.col}`, group.length);
    }
  }
  return sizes;
}

/**
 * One floating "+300" above the tile that was tapped.
 *
 * React Native `<Text>` rather than anything drawn into the canvas:
 * **no Skia font is bundled in this app**, so text over a Skia board is
 * always an overlay (or a hand-drawn vector path, which a live score
 * cannot be). It also means the whole thing runs on the native driver,
 * which matters here - these fire during the fall animation, which is
 * already asking the JS thread for sixty frames a second.
 */
function ScorePopup({ popup, x, y }: { popup: AdjacentPopup; x: number; y: number }): React.JSX.Element {
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: POPUP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  const loud = popup.multiplier > 1;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 60,
        top: y - 16,
        width: 120,
        alignItems: 'center',
        opacity: rise.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -44] }) },
          { scale: rise.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.75, 1, 1] }) },
        ],
      }}
    >
      <Text style={[styles.popup, loud && styles.popupLoud]}>+{popup.gained}</Text>
      {/* The bonus band, named only when there is one - a "1x" on every
          ordinary pair would turn the one genuinely exciting label on
          this board into wallpaper. */}
      {loud && <Text style={styles.popupBonus}>{popup.multiplier}× BONUS</Text>}
    </Animated.View>
  );
}

export interface AdjacentBoardProps {
  puzzle: AdjacentPuzzle;
  state: AdjacentState;
  /** Pixel budget for the grid - the cell is fitted to the tighter. */
  maxWidth: number;
  maxHeight: number;
  solved: boolean;
  preview?: ReadonlyArray<AdjacentCoord> | null;
  animation?: AdjacentAnimation | null;
  popups: ReadonlyArray<AdjacentPopup>;
  disabled: boolean;
  /** Finger down on a square - highlights its run immediately. */
  onPressInCell: (row: number, col: number) => void;
  /** Finger lifted - clears the run. */
  onPressCell: (row: number, col: number) => void;
  /** The gesture was abandoned (dragged off, interrupted). */
  onPressCancel: () => void;
}

/**
 * Composes the Skia-drawn tray with an absolutely-positioned overlay of
 * one `Pressable` per cell - the same split `BinairoBoard`,
 * `FillaPixBoard` and `LightsOutBoard` already use - plus the floating
 * score pop-ups, which have to be RN text (see `ScorePopup`).

 */
export function AdjacentBoard({
  puzzle,
  state,
  maxWidth,
  maxHeight,
  solved,
  preview,
  animation,
  popups,
  disabled,
  onPressInCell,
  onPressCell,
  onPressCancel,
}: AdjacentBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeAdjacentLayout(puzzle, maxWidth, maxHeight), [puzzle, maxWidth, maxHeight]);
  const sizes = useMemo(() => runSizes(state.grid), [state.grid]);
  const { cell, cols, rows, width, height } = layout;

  const popupXY = (row: number, col: number): { x: number; y: number } => ({
    x: col * cell + cell / 2,
    y: row * cell,
  });

  return (
    <View
      style={{
        width,
        height,
        // The one shadow this tray casts against the page, offset toward
        // the same upper-left light every other board here shades from.
        shadowColor: '#3B1F52',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 2, height: 4 },
        elevation: 4,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <AdjacentBoardView puzzle={puzzle} state={state} maxWidth={maxWidth} maxHeight={maxHeight} preview={preview} animation={animation} solved={solved} />
      </Canvas>

      <View style={StyleSheet.absoluteFill} pointerEvents={disabled ? 'none' : 'box-none'}>
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((__, col) => {
            const colour = state.grid[row][col];
            const runSize = sizes.get(`${row}:${col}`) ?? 0;
            return (
              <Pressable
                key={`tap-${row}-${col}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: runSize < 2 }}
                accessibilityLabel={
                  colour === null
                    ? `Row ${row + 1}, column ${col + 1}, empty`
                    : `Row ${row + 1}, column ${col + 1}, ${adjacentColorName(colour)}, run of ${runSize}`
                }
                accessibilityHint={runSize >= 2 ? 'Clears this run and drops what is above it' : 'Not part of a run - nothing to clear'}
                onPressIn={() => onPressInCell(row, col)}
                onPress={() => onPressCell(row, col)}
                onPressOut={onPressCancel}
                style={{
                  position: 'absolute',
                  left: col * cell,
                  top: row * cell,
                  width: cell,
                  height: cell,
                }}
              />
            );
          }),
        )}
      </View>

      {popups.map(popup => {
        const { x, y } = popupXY(popup.row, popup.col);
        return <ScorePopup key={popup.id} popup={popup} x={x} y={y} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  popup: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    // A paper-coloured halo, so the number stays legible wherever on the
    // tray it fires - it lands over tiles of any of the five colours.
    textShadowColor: theme.colors.adjacentGlyph,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  popupLoud: {
    color: theme.colors.adjacentAccent,
  },
  popupBonus: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.adjacentAccent,
    marginTop: 1,
  },
});

/** Re-exported so a caller that already imports the board does not also
 * have to reach into the view module for the palette. */
export { adjacentTileColor };

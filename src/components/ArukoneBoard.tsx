/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useMemo, useRef } from 'react';
import { GestureResponderEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  ArukoneCell,
  ArukonePuzzle,
  ArukoneState,
  beginDraw,
  extendDraw,
  isPathComplete,
  sameCell,
} from '../game/arukone';
import { computeBoardLayout, getCellOrigin } from '../game/rendering';
import { ArukoneBoardView, describeCell, describePair } from './ArukoneBoardView';
import { theme, themedStyles } from '../theme';

export interface ArukoneBoardProps {
  puzzle: ArukonePuzzle;
  state: ArukoneState;
  /** Pixel width (and height - always square) available for the board. */
  size: number;
  solved: boolean;
  /** A legal move was made. */
  onChange: (next: ArukoneState) => void;
  /** The player tried to draw into `cell` and the rules said no. */
  onReject: (cell: ArukoneCell) => void;
  introKey?: number;
  rejectedCell?: ArukoneCell | null;
}

/**
 * Composes the Skia board with the two layers that cannot be drawn in
 * Skia: the numbers, which need real text (this app bundles no Skia
 * font), and the touch surface.
 *
 * Input is a single whole-board `PanResponder` rather than the per-cell
 * `Pressable` grid the tap-driven boards use, because a path is one
 * continuous gesture - touch a number, drag along the squares, let go -
 * and a grid of separate pressables cannot follow a finger across its own
 * cell boundaries. The touch layer is the topmost view and has no
 * children of its own, which is what keeps `locationX`/`locationY`
 * measured against the board itself; the numbers sit *below* it behind
 * `pointerEvents="none"` for the same reason.
 */
export function ArukoneBoard({
  puzzle,
  state,
  size,
  solved,
  onChange,
  onReject,
  introKey,
  rejectedCell,
}: ArukoneBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);

  // The gesture's own scratch state. Refs rather than state: none of it
  // changes what is drawn, and a re-render per touch move would be the
  // most expensive thing on this screen.
  const valueRef = useRef<number | null>(null);
  const lastCellRef = useRef<ArukoneCell | null>(null);
  // Read inside the responder, which is built once and would otherwise
  // close over the board state as it was on first render.
  const latest = useRef({ state, solved, onChange, onReject, layout, puzzle });
  latest.current = { state, solved, onChange, onReject, layout, puzzle };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.solved,
        onMoveShouldSetPanResponder: () => !latest.current.solved,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event: GestureResponderEvent) => {
          const cell = cellAt(latest.current.layout, event);
          if (!cell) return;
          lastCellRef.current = cell;
          const started = beginDraw(latest.current.puzzle, latest.current.state, cell);
          if (!started) {
            valueRef.current = null;
            return;
          }
          valueRef.current = started.value;
          latest.current.onChange(started.state);
        },

        onPanResponderMove: (event: GestureResponderEvent) => {
          const value = valueRef.current;
          if (value === null) return;
          const cell = cellAt(latest.current.layout, event);
          // Only act when the finger actually crosses into a new square -
          // a move event fires many times per square otherwise, and every
          // one of them would re-run the rules and re-report a refusal.
          if (!cell || (lastCellRef.current && sameCell(lastCellRef.current, cell))) return;
          lastCellRef.current = cell;

          const next = extendDraw(latest.current.puzzle, latest.current.state, value, cell);
          if (next === latest.current.state) {
            latest.current.onReject(cell);
            return;
          }
          latest.current.onChange(next);
        },

        onPanResponderRelease: () => {
          valueRef.current = null;
          lastCellRef.current = null;
        },
        onPanResponderTerminate: () => {
          valueRef.current = null;
          lastCellRef.current = null;
        },
      }),
    [],
  );

  const numberSize = Math.round(layout.cellSize * 0.4);

  return (
    <View style={{ width: layout.boardSize, height: layout.boardSize }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <ArukoneBoardView
          puzzle={puzzle}
          state={state}
          size={size}
          solved={solved}
          introKey={introKey}
          rejectedCell={rejectedCell}
        />
      </Canvas>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {puzzle.pairs.flatMap(pair =>
          [pair.a, pair.b].map(cell => {
            const origin = getCellOrigin(layout, cell.row, cell.col);
            return (
              <Text
                key={`n-${pair.value}-${cell.row}-${cell.col}`}
                style={[
                  styles.number,
                  {
                    left: origin.x,
                    top: origin.y,
                    width: layout.cellSize,
                    height: layout.cellSize,
                    lineHeight: layout.cellSize,
                    fontSize: numberSize,
                  },
                ]}
              >
                {pair.value}
              </Text>
            );
          }),
        )}
      </View>

      {/* One non-interactive accessible element per cell, so VoiceOver can
          swipe through the board and hear each square's own state - the
          same baseline the other five boards' per-cell `Pressable`s give
          for free. `pointerEvents="none"` keeps every one of these out of
          the touch path entirely; the drag gesture below is still the only
          thing that can receive a touch. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: puzzle.size }).map((_, row) =>
          Array.from({ length: puzzle.size }).map((__, col) => {
            const origin = getCellOrigin(layout, row, col);
            return (
              <View
                key={`cell-${row}-${col}`}
                accessible
                accessibilityLabel={describeCell(puzzle, state, row, col)}
                style={{ position: 'absolute', left: origin.x, top: origin.y, width: layout.cellSize, height: layout.cellSize }}
              />
            );
          }),
        )}
      </View>

      <View
        style={StyleSheet.absoluteFill}
        accessibilityRole="adjustable"
        accessibilityLabel={`Arukone board, ${puzzle.size} by ${puzzle.size}`}
        accessibilityValue={{
          text: puzzle.pairs
            .map(pair => `${pair.value}: ${describePair(puzzle, state, pair)}`)
            .join(', '),
        }}
        accessibilityHint="Touch a number and drag through neighbouring squares to join it to its twin."
        {...responder.panHandlers}
      />
    </View>
  );
}

/** The cell under a touch, or `null` if it landed outside the board. */
function cellAt(
  layout: ReturnType<typeof computeBoardLayout>,
  event: GestureResponderEvent,
): ArukoneCell | null {
  const { locationX, locationY } = event.nativeEvent;
  if (layout.cellSize <= 0) return null;
  const col = Math.floor(locationX / layout.cellSize);
  const row = Math.floor(locationY / layout.cellSize);
  if (row < 0 || col < 0 || row >= layout.gridSize || col >= layout.gridSize) return null;
  return { row, col };
}

/** Whether a pair is finished - re-exported so a screen can count without
 * reaching past this component into the engine for one predicate. */
export function isPairJoined(puzzle: ArukonePuzzle, state: ArukoneState, value: number): boolean {
  const pair = puzzle.pairs.find(p => p.value === value);
  return pair ? isPathComplete(pair, state.paths[value] ?? []) : false;
}

const styles = themedStyles(() => ({
  number: {
    position: 'absolute',
    textAlign: 'center',
    // Cream on the token's own wine, which is the only pairing on this
    // board that carries text - the page's violet ink would disappear
    // into it.
    color: theme.colors.surfaceHi,
    fontWeight: theme.typography.weights.bold,
  },
}));

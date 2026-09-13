/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import {
  endpointColorAt,
  pairConnected,
  pathColorAt,
  TrajectoryCell,
  TrajectoryPuzzle,
  TrajectoryState,
} from '../game/trajectory';
import { theme } from '../theme';

/** Distinct hues that read on the cream ground, indexed by pair colour id. */
const PAIR_COLORS = [
  '#3E5C99',
  '#B4472E',
  '#5C7C4A',
  '#B7892F',
  '#6B4C86',
  '#2F6F7A',
  '#9A5B33',
  '#4B6A88',
];
const hueOf = (color: number): string => PAIR_COLORS[(color - 1) % PAIR_COLORS.length];

export interface TrajectoryBoardProps {
  puzzle: TrajectoryPuzzle;
  state: TrajectoryState;
  size: number;
  /** Begin a path from an endpoint cell. */
  onBegin: (cell: TrajectoryCell) => void;
  /** Extend the active path to a cell. */
  onExtend: (color: number, cell: TrajectoryCell) => void;
}

/**
 * A flow board drawn with plain views. Endpoints are filled discs; a drawn
 * path is a chain of rounded bars in its colour; a blocked cell (if the
 * puzzle has any) is a solid square no path may ever enter. Dragging from
 * an endpoint begins its path; dragging over adjacent cells extends it.
 */
export function TrajectoryBoard({
  puzzle,
  state,
  size,
  onBegin,
  onExtend,
}: TrajectoryBoardProps): React.JSX.Element {
  const { rows, cols } = puzzle;
  const cell = Math.floor(size / cols);
  const boardW = cell * cols;
  const boardH = cell * rows;

  const activeColor = useRef<number | null>(null);

  // Which pairs currently run unbroken endpoint-to-endpoint - drawn solid;
  // everything still in progress is drawn as a lighter "sketch" so the line
  // visibly locks in the moment it correctly connects.
  const connectedColors = useMemo(
    () => new Set(puzzle.pairs.filter(pair => pairConnected(state, pair)).map(pair => pair.color)),
    [puzzle, state],
  );

  const cellAt = useCallback(
    (x: number, y: number): TrajectoryCell | null => {
      const col = Math.floor(x / cell);
      const row = Math.floor(y / cell);
      if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
      return { row, col };
    },
    [cell, rows, cols],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          const c = cellAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (!c) return;
          const ep = endpointColorAt(puzzle, c);
          const onPath = pathColorAt(state, c);
          if (ep !== null) {
            activeColor.current = ep;
            onBegin(c);
          } else if (onPath !== null) {
            // Grabbing anywhere along an already-drawn path picks it back up
            // from that exact point - extending immediately truncates it
            // there, so the line redraws from wherever the finger lands
            // instead of only from its still-attached head.
            activeColor.current = onPath;
            onExtend(onPath, c);
          }
        },
        onPanResponderMove: e => {
          if (activeColor.current === null) return;
          const c = cellAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (c) onExtend(activeColor.current, c);
        },
        onPanResponderRelease: () => {
          activeColor.current = null;
        },
        onPanResponderTerminate: () => {
          activeColor.current = null;
        },
      }),
    // rebuilt when the puzzle/state changes so the grant handler reads live paths
    [puzzle, state, onBegin, onExtend, cellAt],
  );

  return (
    <View
      {...responder.panHandlers}
      style={{ width: boardW, height: boardH, backgroundColor: theme.colors.surfaceHi, borderRadius: 10, overflow: 'hidden' }}
    >
      {/* grid lines - decorative only. Without `pointerEvents="none"` these
          absolutely-positioned siblings become the touch *target* under the
          finger, and RN reports locationX/Y relative to whichever view was
          hit rather than this container, so every drag reads the wrong
          cell. That was the whole "the lines don't work" bug - the parent
          view (with the pan responder) must stay the sole hit target for
          every child in this board. */}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <View
            key={`g-${r}-${c}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: c * cell,
              top: r * cell,
              width: cell,
              height: cell,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            }}
          />
        )),
      )}

      {/* blocked cells - permanently off-limits, drawn the same dark filled
          square as a Gravity obstacle so "solid, can't go there" reads the
          same language across every game. */}
      {(puzzle.blocked ?? []).map(b => {
        const inset = cell * 0.14;
        return (
          <View
            key={`b-${b.row}-${b.col}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: b.col * cell + inset,
              top: b.row * cell + inset,
              width: cell - inset * 2,
              height: cell - inset * 2,
              borderRadius: cell * 0.08,
              backgroundColor: theme.colors.textSecondary,
            }}
          />
        );
      })}

      {/* paths - a pair still being drawn renders as a thin, translucent
          sketch; the moment it correctly joins both endpoints it thickens
          to a solid line, so "connected" reads at a glance without a
          separate checklist. */}
      {Object.entries(state.paths).map(([colorStr, path]) => {
        const color = Number(colorStr);
        const hue = hueOf(color);
        const connected = connectedColors.has(color);
        const bar = connected ? Math.max(6, cell * 0.34) : Math.max(4, cell * 0.22);
        const opacity = connected ? 1 : 0.62;
        return (
          <React.Fragment key={`p-${color}`}>
            {path.map((p, i) => {
              const next = path[i + 1];
              const cx = p.col * cell + cell / 2;
              const cy = p.row * cell + cell / 2;
              return (
                <React.Fragment key={`s-${i}`}>
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: cx - bar / 2,
                      top: cy - bar / 2,
                      width: bar,
                      height: bar,
                      borderRadius: bar / 2,
                      backgroundColor: hue,
                      opacity,
                    }}
                  />
                  {next && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: Math.min(cx, next.col * cell + cell / 2) - bar / 2,
                        top: Math.min(cy, next.row * cell + cell / 2) - bar / 2,
                        width: p.row === next.row ? cell + bar : bar,
                        height: p.row === next.row ? bar : cell + bar,
                        borderRadius: bar / 2,
                        backgroundColor: hue,
                        opacity,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}

      {/* endpoints - a connected pair's endpoints get a soft halo (drawn
          first so the solid dot layers on top of it) as the one moment of
          celebration in an otherwise quiet board. */}
      {puzzle.pairs.map(pair => {
        const connected = connectedColors.has(pair.color);
        const d = cell * 0.56;
        return [pair.a, pair.b].map((ep, i) => (
          <React.Fragment key={`e-${pair.color}-${i}`}>
            {connected && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: ep.col * cell + (cell - d * 1.5) / 2,
                  top: ep.row * cell + (cell - d * 1.5) / 2,
                  width: d * 1.5,
                  height: d * 1.5,
                  borderRadius: (d * 1.5) / 2,
                  backgroundColor: hueOf(pair.color),
                  opacity: 0.18,
                }}
              />
            )}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: ep.col * cell + (cell - d) / 2,
                top: ep.row * cell + (cell - d) / 2,
                width: d,
                height: d,
                borderRadius: d / 2,
                backgroundColor: hueOf(pair.color),
                borderWidth: 2,
                borderColor: theme.colors.surfaceHi,
              }}
            />
          </React.Fragment>
        ));
      })}
    </View>
  );
}

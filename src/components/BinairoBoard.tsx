/* eslint-disable react-native/no-inline-styles -- cell geometry is derived from `size` at render time */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Canvas } from '@shopify/react-native-skia';
import { BinairoCell, BinairoPuzzle, BinairoState, constraintPartner, isConstraintViolated, isGiven } from '../game/binairo';
import { computeBoardLayout, getCellOrigin, REFUSE_MS, REFUSE_PX, refuseFade, refuseShake, triggerFeedback, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { BinairoBoardView } from './BinairoBoardView';
import { curve } from '../theme/motion';

export interface BinairoBoardProps {
  puzzle: BinairoPuzzle;
  state: BinairoState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  onToggleCell: (row: number, col: number) => void;
  /** Cell to flash briefly (a hint reveal). */
  flashCell?: BinairoCell | null;
  /** Bumped by the screen on every restart to replay the board's intro
   * wave - see `BinairoBoardView`'s own `introKey` prop for what actually
   * animates off it. */
  introKey?: number;
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

/** Describes any neighbour-count clue that `(row, col)` is counted *by* -
 * relayed onto the editable cell itself rather than onto the clue, for
 * the same reason `constraintDescriptions` is: a screen-reader player
 * navigates the cells they can actually fill, and that is the moment the
 * clue is worth hearing. A sighted player reads the digit directly. */
function countClueDescriptions(puzzle: BinairoPuzzle, row: number, col: number): string[] {
  const descriptions: string[] = [];
  for (const clue of puzzle.countClues ?? []) {
    const adjacent = Math.abs(clue.row - row) + Math.abs(clue.col - col) === 1;
    if (!adjacent) continue;
    const relative = clue.row === row ? (clue.col < col ? 'left' : 'right') : clue.row < row ? 'above' : 'below';
    descriptions.push(`counted by the clue ${relative}, which needs ${clue.count} circles among its neighbours`);
  }
  return descriptions;
}

/**
 * One tap target. It toggles the moment a finger lands (`onPressIn`), not
 * on release: waiting for the finger to lift - and for `Pressable`'s own
 * press/long-press bookkeeping in between - is what made placing a tile
 * feel laggy on a phone. The flip animation is the feedback now, so the
 * old held-down glow (a state change that re-rendered all 64 targets on
 * press *and* release) is gone. Memoised, so a toggle re-renders only the
 * target whose label changed.
 */
const CellTarget = React.memo(function CellTargetImpl({
  row,
  col,
  x,
  y,
  size,
  label,
  onToggleCell,
}: {
  row: number;
  col: number;
  x: number;
  y: number;
  size: number;
  label: string;
  onToggleCell: (row: number, col: number) => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => onToggleCell(row, col)}
      style={{ position: 'absolute', left: x, top: y, width: size, height: size }}
    />
  );
});

/** The shared refusal (`RefuseMark`) sampled for the native driver. */
const REFUSE_STEPS = Array.from({ length: 21 }, (_, i) => i / 20);
const REFUSE_X = REFUSE_STEPS.map(t => refuseShake(t) * REFUSE_PX);
const REFUSE_OPACITY = REFUSE_STEPS.map(t => refuseFade(t));

/** The outline that shakes round a cell set from the start when tapped:
 * the same refusal every board gives, drawn over the canvas here because
 * this board's cells are views. */
function LockedFlash({ x, y, size }: { x: number; y: number; size: number }): React.JSX.Element {
  const t = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: REFUSE_MS, easing: curve.linear, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x + 2,
        top: y + 2,
        width: size - 4,
        height: size - 4,
        borderRadius: size * 0.18,
        borderWidth: 2,
        borderColor: theme.colors.textSecondary,
        opacity: t.interpolate({ inputRange: REFUSE_STEPS, outputRange: REFUSE_OPACITY }),
        transform: [{ translateX: reduced ? 0 : t.interpolate({ inputRange: REFUSE_STEPS, outputRange: REFUSE_X }) }],
      }}
    />
  );
}

/**
 * Composes the Skia-drawn board (`BinairoBoardView`) with an
 * absolutely-positioned overlay of one `Pressable` per non-given cell on
 * top of the `<Canvas>` - the same split Mirror Maze's board already
 * proved (`MirrorMazeBoard`), needed here because the two fillable
 * symbols are real path geometry a plain `View` can't draw. Given cells
 * get no `Pressable` at all, matching the old board's `disabled={given}`.
 */
export function BinairoBoard({ puzzle, state, size, solved, onToggleCell, flashCell, introKey }: BinairoBoardProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);

  // A tap on a cell set from the start: it cannot change, so it says so -
  // a small shake of an outline round it and a soft refusal - rather than
  // doing nothing, which read as the row having stopped working.
  const [locked, setLocked] = useState<{ row: number; col: number; key: number } | null>(null);
  const givenCells = useMemo(() => {
    const cells: BinairoCell[] = [];
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (isGiven(puzzle, row, col)) cells.push({ row, col });
      }
    }
    return cells;
  }, [puzzle]);
  const tapGiven = useCallback((row: number, col: number) => {
    triggerFeedback('refuse');
    setLocked({ row, col, key: Date.now() });
  }, []);

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
    <View
      style={{
        width: layout.boardSize,
        height: layout.boardSize,
        // A soft ambient shadow separating the whole board from the paper
        // behind it, drawn by the native platform (outside the Skia
        // canvas's own bounds) rather than inside it - the board should
        // read as one physical slab resting above the page, not a flat
        // rectangle painted onto it. Offset down-right to match the same
        // upper-left light every tile/token/button already shades toward.
        // Kept light - this is the *only* shadow reads as "the board's
        // own edge" now that the plinth beneath it (`BinairoScreen`'s
        // `styles.stage`) carries no fill of its own; a heavy shadow here
        // on top of a heavy plinth used to double up into one dark frame.
        shadowColor: theme.colors.shadow,
        shadowOpacity: 0.14,
        shadowRadius: 9,
        shadowOffset: { width: 2, height: 4 },
        elevation: 4,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <BinairoBoardView puzzle={puzzle} state={state} size={size} solved={solved} flashCell={flashCell} pressedCell={null} introKey={introKey} />
      </Canvas>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {givenCells.map(({ row, col }) => {
          const origin = getCellOrigin(layout, row, col);
          return (
            <CellTarget
              key={`given-${row}-${col}`}
              row={row}
              col={col}
              x={origin.x}
              y={origin.y}
              size={layout.cellSize}
              label={`Row ${row + 1}, column ${col + 1}, ${valueLabel(state.values[row][col])}, set from the start`}
              onToggleCell={tapGiven}
            />
          );
        })}
        {locked && <LockedFlash key={locked.key} x={getCellOrigin(layout, locked.row, locked.col).x} y={getCellOrigin(layout, locked.row, locked.col).y} size={layout.cellSize} />}
        {editableCells.map(({ row, col }) => {
          const origin = getCellOrigin(layout, row, col);
          const constraints = constraintDescriptions(puzzle, state, row, col);
          const counts = countClueDescriptions(puzzle, row, col);
          const label = [
            `Row ${row + 1}, column ${col + 1}, ${valueLabel(state.values[row][col])}`,
            ...constraints,
            ...counts,
          ].join(', ');
          return (
            <CellTarget
              key={`tap-${row}-${col}`}
              row={row}
              col={col}
              x={origin.x}
              y={origin.y}
              size={layout.cellSize}
              label={label}
              onToggleCell={onToggleCell}
            />
          );
        })}
      </View>

      {/* Neighbour-count clues, drawn as plain RN text above the Canvas
          rather than inside it. There is no Skia font anywhere in this app
          - adding one would mean shipping a font asset and handling the
          frames before it loads - and the board already maintains an
          absolutely-positioned overlay in exactly this coordinate space
          for its tap targets, so the digit costs no new infrastructure.

          Knocked out in the paper colour on top of the clue cell's own
          symbol, the same cut-out idiom `HazardMarker` uses: the cell
          keeps showing its circle or square (which the player still needs
          for the row and column counts) and gains the digit on top of it,
          rather than the number replacing the value. Non-interactive -
          a clue cell is a given, so there is nothing to tap. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {(puzzle.countClues ?? []).map(clue => {
          const origin = getCellOrigin(layout, clue.row, clue.col);
          return (
            <View
              key={`count-${clue.row}-${clue.col}`}
              style={{
                position: 'absolute',
                left: origin.x,
                top: origin.y,
                width: layout.cellSize,
                height: layout.cellSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: theme.typography.families.mono,
                  fontSize: layout.cellSize * 0.42,
                  fontWeight: theme.typography.weights.bold,
                  color: theme.colors.surfaceHi,
                }}
              >
                {clue.count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

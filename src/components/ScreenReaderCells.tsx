import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useScreenReader } from '../game/rendering';

export interface ScreenReaderCell {
  readonly key: string;
  /** The cell's square on the board, in the board's own points. */
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** What it is and how it stands: "Row 2, column 3, vane pointing up". */
  readonly label: string;
  /** What activating it does, when that is not plain from the label. */
  readonly hint?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  /** Further moves, offered in the screen reader's actions menu (swipe up
   * or down on iOS): "Turn" for a piece in the tray. */
  readonly actions?: ReadonlyArray<{ readonly name: string; readonly label: string; readonly run: () => void }>;
}

/**
 * A board played by a screen reader. Boards drawn on a canvas and played
 * by drag or swipe were one opaque picture to VoiceOver and TalkBack: it
 * could say "Pond with 8 pads" but there was nothing to play. This lays
 * an invisible button over each cell that counts, each saying what it is
 * and doing that cell's move on a double tap.
 *
 * Only there while a screen reader runs, so it never stands between a
 * finger and the board's own gestures. The board's own single label
 * should step aside while it shows (`accessible={!screenReader}`).
 */
export function ScreenReaderCells({ cells }: { cells: ReadonlyArray<ScreenReaderCell> }): React.JSX.Element | null {
  const on = useScreenReader();
  if (!on) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {cells.map(cell => (
        <Pressable
          key={cell.key}
          accessibilityRole="button"
          accessibilityLabel={cell.label}
          accessibilityHint={cell.hint}
          accessibilityState={{ selected: cell.selected, disabled: cell.disabled }}
          onPress={cell.onActivate}
          accessibilityActions={cell.actions?.map(a => ({ name: a.name, label: a.label }))}
          onAccessibilityAction={e => cell.actions?.find(a => a.name === e.nativeEvent.actionName)?.run()}
          style={{ position: 'absolute', left: cell.x, top: cell.y, width: cell.size, height: cell.size }}
        />
      ))}
    </View>
  );
}

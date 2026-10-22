import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, themedStyles } from '../theme';

/**
 * A game screen's vertical rhythm, the same in all twelve: the header at
 * the top, the keys (Insight, Undo, Restart) docked at the bottom where the
 * thumbs are, and the board with its tray centred in what is left between
 * them.
 *
 * Boards are as wide as the screen allows, so on most phones they leave
 * height over. Stacked under the header, all of it pooled below the keys:
 * a quarter of the screen of bare paper. Shared out above the board and
 * between the board and the dock, it is the board's breathing room.
 *
 * `StageTopGap` goes above the board, `DockGap` between the board (and its
 * tray) and the keys, `DockFloor` under the last line of the dock. On a
 * short phone the two gaps shrink to their minimums first.
 */
export function StageTopGap(): React.JSX.Element {
  return <View style={styles.top} />;
}

export function DockGap(): React.JSX.Element {
  return <View style={styles.dock} />;
}

export function DockFloor(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return <View style={{ height: Math.max(insets.bottom, theme.spacing.md) }} />;
}

/**
 * The keys' dock: one paper capsule holding Insight, Undo and Restart, the
 * same as Home's tab bar. Docked low, the keys sit in front of the page's
 * flowers; on the capsule they read as one toolbar rather than three keys
 * scattered over the drawing.
 */
export const dockPlate = themedStyles(() => ({
  plate: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm + 3,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
}));

const styles = themedStyles(() => ({
  top: { flexGrow: 1, flexShrink: 1, minHeight: theme.spacing.sm },
  // A touch more below than above: the board sits at the optical centre,
  // a little high, rather than the measured one.
  dock: { flexGrow: 1.25, flexShrink: 1, minHeight: theme.spacing.lg },
}));

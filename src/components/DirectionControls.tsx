import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Direction } from '../game/engine';
import { theme } from '../theme';

export interface DirectionControlsProps {
  onDirection: (direction: Direction) => void;
  /** While true (e.g. a previous gravity move is still animating), button
   * presses are ignored and the pad dims slightly rather than queuing up
   * another move - this is what keeps rapid taps from ever piling up
   * overlapping slides or outrunning the visible board state. */
  disabled?: boolean;
}

const BUTTON_SIZE = 68;

/**
 * Large, thumb-friendly directional pad for triggering gravity.
 *
 * Purely presentational: it only reports *which* direction the user
 * pressed. All game logic (moving pieces) lives in the engine's
 * `applyGravity` - this component never touches game state.
 */
function DirectionControlsImpl({ onDirection, disabled = false }: DirectionControlsProps): React.JSX.Element {
  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <DirectionButton label="▲" direction="up" onDirection={onDirection} disabled={disabled} />
      <View style={styles.middleRow}>
        <DirectionButton label="◀" direction="left" onDirection={onDirection} disabled={disabled} />
        <View style={styles.spacer} />
        <DirectionButton label="▶" direction="right" onDirection={onDirection} disabled={disabled} />
      </View>
      <DirectionButton label="▼" direction="down" onDirection={onDirection} disabled={disabled} />
    </View>
  );
}

/**
 * Memoized: GameScreen re-renders on every frame of a gravity slide, but
 * this pad's props (`onDirection` is stable, `disabled` only flips at slide
 * start/end) don't change frame-to-frame - so it should not re-reconcile its
 * six Pressables ~60 times a second for nothing.
 */
export const DirectionControls = React.memo(DirectionControlsImpl);

interface DirectionButtonProps {
  label: string;
  direction: Direction;
  onDirection: (direction: Direction) => void;
  disabled?: boolean;
}

function DirectionButton({ label, direction, onDirection, disabled = false }: DirectionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Apply gravity ${direction}`}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : () => onDirection(direction)}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  containerDisabled: {
    opacity: 0.6,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    margin: theme.spacing.xs,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing.xs,
  },
  buttonPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  buttonLabel: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    lineHeight: 30,
  },
});

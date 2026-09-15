import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { theme } from '../theme';

export interface SessionControlsProps {
  onUndo: () => void;
  onRestart: () => void;
  undoDisabled?: boolean;
}

/**
 * Small row of session-management buttons (Undo / Restart).
 *
 * Purely presentational: it only reports which button was pressed. All
 * history bookkeeping (what "undo" or "restart"
 * actually does to the puzzle state) lives in the engine's
 * `gameSessionReducer` - this component never touches game state.
 */
function SessionControlsImpl({
  onUndo,
  onRestart,
  undoDisabled = false,
}: SessionControlsProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <SessionButton label="Undo" onPress={onUndo} disabled={undoDisabled} />
      <View style={styles.spacer} />
      <SessionButton label="Restart" onPress={onRestart} />
    </View>
  );
}

/**
 * Memoized because GameScreen re-renders on every frame of a gravity slide,
 * but this row's props are stable across those frames.
 */
export const SessionControls = React.memo(SessionControlsImpl);

interface SessionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

function SessionButton({ label, onPress, disabled = false }: SessionButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: theme.spacing.md,
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    // A slightly lighter top edge than the other three sides - see
    // `BinairoScreen.tsx`'s identical `pill` style for why (a small
    // "catching the light" cue rather than one flat border colour).
    borderTopColor: '#FBF6EB',
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    shadowColor: '#2A251F',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 3 },
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: theme.colors.surfaceAlt,
    shadowOpacity: 0.04,
    shadowOffset: { width: 1, height: 1 },
    elevation: 1,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  buttonLabelDisabled: {
    color: theme.colors.textDisabled,
  },
});

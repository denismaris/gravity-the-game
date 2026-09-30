import React from 'react';
import { Text, View } from 'react-native';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { PressableScale } from './PressableScale';
import { theme, themedStyles } from '../theme';
import { CoinCost } from './Coins';

export interface SessionControlsProps {
  onUndo: () => void;
  onRestart: () => void;
  /** Shows the next move - when set, a Hint pill leads the row. */
  onHint?: () => void;
  hintCost?: number;
  undoDisabled?: boolean;
  /** Coins an undo costs, shown on the button when set. */
  undoCost?: number;
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
  undoCost,
  onHint,
  hintCost,
}: SessionControlsProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {onHint && (
        <>
          <SessionButton
            label="Hint"
            icon={<HintIcon />}
            onPress={onHint}
            cost={hintCost === undefined ? undefined : <CoinCost cost={hintCost} />}
          />
          <View style={styles.spacer} />
        </>
      )}
      <SessionButton
        label="Undo"
        icon={<UndoIcon />}
        onPress={onUndo}
        disabled={undoDisabled}
        cost={undoCost === undefined ? undefined : <CoinCost cost={undoCost} muted={undoDisabled} />}
      />
      <View style={styles.spacer} />
      <SessionButton label="Restart" icon={<RestartIcon />} onPress={onRestart} />
    </View>
  );
}

/**
 * Memoized because GameScreen re-renders on every frame of a gravity slide,
 * but this row's props are stable across those frames.
 */
export const SessionControls = React.memo(SessionControlsImpl);

const ICON_SIZE = 14;

/** The same restart arrow every other play screen's Restart pill carries,
 * in Gravity's own terracotta (`secondary`, the colour its header kicker
 * already uses), so this row stops being the one set of bare-text buttons
 * in the app. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.secondary} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.secondary} />
    </Canvas>
  );
}

/** The lightbulb every play screen's Hint pill carries, in terracotta. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.secondary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.secondary} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.secondary} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.secondary} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

/** `RestartIcon` mirrored - "one step back" as the opposite of "start over". */
function UndoIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 9.83 3.63 A 4.4 4.4 0 1 1 3.63 4.17" color={theme.colors.secondary} style="stroke" strokeWidth={1.6} />
      <Path path="M 4.34 3.33 L 1.21 4.1 L 4.12 6.54 Z" color={theme.colors.secondary} />
    </Canvas>
  );
}

interface SessionButtonProps {
  label: string;
  icon: React.ReactNode;
  cost?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}

function SessionButton({ label, icon, cost, onPress, disabled = false }: SessionButtonProps) {
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
      {icon}
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>{label}</Text>
      {cost}
    </PressableScale>
  );
}

const styles = themedStyles(() => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: theme.spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    // A slightly lighter top edge than the other three sides - see
    // `BinairoScreen.tsx`'s identical `pill` style for why (a small
    // "catching the light" cue rather than one flat border colour).
    borderTopColor: theme.colors.highlightEdge,
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
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
}));

import React from 'react';
import { AccessibilityState } from 'react-native';
import { theme } from '../theme';
import { PressableScale } from './PressableScale';
import { RaisedKey } from './RaisedKey';

/** The round key under every board - Undo, Restart - on its own edge. */
export const ROUND_KEY = 44;
const LIP = 3;

export function RoundKey({
  accessibilityLabel,
  accessibilityState,
  onPress,
  disabled,
  dim = false,
  children,
}: {
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  onPress: () => void;
  disabled?: boolean;
  /** Can't be used right now (nothing to undo): faded, still in its place. */
  dim?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState} onPress={onPress} disabled={disabled} scaleTo={1}>
      <RaisedKey height={ROUND_KEY} width={ROUND_KEY} lip={LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border} idle={dim}>
        {children}
      </RaisedKey>
    </PressableScale>
  );
}

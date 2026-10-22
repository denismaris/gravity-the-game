import React from 'react';
import { Text as NativeText } from 'react-native';

/**
 * How far the player's own text size setting may grow the app's text. Up
 * to here every label still fits its key, chip and card; past it, words
 * broke mid-letter and tabs collapsed to dots, which helps no one. Body
 * copy still grows by nearly a third.
 */
export const MAX_TEXT_SCALE = 1.3;

/** React Native's `Text`, capped at `MAX_TEXT_SCALE`. Every screen imports
 * this one: `Text.defaultProps` is gone with React 19, so a cap has to be
 * a component. A caller can still pass its own `maxFontSizeMultiplier`. */
export function Text(props: React.ComponentProps<typeof NativeText>): React.JSX.Element {
  return <NativeText maxFontSizeMultiplier={MAX_TEXT_SCALE} {...props} />;
}

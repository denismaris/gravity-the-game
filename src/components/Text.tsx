import React from 'react';
import { Text as NativeText } from 'react-native';

/**
 * How far the player's own text size setting may grow the app's text. Up
 * to here every label still fits its key, chip and card; past it, words
 * broke mid-letter and tabs collapsed to dots, which helps no one. Body
 * copy still grows by nearly a third.
 */
export const MAX_TEXT_SCALE = 1.3;
/** With the Larger Text setting on: as far as a layout here can carry
 * with its lines wrapping. */
export const LARGER_TEXT_SCALE = 2;

let scale = MAX_TEXT_SCALE;
/** Set by the settings: the Larger Text switch. */
export function setTextScale(larger: boolean): void {
  scale = larger ? LARGER_TEXT_SCALE : MAX_TEXT_SCALE;
}
/** The cap in force now, for text that is not this component. */
export function textScale(): number {
  return scale;
}

/**
 * A tighter cap for text inside a shape of fixed size (a key, a tab, a
 * tile): there, the Larger Text setting would only push the words out of
 * their shape. `RaisedKey` provides it; so can anything else that frames
 * text at a fixed size.
 */
export const FixedTextCap = React.createContext<number | null>(null);

/** React Native's `Text`, capped at `MAX_TEXT_SCALE`. Every screen imports
 * this one: `Text.defaultProps` is gone with React 19, so a cap has to be
 * a component. A caller can still pass its own `maxFontSizeMultiplier`. */
export function Text(props: React.ComponentProps<typeof NativeText>): React.JSX.Element {
  const fixed = React.useContext(FixedTextCap);
  return <NativeText maxFontSizeMultiplier={fixed !== null ? Math.min(fixed, scale) : scale} {...props} />;
}

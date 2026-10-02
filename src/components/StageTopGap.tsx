import React from 'react';
import { View, useWindowDimensions } from 'react-native';

/**
 * The space between a game's header and its board - the same on every
 * game, so a board starts at the same height whichever game it is,
 * instead of floating to the middle of whatever room its own controls
 * leave. It shrinks on a short phone rather than push a tall board (with
 * its tray or keypad) off the bottom.
 */
export function StageTopGap(): React.JSX.Element {
  const { height } = useWindowDimensions();
  const gap = Math.round(Math.max(8, Math.min(88, (height - 640) * 0.45)));
  return <View style={{ height: gap, flexShrink: 1 }} />;
}

import { ViewStyle } from 'react-native';

/**
 * A board cell's answer to a finger, before the move lands: a soft dip
 * the size of the cell. It sits on the touch layer above the canvas, so
 * it shows on the frame the finger lands without the board having to
 * track press state. A warm mid-tone that reads on the paper tray and
 * the dark one alike. Every board that acts on release uses this one.
 */
export function cellDip(pressed: boolean, size: number): ViewStyle {
  return { borderRadius: size * 0.18, backgroundColor: pressed ? 'rgba(120,100,70,0.12)' : 'transparent' };
}

import React from 'react';
import { Image, View } from 'react-native';

export interface TesseraMarkProps {
  /** Outer square size in pixels. */
  readonly size: number;
}

/** The mark, as the icon draws it (`tools/make_icon.py` writes it). */
const MARK = require('../assets/brand/mark.png');

/**
 * The app's own mark: the same four glazed tiles, carved star and gold gem
 * as the app icon, so the masthead, the launch and the home screen all
 * show one thing. It is the icon's own render (see `write_mark_layers` in
 * `tools/make_icon.py`), not a second drawing of it that could drift.
 *
 * An image, not a canvas: on Android every Skia canvas is a surface of its
 * own, recomposed on each frame anything on the page moves.
 */
export function TesseraMark({ size }: TesseraMarkProps): React.JSX.Element {
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Tessellatum mark">
      <Image source={MARK} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} />
    </View>
  );
}

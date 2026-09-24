/**
 * Colour maths shared by the Skia boards.
 *
 * `shade` is the one way this app derives a lighter or darker tone from a
 * base colour at render time - piece gradients, extruded side faces and
 * recessed divider lines all go through it, so "one light source, top
 * left" stays consistent between boards instead of each one hand-picking
 * its own tones.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

/**
 * `hex` scaled per channel by `factor` (>1 lightens, <1 darkens),
 * returned as an `rgb(...)` string.
 *
 * Anything that isn't a `#rrggbb` literal is handed straight back
 * untouched. The palette holds real `rgba(...)` entries (the gravity-zone
 * tints), and an earlier copy of this function parsed those as hex and
 * produced `NaN` channels, which Skia painted as opaque black without
 * throwing - a bug that was slow to spot precisely because nothing failed
 * loudly.
 */
export function shade(hex: string, factor: number): string {
  if (!HEX_PATTERN.test(hex)) return hex;
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r * factor)},${clamp(g * factor)},${clamp(b * factor)})`;
}

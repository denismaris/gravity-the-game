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

function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio between two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color` as text on `ground`: unchanged when it already reads (4.5:1, the
 * WCAG level for body text), otherwise taken toward `ink` (darker on a
 * light page, lighter on a dark one) only as far as it needs to. A game's
 * accent stays its own hue; it just stops being too faint to read.
 */
export function readableOn(color: string, ground: string, ink: string, target = 4.5): string {
  if (!HEX_PATTERN.test(color) || !HEX_PATTERN.test(ground) || !HEX_PATTERN.test(ink)) return color;
  if (contrastRatio(color, ground) >= target) return color;
  const from = hexToRgb(color);
  const to = hexToRgb(ink);
  for (let k = 1; k <= 20; k += 1) {
    const t = k / 20;
    const mixed = { r: Math.round(from.r + (to.r - from.r) * t), g: Math.round(from.g + (to.g - from.g) * t), b: Math.round(from.b + (to.b - from.b) * t) };
    const hex = `#${[mixed.r, mixed.g, mixed.b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    if (contrastRatio(hex, ground) >= target) return hex;
  }
  return ink;
}

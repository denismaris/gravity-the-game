import { BED_NIGHT, MOSAIC_PALETTES, MOSAIC_SOCKET, glazeFor } from '../MosaicBoardView';
import { setColorScheme } from '../../theme';

/** CIE L*a*b* from sRGB hex - the colour space where distance tracks what
 * an eye actually sees. Plain RGB distance could not tell the problem
 * glaze from fine ones: a pale aqua is as far from sand in RGB as the old
 * pale ochre was, yet reads clearly because its hue is so different. */
function lab(hex: string): [number, number, number] {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/**
 * Regression test for set pieces that looked like empty holes on a phone:
 * one glaze (a pale sand-ochre, ΔE 24 from an empty socket) was all but the
 * socket's own colour. Every glaze must now stand well clear of it.
 */
test('every glaze stands clear of an empty socket (CIE76 ΔE >= 35)', () => {
  const socket = lab(MOSAIC_SOCKET);
  for (const [theme, glazes] of Object.entries(MOSAIC_PALETTES)) {
    for (const glaze of glazes) {
      const d = Math.hypot(...lab(glaze).map((v, i) => v - socket[i]));
      expect({ theme, glaze, clear: d >= 35 }).toEqual({ theme, glaze, clear: true });
    }
  }
});

/** And by night, on the dark grout bed - where the deepest glazes are
 * lifted (`glazeFor`) so a set piece never reads as a hole there either. */
test('by night too, every glaze as drawn stands clear of the dark socket', () => {
  setColorScheme('dark');
  try {
    const socket = lab(BED_NIGHT.socket);
    for (const [theme, glazes] of Object.entries(MOSAIC_PALETTES)) {
      for (const glaze of glazes) {
        const d = Math.hypot(...lab(glazeFor(glaze)).map((v, i) => v - socket[i]));
        expect({ theme, glaze, clear: d >= 35 }).toEqual({ theme, glaze, clear: true });
      }
    }
  } finally {
    setColorScheme('light');
  }
});

import { colors, getColorScheme } from './colors';

/**
 * Two small tone helpers for colours that are not a fixed token.
 */

/**
 * A wash of the page's own ink at `alpha` - for shadows, dents and pressed
 * states. By day it is the violet ink, as it always was; by night it is
 * black and a little stronger, since a violet shadow on a violet-black
 * ground is no shadow at all.
 */
export function inkWash(alpha: number): string {
  const a = getColorScheme() === 'dark' ? Math.min(1, alpha * 1.8) : alpha;
  return `rgba(${colors.inkRgb},${Number(a.toFixed(3))})`;
}

function channels(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/**
 * Page artwork at night: `hex` drawn `amount` of the way toward the dark
 * ground, so a blossom that is a bright accent on cream paper becomes a
 * quiet shape in the dark rather than a lamp. Unchanged by day, and for
 * anything that isn't a `#rrggbb` literal.
 */
export function nightTone(hex: string, amount = 0.3): string {
  if (getColorScheme() !== 'dark') return hex;
  const from = channels(hex);
  const to = channels(colors.background);
  if (!from || !to) return hex;
  const mix = from.map((c, i) => Math.round(c + (to[i] - c) * amount));
  return `#${mix.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

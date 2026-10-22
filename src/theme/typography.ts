import { Platform } from 'react-native';

/**
 * Typography for the Gravity design system.
 *
 * Direction: a printed-almanac feel. A characterful serif carries the
 * headings and the wordmark; a clean sans handles body text; a monospace is
 * used only for numeric readouts (par, puzzle count, streak). The scale is
 * wide so headings are confident and captions are genuinely small.
 *
 * Font sizes / line-heights are in density-independent pixels (dp).
 */
const serifFamily = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const uiFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
/** Every number in the game, in one face: Avenir Next, whose figures are
 * crisp, even and all one height. Counts used to be set in Menlo, a
 * programmer's monospace, and medal numbers in Times - two faces, and the
 * first looked like a terminal. Pair with `fontVariant: ['tabular-nums']`
 * where a count changes in place, so it does not jiggle. */
const numberFamily = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });
const monoFamily = numberFamily;
const figureFamily = numberFamily;

export const typography = {
  /** The default UI family. Prefer `families.*` in new code. */
  fontFamily: uiFamily,

  families: {
    /** Headings, titles, the wordmark. */
    display: serifFamily,
    ui: uiFamily,
    /** Numeric readouts only. */
    mono: monoFamily,
    /** A number standing on its own in a medal or a badge. */
    figures: figureFamily,
  },

  sizes: {
    micro: 12,
    caption: 13,
    body: 15,
    subtitle: 17,
    title: 22,
    headline: 28,
    display: 40,
    mega: 54,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  lineHeights: {
    micro: 15,
    caption: 17,
    body: 21,
    subtitle: 23,
    title: 28,
    headline: 33,
    display: 44,
    mega: 56,
  },

  /** Extra tracking for small uppercase labels and the wordmark. */
  tracking: {
    eyebrow: 1.4,
    wordmark: 3,
  },
} as const;

export type ThemeTypography = typeof typography;

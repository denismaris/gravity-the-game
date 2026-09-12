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
const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const typography = {
  /** The default UI family. Prefer `families.*` in new code. */
  fontFamily: uiFamily,

  families: {
    /** Headings, titles, the wordmark. */
    display: serifFamily,
    ui: uiFamily,
    /** Numeric readouts only. */
    mono: monoFamily,
  },

  sizes: {
    micro: 11,
    caption: 12.5,
    body: 15,
    subtitle: 17,
    title: 21,
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
    micro: 14,
    caption: 16,
    body: 21,
    subtitle: 23,
    title: 27,
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

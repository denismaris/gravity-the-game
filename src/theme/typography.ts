import { Platform } from 'react-native';

/**
 * Typography scale for the Gravity design system.
 * Font sizes/line-heights are in density-independent pixels (dp).
 */
export const typography = {
  fontFamily: Platform.select({
    android: 'sans-serif',
    ios: 'System',
    default: 'System',
  }),

  sizes: {
    caption: 12,
    body: 16,
    subtitle: 18,
    title: 24,
    headline: 32,
    display: 48,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  lineHeights: {
    caption: 16,
    body: 22,
    subtitle: 24,
    title: 30,
    headline: 38,
    display: 56,
  },
} as const;

export type ThemeTypography = typeof typography;

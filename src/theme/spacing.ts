/**
 * Spacing scale used for margins, padding and layout gaps.
 * Based on a 4px baseline grid.
 */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export type ThemeSpacing = typeof spacing;

/** Corner radii used across cards, buttons and modals. */
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export type ThemeRadii = typeof radii;

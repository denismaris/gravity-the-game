/**
 * Core color palette for the Gravity design system.
 *
 * Keep this file as the single source of truth for color values.
 * Screens/components should reference `theme.colors.*` rather than
 * hard-coding hex values.
 */
export const colors = {
  background: '#0B0E14',
  surface: '#141926',
  surfaceAlt: '#1D2436',

  primary: '#5B8CFF',
  secondary: '#FF6B6B',
  accent: '#FFD166',

  textPrimary: '#F5F7FA',
  textSecondary: '#9AA5B8',
  textDisabled: '#5A637A',

  success: '#4CD97B',
  warning: '#FFB020',
  danger: '#FF4D4D',

  border: '#242C40',
  overlay: 'rgba(0, 0, 0, 0.55)',
  transparent: 'transparent',
} as const;

export type ThemeColors = typeof colors;

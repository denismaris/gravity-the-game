/**
 * Core color palette for the Gravity design system.
 *
 * Direction: a warm printed-almanac feel. Cream paper, ink text, one muted
 * red accent used sparingly, ochre for stars. Light, calm, airy. Hierarchy
 * comes from a real paper/card contrast plus generous space - never from a
 * spread of colours. The board keeps functional colour so its four object
 * types stay instantly readable on the paper ground.
 *
 * Keep this file as the single source of truth for colour values.
 */
export const colors = {
  // --- paper ---
  background: '#F3EEE3', // warm cream ground
  surface: '#FBF8F1', // cards, panels, board cells - a touch lighter than the ground
  surfaceAlt: '#EAE2D2', // pressed, or a completed chip
  surfaceHi: '#FFFFFF', // the brightest tappable surface

  border: '#E4DBC8', // soft rule
  borderStrong: '#CFC3A9', // card edge / focus

  // --- ink + accent ---
  primary: '#2A251F', // ink - primary buttons are ink on cream
  secondary: '#B4472E', // muted terracotta - portals, and the one accent
  accent: '#B7892F', // ochre - target rings and stars only

  textPrimary: '#2A251F', // ink
  textSecondary: '#726A5C', // warm grey
  textTertiary: '#9E9482', // faint warm grey
  textDisabled: '#BDB4A0',

  success: '#5C7C4A', // muted leaf green - a piece resting on its target
  warning: '#B7892F',
  danger: '#B4472E',

  overlay: 'rgba(42, 37, 31, 0.32)',
  transparent: 'transparent',

  // --- board object colours (functional, tuned for the cream ground) ---
  pieceBlue: '#3E5C99', // movable object

  // Gravity zone: a faint tint + border + directional chevrons.
  zoneFill: 'rgba(62, 92, 153, 0.08)',
  zoneBorder: 'rgba(62, 92, 153, 0.34)',
  zoneArrow: 'rgba(62, 92, 153, 0.40)',
} as const;

export type ThemeColors = typeof colors;

import { colors } from './colors';
import { motion } from './motion';
import { radii, spacing } from './spacing';
import { typography } from './typography';

/**
 * The Gravity design system.
 *
 * This is intentionally a plain object (not a React Context) so it can be
 * imported from anywhere - including the framework-agnostic game engine's
 * rendering layer - without depending on React. Light and dark are both
 * served through it: `colors` reads the active palette live (see
 * `colors.ts`), and static stylesheets use `themedStyles`.
 */
export const theme = {
  colors,
  spacing,
  radii,
  typography,
  motion,
} as const;

export type Theme = typeof theme;

export { colors, motion, radii, spacing, typography };
export type { ColorScheme, ThemeColors } from './colors';
export { colorOverridesKey, getColorScheme, paletteFor, setColorOverrides, setColorScheme } from './colors';
export type { ColorToken, Palette } from './palettes';
export { darkColors, lightColors } from './palettes';
export { themedStyles } from './styles';
export { inkWash, nightTone } from './tones';

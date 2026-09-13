import { colors } from './colors';
import { motion } from './motion';
import { radii, spacing } from './spacing';
import { typography } from './typography';

/**
 * The Gravity design system.
 *
 * This is intentionally a plain object (not a React Context) so it can be
 * imported from anywhere - including the framework-agnostic game engine's
 * rendering layer - without depending on React.
 *
 * If runtime theme switching (e.g. light/dark) is needed later, wrap this
 * in a ThemeProvider/useTheme hook without changing the shape of `theme`.
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

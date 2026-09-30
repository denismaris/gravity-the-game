import { ColorToken, darkColors, lightColors, Palette } from './palettes';

/**
 * The colour palette in use - light (the almanac by day) or dark (the same
 * almanac by lamplight). See `palettes.ts` for the values and why the dark
 * one is not a plain inversion.
 *
 * `colors` is read *live*: every token is a getter onto whichever palette
 * is active, so `theme.colors.surface` read during a render is always the
 * current one. That keeps every existing call site - Skia props, inline
 * styles, the rendering layer, all of which import this plain object
 * rather than a hook - working unchanged across a switch. Static
 * stylesheets go through `themedStyles` (see `styles.ts`), which builds
 * one sheet per palette on first use.
 *
 * Only `AppearanceProvider` switches the palette, and it remounts the
 * screen when it does, so nothing keeps a colour it read before.
 */

export type ColorScheme = 'light' | 'dark';

let activeScheme: ColorScheme = 'light';
let activePalette: Palette = lightColors;
/** Tokens repainted by the player's worn game skins (see the shop), by
 * palette. Empty unless a skin is worn. */
let overrides: Readonly<Record<ColorScheme, Readonly<Record<string, string>>>> = { light: {}, dark: {} };
let overridesKey = '';

export function paletteFor(scheme: ColorScheme): Palette {
  return scheme === 'dark' ? darkColors : lightColors;
}

export function getColorScheme(): ColorScheme {
  return activeScheme;
}

/** Switches the palette every `colors` read sees from now on. Called by
 * `AppearanceProvider` (and tests) - nothing else should need to. */
export function setColorScheme(scheme: ColorScheme): void {
  activeScheme = scheme;
  activePalette = paletteFor(scheme);
}

/** Sets the skin repaints. Idempotent - the same repaints again change
 * nothing, so it is safe to call on every render. */
export function setColorOverrides(light: Readonly<Record<string, string>>, dark: Readonly<Record<string, string>>): void {
  const key = JSON.stringify([light, dark]);
  if (key === overridesKey) return;
  overridesKey = key;
  overrides = { light, dark };
}

/** Changes whenever the repaints do - part of a themed sheet's cache key. */
export function colorOverridesKey(): string {
  return overridesKey;
}

export const colors = {} as Palette;
for (const key of Object.keys(lightColors) as ColorToken[]) {
  Object.defineProperty(colors, key, { enumerable: true, get: () => overrides[activeScheme][key] ?? activePalette[key] });
}

export type ThemeColors = Palette;

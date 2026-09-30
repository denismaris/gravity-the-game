import { StyleSheet } from 'react-native';
import { colorOverridesKey, getColorScheme } from './colors';

/** Whatever `StyleSheet.create` accepts - read off it, since React Native
 * does not export the type under a public name. */
type StylesInput = Parameters<typeof StyleSheet.create>[0];

/**
 * `StyleSheet.create`, once per palette.
 *
 * A stylesheet created at module load reads `theme.colors` exactly once,
 * so it would keep the light palette forever. This takes the same object
 * literal as a factory instead and builds the sheet for the active palette
 * on first use - and again, separately, the first time the other palette
 * is used - so a style is always read in the current palette at render
 * time. Usage is the same as `StyleSheet.create`:
 *
 *     const styles = themedStyles(() => ({ card: { backgroundColor: theme.colors.surface } }));
 */
export function themedStyles<S extends StylesInput>(factory: () => S & StylesInput): Readonly<S> {
  // Keyed by palette and by the skin repaints in force, so a sheet that
  // uses a repainted token is rebuilt when the skin changes.
  const sheets: Record<string, Readonly<S>> = {};
  const current = (): Readonly<S> => {
    const scheme = `${getColorScheme()}|${colorOverridesKey()}`;
    const existing = sheets[scheme];
    if (existing) return existing;
    const sheet = StyleSheet.create(factory());
    sheets[scheme] = sheet;
    return sheet;
  };
  return new Proxy({} as Readonly<S>, {
    get: (_target, key) => current()[key as keyof S],
    has: (_target, key) => key in (current() as object),
    ownKeys: () => Reflect.ownKeys(current() as object),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(current(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}

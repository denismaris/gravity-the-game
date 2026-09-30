import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { darkColors, getColorScheme, inkWash, lightColors, nightTone, setColorScheme, theme, themedStyles } from '..';
import { AppearanceProvider, resolveScheme, SettingsProvider, SETTINGS_KEY, useAppearance, useHoldAppearance, useSettings } from '../../settings';
import { createMemoryBackend } from '../../storage';

/**
 * Light and dark: one set of tokens in two palettes, read live, and a
 * provider that picks between them without ever throwing away a puzzle in
 * progress.
 */

afterEach(() => setColorScheme('light'));

describe('the palettes', () => {
  test('every token exists in both, and none is left undefined', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
    for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) expect(typeof value).toBe('string');
  });

  test('`theme.colors` reads whichever palette is on, live', () => {
    const paper = theme.colors.background;
    expect(paper).toBe(lightColors.background);
    setColorScheme('dark');
    expect(theme.colors.background).toBe(darkColors.background);
    expect(theme.colors.textPrimary).toBe(darkColors.textPrimary);
    setColorScheme('light');
    expect(theme.colors.background).toBe(paper);
  });

  test('dark body type clears AA on every dark surface', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map(i => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const ground of [darkColors.background, darkColors.surface, darkColors.surfaceHi]) {
      for (const ink of [darkColors.textPrimary, darkColors.textSecondary, darkColors.textTertiary]) {
        expect(contrast(ink, ground)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('stylesheets', () => {
  test('a themed sheet is built per palette, and reads the one that is on', () => {
    const styles = themedStyles(() => ({ card: { backgroundColor: theme.colors.surface } }));
    expect(styles.card.backgroundColor).toBe(lightColors.surface);
    setColorScheme('dark');
    expect(styles.card.backgroundColor).toBe(darkColors.surface);
    setColorScheme('light');
    expect(styles.card.backgroundColor).toBe(lightColors.surface);
  });

  test('washes and page art follow the night', () => {
    expect(inkWash(0.2)).toBe('rgba(59,31,82,0.2)');
    expect(nightTone('#C46C33')).toBe('#C46C33');
    setColorScheme('dark');
    expect(inkWash(0.2)).toBe('rgba(0,0,0,0.36)');
    expect(nightTone('#C46C33')).not.toBe('#C46C33');
  });
});

describe('choosing the palette', () => {
  test('System follows the phone; Light and Dark override it', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  test('the provider applies the saved choice, and a hold keeps the palette until it is released', async () => {
    let seen: string[] = [];
    let api!: ReturnType<typeof useSettings>;
    function Probe({ hold }: { hold: boolean }): null {
      api = useSettings();
      useHoldAppearance(hold);
      seen.push(useAppearance());
      return null;
    }
    const backend = createMemoryBackend({ [SETTINGS_KEY]: JSON.stringify({ version: 1, appearance: 'dark' }) });
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const tree = (hold: boolean) => (
      <SettingsProvider backend={backend}>
        <AppearanceProvider>
          <Probe hold={hold} />
        </AppearanceProvider>
      </SettingsProvider>
    );
    await act(async () => {
      renderer = ReactTestRenderer.create(tree(false));
    });
    expect(seen[seen.length - 1]).toBe('dark');
    expect(getColorScheme()).toBe('dark');

    // A puzzle is open: the player switches to Light, and it waits.
    await act(async () => renderer.update(tree(true)));
    await act(async () => api.setAppearance('light'));
    expect(getColorScheme()).toBe('dark');

    // They leave the puzzle: now it lands.
    seen = [];
    await act(async () => renderer.update(tree(false)));
    expect(getColorScheme()).toBe('light');
    expect(seen[seen.length - 1]).toBe('light');
    await act(async () => renderer.unmount());
  });
});

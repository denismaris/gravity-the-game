import { contrastRatio, readableOn } from '../color';
import { darkColors, lightColors } from '../../../theme/palettes';

/** Every game's accent, used as status text in the header and on the
 * finish screen, must read on the page in both themes. */
describe('readableOn', () => {
  const accents = (palette: Record<string, string>) => Object.entries(palette).filter(([k, v]) => k.endsWith('Accent') && /^#[0-9a-f]{6}$/i.test(v));

  test.each([
    ['light', lightColors],
    ['dark', darkColors],
  ])('every accent reaches 4.5:1 on the %s page', (_name, palette) => {
    const p = palette as unknown as Record<string, string>;
    for (const [key, color] of accents(p)) {
      const ink = readableOn(color, p.background, p.textPrimary);
      expect([key, contrastRatio(ink, p.background) >= 4.5]).toEqual([key, true]);
    }
  });

  test('leaves an accent that already reads untouched', () => {
    expect(readableOn('#3B1F52', '#EDE5D3', '#3B1F52')).toBe('#3B1F52');
  });
});

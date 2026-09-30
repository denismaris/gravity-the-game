import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';
import { COSMETICS, RARITY_PRICES, SKIN_GAMES, buyCosmetic, cosmeticsFor, equipCosmetic, rarityOf, skinOverrides } from '../shop';
import { lightColors, setColorOverrides, setColorScheme, theme } from '../../theme';
import { MOSAIC_PALETTES } from '../../components/MosaicBoardView';

afterEach(() => {
  setColorOverrides({}, {});
  setColorScheme('light');
});

describe('game skins', () => {
  test('every game but Bridges has its Classic look and two sets; Bridges keeps its charts', () => {
    for (const game of SKIN_GAMES) {
      const items = cosmeticsFor(`skin-${game}`);
      expect(items[0].price).toBe(0);
      expect(items.filter(i => i.price > 0)).toHaveLength(2);
    }
    expect(cosmeticsFor('chart').filter(i => i.price > 0).length).toBeGreaterThanOrEqual(3);
  });

  test('a skin only names real palette tokens', () => {
    for (const item of COSMETICS) {
      for (const token of [...Object.keys(item.tokens ?? {}), ...Object.keys(item.darkTokens ?? {})]) {
        expect(Object.keys(lightColors)).toContain(token);
      }
    }
  });

  test('every price sits on a rarity tier', () => {
    const tiers = Object.values(RARITY_PRICES);
    for (const item of COSMETICS) if (item.price > 0) expect(tiers).toContain(item.price);
    expect(rarityOf(COSMETICS.find(i => i.id === 'confetti-aurora')!)).toBe('masterwork');
  });

  test('worn, a skin repaints its game; taken off, the game is itself again', () => {
    let p: PlayerProgress = buyCosmetic({ ...emptyProgress(), coins: 5000 }, 'skin-lightsout-ice')!;
    const { light, dark } = skinOverrides(p);
    setColorOverrides(light, dark);
    expect(theme.colors.lightsOutLit).toBe('#9FD8FF');
    p = equipCosmetic(p, 'skin-lightsout-classic');
    const off = skinOverrides(p);
    setColorOverrides(off.light, off.dark);
    expect(theme.colors.lightsOutLit).toBe(lightColors.lightsOutLit);
  });

  test('a night-specific value wins after dark', () => {
    const p = buyCosmetic({ ...emptyProgress(), coins: 5000 }, 'skin-bloom-lavender')!;
    const { light, dark } = skinOverrides(p);
    setColorOverrides(light, dark);
    expect(theme.colors.bloomAccent).toBe('#8E6FC7');
    setColorScheme('dark');
    expect(theme.colors.bloomAccent).toBe('#B49BE6');
  });

  test('every worn slot - page art included - survives a relaunch', () => {
    let p: PlayerProgress = { ...emptyProgress(), coins: 9000 };
    for (const id of ['garden-camellia', 'skin-tents-ochre', 'confetti-gold']) p = buyCosmetic(p, id)!;
    const back = parseProgress(JSON.stringify(p));
    expect(back.equipped.garden).toBe('garden-camellia');
    expect(back.equipped['skin-tents']).toBe('skin-tents-ochre');
    expect(back.equipped.confetti).toBe('confetti-gold');
  });
});

/** CIE L*a*b*, as in `mosaicPalette.test.ts`. */
function lab(hex: string): [number, number, number] {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

test('a Mosaic grout skin never swallows a glaze (ΔE >= 30), by day', () => {
  for (const item of cosmeticsFor('skin-mosaic').filter(i => i.tokens)) {
    const socket = lab(item.tokens!.mosaicSocket);
    for (const glazes of Object.values(MOSAIC_PALETTES)) {
      for (const glaze of glazes) {
        const d = Math.hypot(...lab(glaze).map((v, i) => v - socket[i]));
        expect({ item: item.id, glaze, clear: d >= 30 }).toEqual({ item: item.id, glaze, clear: true });
      }
    }
  }
});

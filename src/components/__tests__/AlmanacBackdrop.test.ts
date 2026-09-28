import { blossomPath, composeBloom, leafPath } from '../AlmanacBackdrop';
import { composeFooter } from '../PageBloom';

/** Pulls every number out of an SVG path string. */
function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('bloom geometry', () => {
  test('a blossom is one closed path of arcs, finite throughout', () => {
    const d = blossomPath(100, 100, 60, 7, 11, 0.2);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/A /g)).toHaveLength(7);
    for (const n of numbers(d)) expect(Number.isFinite(n)).toBe(true);
  });

  /** The irregularity is deliberate (see the component) but must be
   * repeatable, or Home's art would change on every render. */
  test('the same seed draws the same blossom, a different one does not', () => {
    expect(blossomPath(50, 50, 40, 6, 5, 0)).toBe(blossomPath(50, 50, 40, 6, 5, 0));
    expect(blossomPath(50, 50, 40, 6, 5, 0)).not.toBe(blossomPath(50, 50, 40, 6, 6, 0));
  });

  test('a leaf is finite and closed', () => {
    const d = leafPath(0, 0, 40, -30, 12);
    expect(d.endsWith('Z')).toBe(true);
    for (const n of numbers(d)) expect(Number.isFinite(n)).toBe(true);
  });

  test('nothing is drawn before the card has been measured', () => {
    expect(composeBloom(390, 844, { x: 24, y: 0, width: 0, height: 0 })).toBeNull();
    expect(composeBloom(0, 0, { x: 24, y: 280, width: 342, height: 400 })).toBeNull();
  });

  test('a real layout yields the full composition', () => {
    const art = composeBloom(402, 874, { x: 24, y: 284, width: 354, height: 400 });
    expect(art).not.toBeNull();
    expect(art!.blossoms).toHaveLength(3);
    expect(art!.stems).toHaveLength(2);
    expect(art!.rules).toHaveLength(3);
  });
});

describe('page footer bloom', () => {
  test('is finite everywhere and keeps to the two bottom corners', () => {
    const art = composeFooter(402, 874);
    const all = [art.blossom, art.stem, art.dome, ...art.leaves].flatMap(numbers);
    for (const n of all) expect(Number.isFinite(n)).toBe(true);
    // Nothing reaches the middle band where each screen's pills sit.
    for (const r of art.rules) expect(r.x).toBeGreaterThan(402 / 2);
    expect(art.disc.cx).toBeGreaterThan(402 / 2);
  });
});

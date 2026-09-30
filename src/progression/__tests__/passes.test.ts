import { emptyProgress, PlayerProgress } from '../playerProgress';
import { dealtTierOf, generateBatch, replaceInBatch } from '../batches';
import { errandsFor } from '../errands';
import { LUCKY_CHARM_CHARGES, LUCKY_CHARM_PRICE, MAX_LUCKY_CHARGES, RETIRE_PRICES, buyLuckyCharm, reinstateGame, retireGame, retirePrice } from '../shop';
import { GameKind } from '../../game/journey';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('retiring a game', () => {
  test('costs more each time, stops at three, and bringing one back is free', () => {
    let p: PlayerProgress = { ...emptyProgress(), coins: 5000 };
    const kinds: GameKind[] = ['mosaic', 'towers', 'adjacent'];
    kinds.forEach((kind, i) => {
      expect(retirePrice(p)).toBe(RETIRE_PRICES[i]);
      p = retireGame(p, kind)!;
    });
    expect(p.coins).toBe(5000 - RETIRE_PRICES.reduce((a, b) => a + b, 0));
    expect(retirePrice(p)).toBeNull();
    expect(retireGame(p, 'bloom')).toBeNull();
    const back = reinstateGame(p, 'towers');
    expect(back.retired).toEqual(['mosaic', 'adjacent']);
    expect(back.coins).toBe(p.coins);
  });

  test('a retired game is never dealt into a level set', () => {
    const retired: GameKind[] = ['mosaic', 'towers', 'gravity'];
    const p = { ...emptyProgress(), retired };
    for (let seed = 1; seed < 120; seed += 1) {
      const batch = generateBatch(20 + (seed % 30), p, null, seeded(seed));
      for (const ref of batch.puzzles) expect(retired).not.toContain(ref.kind);
    }
  });

  test('nor ever sent to on an errand', () => {
    for (let d = 1; d <= 28; d += 1) {
      const day = `2026-10-${String(d).padStart(2, '0')}`;
      expect(errandsFor(day, ['bridges', 'mosaic'])[1].game).not.toMatch(/^(bridges|mosaic)$/);
    }
  });
});

describe('swapping a puzzle', () => {
  test('replaces only the unfinished slots asked for, with another game at the same tier', () => {
    const p = { ...emptyProgress(), retired: ['bloom'] as GameKind[] };
    const batch = generateBatch(24, p, null, seeded(7));
    const done = batch.puzzles[0].puzzleId;
    const target = batch.puzzles[1];
    const withDone = { ...batch, completedPuzzleIds: [done] };
    const next = replaceInBatch(withDone, [done, target.puzzleId], p, seeded(3));
    expect(next.puzzles[0]).toEqual(batch.puzzles[0]);
    expect(next.puzzles[1].kind).not.toBe(target.kind);
    expect(next.puzzles[1].kind).not.toBe('bloom');
    expect(dealtTierOf(next.puzzles[1])).toBe(dealtTierOf(target));
    expect(Boolean(next.puzzles[1].challenge)).toBe(Boolean(target.challenge));
    expect(next.puzzles.slice(2)).toEqual(batch.puzzles.slice(2));
  });
});

describe('the lucky charm', () => {
  test('adds charges, capped', () => {
    let p: PlayerProgress | null = { ...emptyProgress(), coins: 5000 };
    p = buyLuckyCharm(p!)!;
    expect(p.luckyCharges).toBe(LUCKY_CHARM_CHARGES);
    expect(p.coins).toBe(5000 - LUCKY_CHARM_PRICE);
    while (p && p.luckyCharges + LUCKY_CHARM_CHARGES <= MAX_LUCKY_CHARGES) p = buyLuckyCharm(p);
    expect(buyLuckyCharm(p!)).toBeNull();
  });
});

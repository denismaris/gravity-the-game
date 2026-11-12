import type { GameKind } from '../../game/journey';
import type { PuzzleDifficulty } from '../../game/puzzleDifficulty';
import {
  AdaptiveState,
  dealerFor,
  dealWeight,
  enjoyment,
  freshAdaptive,
  slotShift,
  withNewDay,
  rate,
  skillShift,
  skipWeight,
  solveOutcome,
  withAbandon,
  withContinued,
  withSkip,
  withSolve,
} from '../adaptive';
import { dealtTierOf, easeInBatch, generateBatch, isBatchComplete, markPuzzleCompleted, nextInBatch, replaceInBatch } from '../batches';
import { emptyProgress, PlayerProgress } from '../playerProgress';

/** A seeded generator (Park-Miller), so every run plays the same. */
function mulberry(seed: number): () => number {
  let x = (seed % 2147483646) + 1;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

type Action = { type: 'solve'; stars: 1 | 2 | 3; ms: number; restarts: number; next: boolean } | { type: 'abandon'; ms: number } | { type: 'skip' };
type Player = (tier: PuzzleDifficulty, kind: GameKind, rng: () => number) => Action;

const BASE = { easy: 40000, medium: 80000, hard: 150000 };

/** Always three stars, quick, and straight on to the next. */
const strong: Player = tier => ({ type: 'solve', stars: 3, ms: BASE[tier] * 0.6, restarts: 0, next: true });

/** Slow, leans on hints, restarts, and often gives up on the harder ones. */
const struggling: Player = (tier, _kind, rng) => {
  if (tier === 'hard' && rng() < 0.6) return { type: 'abandon', ms: 70000 };
  if (tier === 'medium' && rng() < 0.3) return { type: 'abandon', ms: 50000 };
  return { type: 'solve', stars: tier === 'easy' ? 2 : 1, ms: BASE[tier] * 1.9, restarts: tier === 'easy' ? 1 : 2, next: rng() < 0.5 };
};

/** Brilliant at easy and medium; quits every hard one, however good. */
const frustratedByHard: Player = tier => (tier === 'hard' ? { type: 'abandon', ms: 45000 } : { type: 'solve', stars: 3, ms: BASE[tier] * 0.6, restarts: 0, next: true });

/**
 * Plays `sets` level sets through the real dealer and reports the mix of
 * tiers dealt in the last `measure` of them. An abandoned board is tried
 * again until solved (a player cannot move on otherwise).
 */
function simulate(
  player: Player,
  sets: number,
  measure: number,
  adapt: boolean,
  seed = 7,
  skipKind?: GameKind,
): { tiers: Record<PuzzleDifficulty, number>; kinds: Map<GameKind, number>; byKind: Map<GameKind, Record<PuzzleDifficulty, number>>; state: AdaptiveState } {
  const rng = mulberry(seed);
  let ad = freshAdaptive();
  const dealer = dealerFor(
    () => ad,
    next => {
      ad = next;
    },
    adapt,
  );
  let progress: PlayerProgress = emptyProgress();
  progress = { ...progress, currentBatch: generateBatch(1, progress, null, rng, dealer) };
  const tiers: Record<PuzzleDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const kinds = new Map<GameKind, number>();
  const byKind = new Map<GameKind, Record<PuzzleDifficulty, number>>();
  for (let set = 0; set < sets; set += 1) {
    const counting = set >= sets - measure;
    for (let guard = 0; guard < 40; guard += 1) {
      const batch = progress.currentBatch!;
      const ref = nextInBatch(batch);
      if (!ref) break;
      const tier = dealtTierOf(ref);
      if (skipKind && ref.kind === skipKind) {
        const replaced = replaceInBatch(batch, [ref.puzzleId], progress, rng, dealer);
        if (replaced.puzzles.some(p => p.puzzleId !== ref.puzzleId && batch.puzzles.every(q => q.puzzleId !== p.puzzleId))) {
          ad = withSkip(ad, { puzzleId: ref.puzzleId, kind: ref.kind });
          progress = { ...progress, currentBatch: replaced };
          continue;
        }
      }
      let action = player(tier, ref.kind, rng);
      if (action.type === 'abandon') {
        ad = withAbandon(ad, { puzzleId: ref.puzzleId, kind: ref.kind, tier, ms: action.ms });
        action = { type: 'solve', stars: 1, ms: BASE[tier] * 2.2, restarts: 1, next: false };
      }
      if (action.type !== 'solve') continue;
      if (counting) {
        tiers[tier] += 1;
        kinds.set(ref.kind, (kinds.get(ref.kind) ?? 0) + 1);
        const own = byKind.get(ref.kind) ?? { easy: 0, medium: 0, hard: 0 };
        own[tier] += 1;
        byKind.set(ref.kind, own);
      }
      ad = withSolve(ad, { puzzleId: ref.puzzleId, kind: ref.kind, tier, stars: action.stars, ms: action.ms, restarts: action.restarts });
      if (action.next) ad = withContinued(ad);
      const levels = { ...progress.levels, [ref.puzzleId]: { completed: true as const, stars: action.stars, bestMoves: 0 } };
      const updated = markPuzzleCompleted(batch, ref.puzzleId);
      progress = { ...progress, levels };
      progress = isBatchComplete(updated)
        ? { ...progress, currentLevel: progress.currentLevel + 1, currentBatch: generateBatch(progress.currentLevel + 1, progress, updated, rng, dealer) }
        : { ...progress, currentBatch: updated };
    }
  }
  return { tiers, kinds, byKind, state: ad };
}

const share = (t: Record<PuzzleDifficulty, number>, tier: PuzzleDifficulty) => t[tier] / (t.easy + t.medium + t.hard);

describe('the learning, on its own', () => {
  test('a better solve scores higher, and a slow one with restarts lower', () => {
    expect(solveOutcome(3, 30000, 60000, 0)).toBeGreaterThan(solveOutcome(2, 60000, 60000, 0));
    expect(solveOutcome(1, 120000, 60000, 3)).toBeLessThan(solveOutcome(2, 60000, 60000, 0));
  });

  test('ratings climb on strong results and fall on weak ones', () => {
    let up = { r: 0, n: 0 };
    let down = { r: 0, n: 0 };
    for (let i = 0; i < 10; i += 1) {
      up = rate(up, 'medium', 0.95);
      down = rate(down, 'medium', 0.1);
    }
    expect(up.r).toBeGreaterThan(1);
    expect(down.r).toBeLessThan(-0.6);
  });

  test('a game swapped away is held back, and recovers as other games are played', () => {
    let s = freshAdaptive();
    s = withSkip(withSkip(withSkip(s, { puzzleId: 'a', kind: 'glass' }), { puzzleId: 'b', kind: 'glass' }), { puzzleId: 'c', kind: 'glass' });
    const held = skipWeight(s, 'glass');
    expect(held).toBeLessThan(0.5);
    for (let i = 0; i < 20; i += 1) s = withSolve(s, { puzzleId: `x${i}`, kind: 'lightsout', tier: 'easy', stars: 3, ms: 30000, restarts: 0 });
    expect(skipWeight(s, 'glass')).toBeGreaterThan(held);
  });

  test('skill alone needs a few solves before it shifts anything', () => {
    let s = freshAdaptive();
    s = withSolve(s, { puzzleId: 'a', kind: 'mosaic', tier: 'medium', stars: 3, ms: 10000, restarts: 0 });
    expect(skillShift(s, 'mosaic')).toBe(0);
  });
});

/** A player's tier mix, averaged over a few seeded runs, so a test checks
 * the behaviour, not one lucky draw. */
function mix(player: Player, adapt: boolean, seeds = [1, 2, 3, 4]): Record<PuzzleDifficulty, number> {
  const out: Record<PuzzleDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const seed of seeds) {
    const run = simulate(player, 70, 25, adapt, seed);
    for (const tier of ['easy', 'medium', 'hard'] as const) out[tier] += share(run.tiers, tier) / seeds.length;
  }
  return out;
}

describe('simulated players', () => {
  // Each check plays a few hundred sets; give them room on a slow machine.
  jest.setTimeout(60000);
  const plain = mix(strong, false);

  /** A step harder, not all hard: the set's guard rails (never two hard
   * in a row, an easy one in every set) still have the last word. */
  test('a strong player is dealt harder puzzles than without it', () => {
    const run = mix(strong, true);
    expect(run.hard).toBeGreaterThan(plain.hard + 0.02);
    expect(run.easy).toBeLessThan(plain.easy - 0.02);
  });

  test('a struggling player is dealt easier puzzles than without it', () => {
    const run = mix(struggling, true);
    expect(run.easy).toBeGreaterThan(mix(struggling, false).easy + 0.1);
    expect(run.hard).toBeLessThan(plain.hard - 0.05);
  });

  test('a good player who quits the hard ones is not pushed harder: it learns they enjoy it gentler', () => {
    const run = mix(frustratedByHard, true);
    expect(run.hard).toBeLessThan(mix(strong, true).hard - 0.04);
    expect(run.easy).toBeGreaterThan(plain.easy + 0.05);
    // The bandit has learned that "a bit harder" goes badly for them.
    const [easier, , harder] = simulate(frustratedByHard, 70, 25, true, 1).state.arms;
    expect(harder.a / (harder.a + harder.b)).toBeLessThan(easier.a / (easier.a + easier.b));
  });

  test('a game the player keeps skipping is dealt less', () => {
    const SETS = 70;
    const MEASURE = 25;
    const plainRun = simulate(strong, SETS, MEASURE, false, 11);
    const skipping = simulate(strong, SETS, MEASURE, false, 11, 'glass');
    const total = (m: Map<GameKind, number>) => [...m.values()].reduce((x, y) => x + y, 0);
    expect((skipping.kinds.get('glass') ?? 0) / total(skipping.kinds)).toBeLessThan(((plainRun.kinds.get('glass') ?? 0) / total(plainRun.kinds)) * 0.7);
  });
});

describe('improvements', () => {
  jest.setTimeout(60000);

  test('taste is learned per game: hard Lanterns loved, other hard games quit', () => {
    const lovesHardLanterns: Player = (tier, kind) =>
      tier === 'hard' && kind !== 'lightsout' ? { type: 'abandon', ms: 45000 } : { type: 'solve', stars: 3, ms: BASE[tier] * 0.6, restarts: 0, next: true };
    const hard = { lanterns: 0, lanternsAll: 0, others: 0, othersAll: 0 };
    for (const seed of [1, 2, 3, 4]) {
      const run = simulate(lovesHardLanterns, 90, 40, true, seed);
      for (const [kind, t] of run.byKind) {
        const all = t.easy + t.medium + t.hard;
        if (kind === 'lightsout') {
          hard.lanterns += t.hard;
          hard.lanternsAll += all;
        } else {
          hard.others += t.hard;
          hard.othersAll += all;
        }
      }
    }
    expect(hard.lanterns / hard.lanternsAll).toBeGreaterThan(hard.others / hard.othersAll);
  });

  test('a solve far too easy is enjoyed less than one that was a real match', () => {
    expect(enjoyment(0.97, 0.95, 0)).toBeLessThan(enjoyment(0.6, 0.8, 0));
    expect(enjoyment(0.6, 0.8, 3)).toBeLessThan(enjoyment(0.6, 0.8, 0));
  });

  test('a rough patch eases the next puzzle of the set, same game, a step gentler', () => {
    let s = freshAdaptive();
    s = withAbandon(s, { puzzleId: 'a', kind: 'glass', tier: 'hard', ms: 60000 });
    s = withAbandon(s, { puzzleId: 'b', kind: 'glass', tier: 'hard', ms: 60000 });
    expect(s.strain).toBeGreaterThanOrEqual(2);
    // a set whose next puzzle is a hard one
    let progress = emptyProgress();
    const batch = {
      levelNumber: 20,
      puzzles: [{ kind: 'glass' as const, puzzleId: 'glass-easy-01' }, { kind: 'glass' as const, puzzleId: 'glass-hard-01', challenge: true, golden: true }, { kind: 'lightsout' as const, puzzleId: 'lightsout-easy-01' }],
      completedPuzzleIds: ['glass-easy-01'],
    };
    const hardAt = 1;
    expect(dealtTierOf(batch.puzzles[hardAt])).toBe('hard');
    progress = { ...progress, currentBatch: batch };
    const eased = easeInBatch(batch, progress);
    const before = batch.puzzles[hardAt];
    const after = eased.puzzles[hardAt];
    expect(after.kind).toBe(before.kind);
    expect(dealtTierOf(after)).toBe('medium');
    expect(after.challenge).toBeFalsy();
    expect(after.golden).toBe(true);
    // the rest of the set is untouched
    eased.puzzles.forEach((p, i) => i !== hardAt && expect(p.puzzleId).toBe(batch.puzzles[i].puzzleId));
  });

  test('after a long break the first puzzles are a warm-up, never pushed harder', () => {
    let s: AdaptiveState = { ...freshAdaptive(), lastDay: '2026-10-01', skill: { mosaic: { r: 2.5, n: 20 } } };
    expect(slotShift(s, 'mosaic', 2, false)).toBe(1);
    s = withNewDay(s, '2026-10-15');
    expect(s.warmUp).toBeGreaterThan(0);
    expect(slotShift(s, 'mosaic', 2, false)).toBe(0);
    for (let i = 0; i < 4; i += 1) s = withSolve(s, { puzzleId: `w${i}`, kind: 'mosaic', tier: 'medium', stars: 3, ms: 20000, restarts: 0 });
    expect(slotShift(s, 'mosaic', 2, false)).toBe(1);
    // a day or two away is not a break
    expect(withNewDay({ ...freshAdaptive(), lastDay: '2026-10-14' }, '2026-10-15').warmUp).toBe(0);
  });

  test('a favourite comes round a little more, a game left a little less, never far', () => {
    let s = freshAdaptive();
    for (let i = 0; i < 30; i += 1) {
      s = withSolve(s, { puzzleId: `m${i}`, kind: 'mosaic', tier: 'medium', stars: 3, ms: 30000, restarts: 0 });
      s = withContinued(s);
    }
    expect(dealWeight(s, 'mosaic')).toBeGreaterThan(1.1);
    expect(dealWeight(s, 'mosaic')).toBeLessThanOrEqual(1.2);
    for (let i = 0; i < 30; i += 1) s = withAbandon(s, { puzzleId: `b${i}`, kind: 'bridges', tier: 'medium', ms: 60000 });
    expect(dealWeight(s, 'bridges')).toBeLessThan(0.9);
    expect(dealWeight(s, 'bridges')).toBeGreaterThanOrEqual(0.8);
  });
});

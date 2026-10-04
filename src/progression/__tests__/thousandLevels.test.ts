import { emptyProgress, PlayerProgress } from '../playerProgress';
import { BatchState, generateBatch, markPuzzleCompleted } from '../batches';
import { dealtTierOf } from '../batches';
import { GameKind, ROTATION } from '../../game/journey';
import { isEndlessId } from '../../game/endlessId';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Plays `levels` level sets straight through, solving every puzzle. */
function playThrough(levels: number, start: PlayerProgress = emptyProgress()) {
  const rng = seeded(20260930);
  let progress = start;
  let batch: BatchState = generateBatch(1, progress, null, rng);
  const dealt: Array<{ level: number; kind: GameKind; id: string; tier: string; challenge: boolean; extreme: boolean }> = [];
  for (let level = 1; level <= levels; level += 1) {
    for (const ref of batch.puzzles) {
      dealt.push({ level, kind: ref.kind, id: ref.puzzleId, tier: dealtTierOf(ref), challenge: Boolean(ref.challenge), extreme: Boolean(ref.extreme) });
      progress = { ...progress, levels: { ...progress.levels, [ref.puzzleId]: { completed: true, stars: 3, bestMoves: 1 } } };
      batch = markPuzzleCompleted(batch, ref.puzzleId);
    }
    progress = { ...progress, currentLevel: level + 1 };
    batch = generateBatch(level + 1, progress, batch, rng);
  }
  return dealt;
}

/**
 * The promise the endless boards make: a thousand level sets, every puzzle
 * in them one the player has never seen, every game dealt its fair share,
 * and the difficulty curve holding all the way.
 */
describe('a thousand levels', () => {
  const dealt = playThrough(1000);

  test('never deals the same puzzle twice', () => {
    const ids = dealt.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(4500);
  });

  test('moves on to endless boards once a pool is used up', () => {
    expect(dealt.filter(d => isEndlessId(d.id)).length).toBeGreaterThan(dealt.length * 0.8);
  });

  test('deals every game its fair share', () => {
    const counts = new Map<GameKind, number>();
    for (const d of dealt) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    const mean = dealt.length / ROTATION.length;
    for (const kind of ROTATION) {
      expect((counts.get(kind) ?? 0) / mean).toBeGreaterThan(0.75);
      expect((counts.get(kind) ?? 0) / mean).toBeLessThan(1.25);
    }
  });

  // Hard boards come only in the signposted challenge slots - one in
  // the per-game arc - a promise made (and pinned by the batch tests)
  // long before endless boards; a thousand levels in, it still holds.
  test('from level 15 the mix is random but calm: easy in every level, never two challenges running, an easy one after every extreme', () => {
    const late = dealt.filter(d => d.level >= 15);
    const share = (pred: (d: (typeof dealt)[number]) => boolean) => late.filter(pred).length / late.length;
    expect(share(d => d.tier === 'easy')).toBeGreaterThan(0.25);
    expect(share(d => d.tier === 'medium')).toBeGreaterThan(0.2);
    expect(share(d => d.challenge)).toBeGreaterThan(0.15);
    expect(share(d => d.extreme)).toBeGreaterThan(0.03);
    // Hard only ever as a signposted challenge; every challenge hard.
    expect(dealt.filter(d => d.challenge).every(d => d.tier === 'hard')).toBe(true);
    expect(dealt.filter(d => d.tier === 'hard').every(d => d.challenge)).toBe(true);
    expect(dealt.filter(d => d.extreme).every(d => d.challenge)).toBe(true);
    for (let i = 1; i < dealt.length; i += 1) {
      if (dealt[i].level < 15) continue;
      expect(dealt[i - 1].challenge && dealt[i].challenge).toBe(false);
      if (dealt[i - 1].extreme) expect(dealt[i].tier).toBe('easy');
    }
    const levels = new Map<number, typeof dealt>();
    for (const d of late) levels.set(d.level, [...(levels.get(d.level) ?? []), d]);
    for (const set of levels.values()) {
      expect(set.some(d => d.tier === 'easy')).toBe(true);
      expect(set.filter(d => d.extreme).length).toBeLessThanOrEqual(1);
    }
  });

  test('every game ramps on its own: easy, then easy and medium, then challenges, then extremes', () => {
    const perGame = new Map<GameKind, typeof dealt>();
    for (const d of dealt) perGame.set(d.kind, [...(perGame.get(d.kind) ?? []), d]);
    for (const [, run] of perGame) {
      expect(run.slice(0, 3).every(d => d.tier === 'easy')).toBe(true);
      expect(run.slice(3, 6).every(d => d.tier === 'easy' || d.tier === 'medium')).toBe(true);
      expect(run.slice(0, 6).some(d => d.challenge)).toBe(false);
      expect(run.slice(0, 12).some(d => d.extreme)).toBe(false);
      expect(run.some(d => d.challenge)).toBe(true);
    }
  });


  test('a retired game stays out for the whole run', () => {
    const retired: GameKind[] = ['mosaic', 'gravity', 'towers'];
    const run = playThrough(200, { ...emptyProgress(), retired });
    expect(run.some(d => retired.includes(d.kind))).toBe(false);
    expect(new Set(run.map(d => d.id)).size).toBe(run.length);
  });
});

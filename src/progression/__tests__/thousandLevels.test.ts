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
  const dealt: Array<{ level: number; kind: GameKind; id: string; tier: string; challenge: boolean }> = [];
  for (let level = 1; level <= levels; level += 1) {
    for (const ref of batch.puzzles) {
      dealt.push({ level, kind: ref.kind, id: ref.puzzleId, tier: dealtTierOf(ref), challenge: Boolean(ref.challenge) });
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
  // `CHALLENGE_EVERY` - a promise made (and pinned by the batch tests)
  // long before endless boards; a thousand levels in, it still holds.
  test('keeps the curve: medium-led, hard only in the challenge slots, and every challenge hard', () => {
    const plateau = dealt.filter(d => d.level > 30);
    const share = (tier: string) => plateau.filter(d => d.tier === tier).length / plateau.length;
    expect(share('easy')).toBeLessThan(0.15);
    expect(share('medium')).toBeGreaterThan(0.5);
    expect(share('hard')).toBeGreaterThan(0.2);
    expect(share('hard')).toBeLessThan(0.3);
    expect(dealt.filter(d => d.challenge).every(d => d.tier === 'hard')).toBe(true);
  });

  test('a retired game stays out for the whole run', () => {
    const retired: GameKind[] = ['mosaic', 'gravity', 'towers'];
    const run = playThrough(200, { ...emptyProgress(), retired });
    expect(run.some(d => retired.includes(d.kind))).toBe(false);
    expect(new Set(run.map(d => d.id)).size).toBe(run.length);
  });
});

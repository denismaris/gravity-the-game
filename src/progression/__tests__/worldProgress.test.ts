import { FIRST_WORLD, WORLDS } from '../../game/worlds';
import { getStarThresholds, getLevelById } from '../../game/levels';
import { JOURNEY } from '../../game/journey';
import { emptyProgress, recordCompletion } from '../playerProgress';
import {
  getJourneyPoint,
  getUnlockedWorlds,
  getWorldSummary,
  isLevelUnlocked,
  isWorldComplete,
  isWorldUnlocked,
} from '../worldProgress';

const W1 = FIRST_WORLD;

/** Completes a level at its 3-star move count. */
function complete(progress: ReturnType<typeof emptyProgress>, levelId: string) {
  const level = getLevelById(levelId)!;
  return recordCompletion(progress, levelId, getStarThresholds(level).three, getStarThresholds(level));
}

/** Completes any puzzle id, from any game. */
function completeAny(progress: ReturnType<typeof emptyProgress>, puzzleId: string) {
  const level = getLevelById(puzzleId);
  const thresholds = level ? getStarThresholds(level) : { two: 3, three: 1 };
  return recordCompletion(progress, puzzleId, thresholds.three, thresholds);
}

describe('level unlocking within a world', () => {
  test('at the start only the first level of World 1 is unlocked', () => {
    const p = emptyProgress();
    expect(isLevelUnlocked(p, W1, W1.levelIds[0])).toBe(true);
    expect(isLevelUnlocked(p, W1, W1.levelIds[1])).toBe(false);
    expect(isLevelUnlocked(p, W1, W1.levelIds[19])).toBe(false);
  });

  test('completing a level unlocks exactly the next one', () => {
    let p = emptyProgress();
    p = complete(p, W1.levelIds[0]);

    expect(isLevelUnlocked(p, W1, W1.levelIds[1])).toBe(true);
    expect(isLevelUnlocked(p, W1, W1.levelIds[2])).toBe(false);
  });

  test('unlocking is chained, not all-or-nothing', () => {
    let p = emptyProgress();
    for (let i = 0; i < 5; i += 1) p = complete(p, W1.levelIds[i]);

    expect(isLevelUnlocked(p, W1, W1.levelIds[5])).toBe(true); // 6th
    expect(isLevelUnlocked(p, W1, W1.levelIds[6])).toBe(false); // 7th
  });

  test('replaying an already-completed early level does not lock later ones', () => {
    let p = emptyProgress();
    for (let i = 0; i < 3; i += 1) p = complete(p, W1.levelIds[i]);
    // Re-complete level 1 badly.
    const l1 = getLevelById(W1.levelIds[0])!;
    p = recordCompletion(p, W1.levelIds[0], 99, getStarThresholds(l1));

    expect(isLevelUnlocked(p, W1, W1.levelIds[3])).toBe(true); // 4th still unlocked
  });
});

describe('world unlocking', () => {
  const W2 = WORLDS.find(w => w.order === 2)!;

  test('World 1 is always unlocked; World 2 starts locked', () => {
    const p = emptyProgress();
    expect(isWorldUnlocked(p, W1)).toBe(true);
    expect(isWorldUnlocked(p, W2)).toBe(false);
    expect(getUnlockedWorlds(p).map(w => w.id)).toEqual(['world-1']);
  });

  test('World 2 unlocks only when every World 1 level is complete', () => {
    let p = emptyProgress();

    // 19 of 20 done - still locked.
    for (const id of W1.levelIds.slice(0, 19)) p = complete(p, id);
    expect(isWorldComplete(p, W1)).toBe(false);
    expect(isWorldUnlocked(p, W2)).toBe(false);

    p = complete(p, W1.levelIds[19]);
    expect(isWorldComplete(p, W1)).toBe(true);
    expect(isWorldUnlocked(p, W2)).toBe(true);
    expect(getUnlockedWorlds(p).map(w => w.id)).toEqual(['world-1', 'world-2']);
  });

  test('inside World 2, level 21 unlocks with the world; 22 waits for 21', () => {
    let p = emptyProgress();
    for (const id of W1.levelIds) p = complete(p, id); // unlock World 2

    expect(isLevelUnlocked(p, W2, W2.levelIds[0])).toBe(true);
    expect(isLevelUnlocked(p, W2, W2.levelIds[1])).toBe(false);

    p = complete(p, W2.levelIds[0]);
    expect(isLevelUnlocked(p, W2, W2.levelIds[1])).toBe(true);
  });
});

describe('getWorldSummary', () => {
  test('reflects completion, stars and unlock state per level', () => {
    let p = emptyProgress();
    p = complete(p, W1.levelIds[0]); // 3 stars
    const l2 = getLevelById(W1.levelIds[1])!;
    p = recordCompletion(p, W1.levelIds[1], 99, getStarThresholds(l2)); // 1 star

    const summary = getWorldSummary(p, W1);
    expect(summary.totalLevels).toBe(20);
    expect(summary.completedLevels).toBe(2);
    expect(summary.starsEarned).toBe(4);
    expect(summary.starsPossible).toBe(60);

    expect(summary.levels[0]).toMatchObject({ position: 1, completed: true, stars: 3, unlocked: true });
    expect(summary.levels[1]).toMatchObject({ position: 2, completed: true, stars: 1, unlocked: true });
    expect(summary.levels[2]).toMatchObject({ position: 3, completed: false, stars: 0, unlocked: true });
    expect(summary.levels[3]).toMatchObject({ position: 4, completed: false, unlocked: false });
  });
});

describe('getJourneyPoint (the interleaved journey)', () => {
  test('fresh player is at journey entry 1 - the first gravity puzzle', () => {
    const jp = getJourneyPoint(emptyProgress());
    expect(jp.entry).toBe(JOURNEY[0]);
    expect(jp.entry.kind).toBe('gravity');
    expect(jp.entry.puzzleId).toBe(W1.levelIds[0]);
    expect(jp.position).toBe(1);
    expect(jp.allDone).toBe(false);
    expect(jp.total).toBe(JOURNEY.length);
  });

  test('completing the first entry advances to the next entry (a different game)', () => {
    const p = complete(emptyProgress(), JOURNEY[0].puzzleId);
    const jp = getJourneyPoint(p);
    expect(jp.entry).toBe(JOURNEY[1]);
    expect(jp.position).toBe(2);
    expect(jp.entry.kind).not.toBe(JOURNEY[0].kind); // 1-1-1, no repeat
  });

  test('nextGravity points past a non-gravity entry to a playable gravity puzzle', () => {
    const p = complete(emptyProgress(), JOURNEY[0].puzzleId);
    const jp = getJourneyPoint(p);
    expect(jp.entry.kind).not.toBe('gravity');
    expect(jp.nextGravity?.kind).toBe('gravity');
    expect(jp.nextGravity!.position).toBeGreaterThan(1);
  });

  test('completing every entry returns the final one with allDone', () => {
    let p = emptyProgress();
    for (const entry of JOURNEY) p = completeAny(p, entry.puzzleId);
    const jp = getJourneyPoint(p);
    expect(jp.allDone).toBe(true);
    expect(jp.position).toBe(JOURNEY.length);
  });
});

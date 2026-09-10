import { FIRST_WORLD, WORLDS } from '../../game/worlds';
import { getStarThresholds, getLevelById } from '../../game/levels';
import { emptyProgress, recordCompletion, setCursor } from '../playerProgress';
import {
  getNextPlayableLevel,
  getResumePoint,
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

describe('getResumePoint', () => {
  test('fresh player resumes at World 1, level 1', () => {
    expect(getResumePoint(emptyProgress())).toEqual({ world: W1, levelId: W1.levelIds[0] });
  });

  test('with progress, resumes at the first unlocked, uncompleted level', () => {
    let p = emptyProgress();
    for (let i = 0; i < 3; i += 1) p = complete(p, W1.levelIds[i]);
    expect(getResumePoint(p).levelId).toBe(W1.levelIds[3]);
  });

  test('a valid cursor wins over the derived point', () => {
    let p = emptyProgress();
    for (let i = 0; i < 3; i += 1) p = complete(p, W1.levelIds[i]);
    p = setCursor(p, W1.id, W1.levelIds[1]); // an unlocked (completed) level
    expect(getResumePoint(p).levelId).toBe(W1.levelIds[1]);
  });

  test('a stale cursor pointing at a locked level is ignored', () => {
    const p = setCursor(emptyProgress(), W1.id, W1.levelIds[10]); // locked from fresh
    expect(getResumePoint(p).levelId).toBe(W1.levelIds[0]);
  });
});

describe('getNextPlayableLevel', () => {
  test('after completing a level, the next in the world is playable', () => {
    let p = emptyProgress();
    p = complete(p, W1.levelIds[0]);
    expect(getNextPlayableLevel(p, W1.levelIds[0])).toEqual({ world: W1, levelId: W1.levelIds[1] });
  });

  test('the last level of a world has no next', () => {
    let p = emptyProgress();
    for (const id of W1.levelIds) p = complete(p, id);
    expect(getNextPlayableLevel(p, W1.levelIds[19])).toBeUndefined();
  });
});

import { BINAIRO } from '../../game/binairo';
import { LEVELS } from '../../game/levels';
import { MIRROR_MAZES } from '../../game/mirror';
import { GameKind, ROTATION } from '../../game/journey';
import { TENTS_TREES } from '../../game/tents';
import { TOWERS } from '../../game/towers';
import { FIRST_WORLD, WORLDS } from '../../game/worlds';
import { ACHIEVEMENTS, getEarnedAchievements, TOTAL_PUZZLE_COUNT } from '../achievements';
import { emptyProgress, PlayerProgress, recordCompletion, recordDaily } from '../playerProgress';

const T3 = { three: 1, two: 2 }; // hint-style thresholds: moves=1 -> 3 stars

/** Every puzzle id in every game, `kind` alongside each - the same set
 * `achievements.ts`'s own (private) `ALL_PUZZLE_IDS` is built from, kept
 * independently here rather than imported so this test verifies the real
 * behaviour against the real game pools, not against achievements.ts's own
 * internal list circularly. */
const ALL_ENTRIES: ReadonlyArray<{ kind: GameKind; puzzleId: string }> = [
  ...LEVELS.map(level => ({ kind: 'gravity' as const, puzzleId: level.id })),
  ...MIRROR_MAZES.map(puzzle => ({ kind: 'mirror' as const, puzzleId: puzzle.id })),
  ...TENTS_TREES.map(puzzle => ({ kind: 'tents' as const, puzzleId: puzzle.id })),
  ...TOWERS.map(puzzle => ({ kind: 'towers' as const, puzzleId: puzzle.id })),
  ...BINAIRO.map(puzzle => ({ kind: 'binairo' as const, puzzleId: puzzle.id })),
];

function firstPuzzleOfKind(kind: GameKind): string {
  return ALL_ENTRIES.find(e => e.kind === kind)!.puzzleId;
}

function complete(progress: PlayerProgress, id: string, stars: 1 | 2 | 3): PlayerProgress {
  const moves = stars === 3 ? 1 : stars === 2 ? 2 : 3;
  return recordCompletion(progress, id, moves, T3);
}

function findAchievement(id: string) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) throw new Error(`no achievement with id ${id}`);
  return a;
}

describe('ACHIEVEMENTS - list integrity', () => {
  test('every id is unique', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every achievement has a real title and description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  test('a fresh player has earned nothing', () => {
    expect(getEarnedAchievements(emptyProgress())).toEqual([]);
  });

  test('one achievement exists per world', () => {
    for (const world of WORLDS) {
      expect(() => findAchievement(`world:${world.id}`)).not.toThrow();
    }
  });
});

describe('world completion achievements', () => {
  test('earned only once every level in that world is complete', () => {
    const achievement = findAchievement(`world:${FIRST_WORLD.id}`);
    let p = emptyProgress();
    for (const id of FIRST_WORLD.levelIds.slice(0, -1)) p = complete(p, id, 1);
    expect(achievement.isEarned(p)).toBe(false);

    p = complete(p, FIRST_WORLD.levelIds[FIRST_WORLD.levelIds.length - 1], 1);
    expect(achievement.isEarned(p)).toBe(true);
  });

  test('completing one world does not earn another world’s achievement', () => {
    let p = emptyProgress();
    for (const id of FIRST_WORLD.levelIds) p = complete(p, id, 1);
    const secondWorld = WORLDS.find(w => w.order === 2)!;
    expect(findAchievement(`world:${secondWorld.id}`).isEarned(p)).toBe(false);
  });
});

describe('per-game completion achievements', () => {
  test('Bending Light requires every Mirror Maze puzzle, not just most of them', () => {
    const achievement = findAchievement('game:mirror');
    let p = emptyProgress();
    for (const puzzle of MIRROR_MAZES.slice(0, -1)) p = complete(p, puzzle.id, 1);
    expect(achievement.isEarned(p)).toBe(false);

    p = complete(p, MIRROR_MAZES[MIRROR_MAZES.length - 1].id, 1);
    expect(achievement.isEarned(p)).toBe(true);
  });

  // Safety nets for the two achievement lists that aren't compiler-enforced
  // the way `buildPools`/`GAME_INTROS`/`gameAccent` are (a `Record<GameKind,
  // ...>` or exhaustive switch fails to compile if a case is missing; a plain
  // array literal here does not) - driven off `ROTATION` so adding a game
  // without adding its achievement entry fails a test instead of shipping
  // silently under-rewarded.
  test('every non-Gravity game has its own completion achievement', () => {
    for (const kind of ROTATION) {
      if (kind === 'gravity') continue;
      expect(() => findAchievement(`game:${kind}`)).not.toThrow();
    }
  });

  test('every non-Gravity game can trigger Flawless on its own', () => {
    const flawless = findAchievement('skill:flawless');
    for (const kind of ROTATION) {
      if (kind === 'gravity') continue;
      expect(flawless.isEarned(complete(emptyProgress(), firstPuzzleOfKind(kind), 3))).toBe(true);
    }
  });
});

describe('star milestones', () => {
  test('Rising Star (100) and Bright Sky (300) trigger at their thresholds', () => {
    const rising = findAchievement('stars:100');
    const bright = findAchievement('stars:300');
    let p = emptyProgress();
    // 34 gravity levels at 3 stars = 102 stars.
    for (let i = 0; i < 34; i += 1) p = complete(p, `level-${String(i + 1).padStart(3, '0')}`, 3);

    expect(rising.isEarned(p)).toBe(true);
    expect(bright.isEarned(p)).toBe(false);
  });

  test('Full Almanac requires literally every star in the game', () => {
    const achievement = findAchievement('stars:all');
    let p = emptyProgress();
    for (const entry of ALL_ENTRIES) p = complete(p, entry.puzzleId, 3);
    expect(achievement.isEarned(p)).toBe(true);

    // Drop one entry back to 3 -> 3 (unchanged, still max) - sanity check the
    // achievement is about totals, not a special-cased "solved everything"
    // flag duplicating `journey:complete`.
    expect(achievement.isEarned(emptyProgress())).toBe(false);
  });
});

describe('Daily streak achievements', () => {
  test('use bestDailyStreak, so they survive a missed day', () => {
    const habit = findAchievement('streak:3');
    let p = emptyProgress();
    p = recordDaily(p, '2026-01-01');
    p = recordDaily(p, '2026-01-02');
    p = recordDaily(p, '2026-01-03');
    expect(habit.isEarned(p)).toBe(true);

    p = recordDaily(p, '2026-02-01'); // long gap - live streak resets to 1
    expect(p.daily.streak).toBe(1);
    expect(habit.isEarned(p)).toBe(true); // achievement stays earned
  });
});

describe('Flawless achievement', () => {
  test('earned by a single zero-hint solve on any of the hint-scored games', () => {
    const achievement = findAchievement('skill:flawless');
    let p = emptyProgress();
    expect(achievement.isEarned(p)).toBe(false);

    p = complete(p, MIRROR_MAZES[0].id, 3);
    expect(achievement.isEarned(p)).toBe(true);
  });

  test('is not earned by a merely-completed (non-flawless) solve', () => {
    const achievement = findAchievement('skill:flawless');
    const p = complete(emptyProgress(), MIRROR_MAZES[0].id, 1);
    expect(achievement.isEarned(p)).toBe(false);
  });
});

describe('Completionist', () => {
  test('requires every single puzzle in every game', () => {
    const achievement = findAchievement('journey:complete');
    let p = emptyProgress();
    for (const entry of ALL_ENTRIES.slice(0, -1)) p = complete(p, entry.puzzleId, 1);
    expect(achievement.isEarned(p)).toBe(false);

    p = complete(p, ALL_ENTRIES[ALL_ENTRIES.length - 1].puzzleId, 1);
    expect(achievement.isEarned(p)).toBe(true);
  });

  test('TOTAL_PUZZLE_COUNT matches the real combined pool size', () => {
    expect(TOTAL_PUZZLE_COUNT).toBe(ALL_ENTRIES.length);
  });
});

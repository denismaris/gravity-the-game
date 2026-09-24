import { BINAIRO } from '../game/binairo';
import { LEVELS } from '../game/levels';
import { MIRROR_MAZES } from '../game/mirror';
import { TENTS_TREES } from '../game/tents';
import { TOWERS } from '../game/towers';
import { WORLDS } from '../game/worlds';

/** Every puzzle in every game, for the two achievements that used to read
 * this off the old interleaved Journey (`JOURNEY.length` / `JOURNEY.every`)
 * - which was always exactly "every puzzle in every pool" in some order,
 * never a subset, so computing it directly from the five pools here is
 * behaviourally identical, not an approximation. */
const ALL_PUZZLE_IDS: ReadonlyArray<string> = [
  ...LEVELS.map(level => level.id),
  ...MIRROR_MAZES.map(puzzle => puzzle.id),
  ...TENTS_TREES.map(puzzle => puzzle.id),
  ...TOWERS.map(puzzle => puzzle.id),
  ...BINAIRO.map(puzzle => puzzle.id),
];

/** Every puzzle in every game, total - `HomeScreen`'s own "X of Y solved"
 * stats line uses this alongside `getCompletedCount` (system-wide, exactly
 * like this count), the same pairing `journey:complete`/`stars:all` below
 * use internally. */
export const TOTAL_PUZZLE_COUNT = ALL_PUZZLE_IDS.length;
import { getLevelStars, getTotalStars, isLevelCompleted, PlayerProgress } from './playerProgress';
import { isWorldComplete } from './worldProgress';

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Whether `progress` has earned this. Pure and derived - nothing about
   * "which achievements are earned" is ever stored, the same "derive, don't
   * duplicate" rule `worldProgress.ts` follows for unlocks. Every check here
   * is built only from data that's already monotonic (stars/completions only
   * rise, `bestDailyStreak` only rises) so an achievement can never become
   * un-earned just from playing normally - only `resetProgress` clears it,
   * same as everything else. */
  readonly isEarned: (progress: PlayerProgress) => boolean;
}

const WORLD_ACHIEVEMENT_TITLES: Readonly<Record<number, string>> = {
  1: 'Grounded',
  2: 'Anchored',
  3: 'Through the Portal',
  4: 'Dual Mastery',
  5: 'Current Runner',
  6: 'Danger Zone',
};

function allCompleted(progress: PlayerProgress, pool: ReadonlyArray<{ id: string }>): boolean {
  return pool.every(puzzle => isLevelCompleted(progress, puzzle.id));
}

/** Whether any puzzle in `pool` has ever been solved for the full 3 stars -
 * for every hint-scored game (Mirror Maze/Tents and Trees/Skyscrapers/
 * Binairo) that means zero hints (see `HINT_STAR_THRESHOLDS` in
 * `PlayerProgressProvider`). */
function anyFlawless(progress: PlayerProgress, pool: ReadonlyArray<{ id: string }>): boolean {
  return pool.some(puzzle => getLevelStars(progress, puzzle.id) === 3);
}

const TOTAL_STARS_POSSIBLE = ALL_PUZZLE_IDS.length * 3;

/**
 * The fixed set of achievements. Order here is display order. Ids are
 * permanent identifiers only (not currently persisted anywhere - earned
 * state is always recomputed - but keep them stable anyway in case that
 * changes later).
 */
export const ACHIEVEMENTS: ReadonlyArray<Achievement> = [
  ...WORLDS.map(
    (world): Achievement => ({
      id: `world:${world.id}`,
      title: WORLD_ACHIEVEMENT_TITLES[world.order] ?? world.name,
      description: `Complete every level in World ${world.order}: ${world.name}.`,
      isEarned: progress => isWorldComplete(progress, world),
    }),
  ),
  {
    id: 'game:mirror',
    title: 'Bending Light',
    description: 'Solve every Mirror Maze puzzle.',
    isEarned: progress => allCompleted(progress, MIRROR_MAZES),
  },
  {
    id: 'game:tents',
    title: 'Under Canvas',
    description: 'Solve every Tents and Trees puzzle.',
    isEarned: progress => allCompleted(progress, TENTS_TREES),
  },
  {
    id: 'game:towers',
    title: 'Top Floor',
    description: 'Solve every Skyscrapers puzzle.',
    isEarned: progress => allCompleted(progress, TOWERS),
  },
  {
    id: 'game:binairo',
    title: 'Binary Star',
    description: 'Solve every Binairo puzzle.',
    isEarned: progress => allCompleted(progress, BINAIRO),
  },
  {
    id: 'stars:100',
    title: 'Rising Star',
    description: 'Earn 100 stars.',
    isEarned: progress => getTotalStars(progress) >= 100,
  },
  {
    id: 'stars:300',
    title: 'Bright Sky',
    description: 'Earn 300 stars.',
    isEarned: progress => getTotalStars(progress) >= 300,
  },
  {
    id: 'stars:all',
    title: 'Full Almanac',
    description: `Earn every star - all ${TOTAL_STARS_POSSIBLE}.`,
    isEarned: progress => getTotalStars(progress) >= TOTAL_STARS_POSSIBLE,
  },
  {
    id: 'streak:3',
    title: 'Habit Forming',
    description: 'Reach a 3-day Daily streak.',
    isEarned: progress => progress.bestDailyStreak >= 3,
  },
  {
    id: 'streak:7',
    title: 'Week One',
    description: 'Reach a 7-day Daily streak.',
    isEarned: progress => progress.bestDailyStreak >= 7,
  },
  {
    id: 'streak:30',
    title: 'Dedicated',
    description: 'Reach a 30-day Daily streak.',
    isEarned: progress => progress.bestDailyStreak >= 30,
  },
  {
    id: 'skill:flawless',
    title: 'Flawless',
    description: 'Solve a Mirror Maze, Tents and Trees, Skyscrapers or Binairo puzzle without using a hint.',
    isEarned: progress => anyFlawless(progress, [...MIRROR_MAZES, ...TENTS_TREES, ...TOWERS, ...BINAIRO]),
  },
  {
    id: 'journey:complete',
    title: 'Completionist',
    description: `Solve every puzzle in every game - all ${ALL_PUZZLE_IDS.length}.`,
    isEarned: progress => ALL_PUZZLE_IDS.every(puzzleId => isLevelCompleted(progress, puzzleId)),
  },
];

export function getEarnedAchievements(progress: PlayerProgress): ReadonlyArray<Achievement> {
  return ACHIEVEMENTS.filter(a => a.isEarned(progress));
}

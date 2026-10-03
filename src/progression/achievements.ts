import { ARUKONE } from '../game/arukone';
import { BINAIRO } from '../game/binairo';
import { FILLAPIX } from '../game/fillapix';
import { LIGHTS_OUT } from '../game/lightsout';
import { ADJACENT } from '../game/adjacent';
import { BLOOM } from '../game/bloom';
import { MOSAIC } from '../game/mosaic';
import { BRIDGES } from '../game/bridges';
import { LEVELS } from '../game/levels';
import { MIRROR_MAZES } from '../game/mirror';
import { TENTS_TREES } from '../game/tents';
import { TOWERS } from '../game/towers';
import { WORLDS } from '../game/worlds';
import type { GameKind } from '../game/journey';

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
  ...ARUKONE.map(puzzle => puzzle.id),
  ...FILLAPIX.map(puzzle => puzzle.id),
  ...LIGHTS_OUT.map(puzzle => puzzle.id),
  ...ADJACENT.map(puzzle => puzzle.id),
  ...BLOOM.map(puzzle => puzzle.id),
  ...MOSAIC.map(puzzle => puzzle.id),
  ...BRIDGES.map(puzzle => puzzle.id),
];

/** Every puzzle in every game, total - `HomeScreen`'s own "X of Y solved"
 * stats line uses this alongside `getCompletedCount` (system-wide, exactly
 * like this count), the same pairing `journey:complete`/`stars:all` below
 * use internally. */
export const TOTAL_PUZZLE_COUNT = ALL_PUZZLE_IDS.length;
import { getLevelStars, getTotalStars, isLevelCompleted, PlayerProgress } from './playerProgress';
import { isWorldComplete } from './worldProgress';

/** Where an achievement sits on the shelf. */
export type AchievementGroup = 'road' | 'daily' | 'stars' | 'games' | 'gravity' | 'craft';

export const ACHIEVEMENT_GROUPS: ReadonlyArray<{ id: AchievementGroup; title: string }> = [
  { id: 'road', title: 'The long road' },
  { id: 'daily', title: 'The Daily' },
  { id: 'stars', title: 'Stars' },
  { id: 'games', title: 'Every game' },
  { id: 'gravity', title: "Gravity's collections" },
  { id: 'craft', title: 'Craft' },
];

export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly group: AchievementGroup;
  /** The game it belongs to, for its medal. */
  readonly game?: GameKind;
  /** How far along the player is, for the progress line. */
  readonly measure: (progress: PlayerProgress) => { readonly value: number; readonly target: number };
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

function solvedIn(progress: PlayerProgress, pool: ReadonlyArray<{ id: string }>): { value: number; target: number } {
  return { value: pool.filter(puzzle => isLevelCompleted(progress, puzzle.id)).length, target: pool.length };
}

/** "Solve every X puzzle", for one game's whole pool. */
function everyPuzzle(id: string, game: GameKind, title: string, description: string, pool: ReadonlyArray<{ id: string }>): Achievement {
  return {
    id,
    title,
    description,
    group: 'games',
    game,
    measure: progress => solvedIn(progress, pool),
    isEarned: progress => allCompleted(progress, pool),
  };
}

/** Whether any puzzle in `pool` has ever been solved for the full 3 stars -
 * for every hint-scored game (Mirror Maze/Tents and Trees/Skyscrapers/
 * Binairo/Arukone+) that means zero hints (see `HINT_STAR_THRESHOLDS` in
 * `PlayerProgressProvider`). */
function anyFlawless(progress: PlayerProgress, pool: ReadonlyArray<{ id: string }>): boolean {
  return pool.some(puzzle => getLevelStars(progress, puzzle.id) === 3);
}

const TOTAL_STARS_POSSIBLE = ALL_PUZZLE_IDS.length * 3;
const NOT_GRAVITY = [...MIRROR_MAZES, ...TENTS_TREES, ...TOWERS, ...BINAIRO, ...ARUKONE, ...FILLAPIX, ...LIGHTS_OUT, ...ADJACENT, ...BLOOM, ...MOSAIC, ...BRIDGES];

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
      description: `Solve all ${world.levelIds.length} Gravity puzzles in "${world.name}".`,
      group: 'gravity',
      game: 'gravity',
      measure: progress => ({ value: world.levelIds.filter(id => isLevelCompleted(progress, id)).length, target: world.levelIds.length }),
      isEarned: progress => isWorldComplete(progress, world),
    }),
  ),
  everyPuzzle('game:mirror', 'mirror', 'Bending Light', 'Solve every Mirror Maze puzzle.', MIRROR_MAZES),
  everyPuzzle('game:tents', 'tents', 'Under Canvas', 'Solve every Tents and Trees puzzle.', TENTS_TREES),
  everyPuzzle('game:towers', 'towers', 'Top Floor', 'Solve every Skyscrapers puzzle.', TOWERS),
  everyPuzzle('game:binairo', 'binairo', 'Binary Star', 'Solve every Twos puzzle.', BINAIRO),
  everyPuzzle('game:arukone', 'arukone', 'Both Sides', 'Solve every Arukone+ puzzle.', ARUKONE),
  everyPuzzle('game:fillapix', 'fillapix', 'Picture Perfect', 'Solve every Pixel Clues puzzle.', FILLAPIX),
  everyPuzzle('game:lightsout', 'lightsout', 'Nothing Burning', 'Solve every Lanterns puzzle.', LIGHTS_OUT),
  everyPuzzle('game:adjacent', 'adjacent', 'Down to the Tray', 'Solve every Adjacent puzzle.', ADJACENT),
  everyPuzzle('game:bloom', 'bloom', 'Walled Garden', 'Solve every Bloom puzzle.', BLOOM),
  everyPuzzle('game:mosaic', 'mosaic', 'Gallery Wall', 'Complete every Mosaic picture.', MOSAIC),
  everyPuzzle('game:bridges', 'bridges', 'Harbour Master', 'Connect every Bridges archipelago.', BRIDGES),
  {
    id: 'stars:100',
    title: 'Rising Star',
    description: 'Earn 100 stars.',
    group: 'stars',
    measure: progress => ({ value: getTotalStars(progress), target: 100 }),
    isEarned: progress => getTotalStars(progress) >= 100,
  },
  {
    id: 'stars:300',
    title: 'Bright Sky',
    description: 'Earn 300 stars.',
    group: 'stars',
    measure: progress => ({ value: getTotalStars(progress), target: 300 }),
    isEarned: progress => getTotalStars(progress) >= 300,
  },
  {
    id: 'stars:all',
    title: 'Full Almanac',
    description: `Earn every star, all ${TOTAL_STARS_POSSIBLE} of them.`,
    group: 'stars',
    measure: progress => ({ value: getTotalStars(progress), target: TOTAL_STARS_POSSIBLE }),
    isEarned: progress => getTotalStars(progress) >= TOTAL_STARS_POSSIBLE,
  },
  {
    id: 'streak:3',
    title: 'Habit Forming',
    description: 'Reach a 3-day Daily streak.',
    group: 'daily',
    measure: progress => ({ value: progress.bestDailyStreak, target: 3 }),
    isEarned: progress => progress.bestDailyStreak >= 3,
  },
  {
    id: 'streak:7',
    title: 'Week One',
    description: 'Reach a 7-day Daily streak.',
    group: 'daily',
    measure: progress => ({ value: progress.bestDailyStreak, target: 7 }),
    isEarned: progress => progress.bestDailyStreak >= 7,
  },
  {
    id: 'streak:30',
    title: 'Dedicated',
    description: 'Reach a 30-day Daily streak.',
    group: 'daily',
    measure: progress => ({ value: progress.bestDailyStreak, target: 30 }),
    isEarned: progress => progress.bestDailyStreak >= 30,
  },
  // The long road: level sets now run forever, so the milestones along it
  // are worth marking.
  {
    id: 'level:100',
    title: 'Centurion',
    description: 'Reach level 100.',
    group: 'road',
    measure: progress => ({ value: progress.currentLevel, target: 100 }),
    isEarned: progress => progress.currentLevel >= 100,
  },
  {
    id: 'level:250',
    title: 'Long Distance',
    description: 'Reach level 250.',
    group: 'road',
    measure: progress => ({ value: progress.currentLevel, target: 250 }),
    isEarned: progress => progress.currentLevel >= 250,
  },
  {
    id: 'level:500',
    title: 'Half a Thousand',
    description: 'Reach level 500.',
    group: 'road',
    measure: progress => ({ value: progress.currentLevel, target: 500 }),
    isEarned: progress => progress.currentLevel >= 500,
  },
  {
    id: 'level:1000',
    title: 'The Thousand',
    description: 'Reach level 1000.',
    group: 'road',
    measure: progress => ({ value: progress.currentLevel, target: 1000 }),
    isEarned: progress => progress.currentLevel >= 1000,
  },
  {
    id: 'skill:flawless',
    title: 'Flawless',
    description: 'Solve any puzzle outside Gravity without using a hint.',
    group: 'craft',
    measure: progress => ({ value: anyFlawless(progress, NOT_GRAVITY) ? 1 : 0, target: 1 }),
    isEarned: progress => anyFlawless(progress, NOT_GRAVITY),
  },
  {
    id: 'journey:complete',
    title: 'Completionist',
    description: `Solve every puzzle in every game, all ${ALL_PUZZLE_IDS.length} of them.`,
    group: 'craft',
    measure: progress => solvedIn(progress, ALL_PUZZLE_IDS.map(id => ({ id }))),
    isEarned: progress => ALL_PUZZLE_IDS.every(puzzleId => isLevelCompleted(progress, puzzleId)),
  },
];

/** The unearned achievements closest to done, nearest first. */
export function nearestAchievements(progress: PlayerProgress, count: number): ReadonlyArray<Achievement> {
  return ACHIEVEMENTS.filter(a => !a.isEarned(progress))
    .map(a => {
      const m = a.measure(progress);
      return { a, share: m.target > 0 ? Math.min(1, m.value / m.target) : 0 };
    })
    .filter(x => x.share > 0)
    .sort((x, y) => y.share - x.share)
    .slice(0, count)
    .map(x => x.a);
}

export function getEarnedAchievements(progress: PlayerProgress): ReadonlyArray<Achievement> {
  return ACHIEVEMENTS.filter(a => a.isEarned(progress));
}

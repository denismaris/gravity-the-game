import { PlayerProgress } from './playerProgress';
import { grantCosmetic } from './shop';

/**
 * Chapters: the almanac's own table of contents. Every ten levels close a
 * chapter, each with its own name and a reward - coins, and on most
 * chapters a cosmetic from the shop. "Level 47" becomes "three levels
 * from the end of Chapter V", which is a place worth getting to.
 *
 * Rewards are claimed by hand in the Almanac rather than paid silently,
 * so each one is a moment - and a save that finished chapters before
 * they existed finds its rewards waiting.
 */

export const LEVELS_PER_CHAPTER = 10;

const NAMES: ReadonlyArray<string> = [
  'First Light',
  'The Harbour',
  'Winter Garden',
  'Salt and Stone',
  'The Long Tide',
  'Lantern Nights',
  'High Summer',
  'The Archive',
  'Northern Lights',
  'The Observatory',
  'Old Maps',
  'The Grand Tour',
];

/** The cosmetic a chapter gives, if any - cycling through the shop's
 * showpieces, so the first few chapters each unlock something new. */
const COSMETIC_REWARDS: ReadonlyArray<string | null> = [
  'confetti-gold',
  'ball-coral',
  'chart-tropic',
  'confetti-blossom',
  'ball-pearl',
  'chart-night',
  'confetti-starlight',
  'ball-obsidian',
];

export interface Chapter {
  /** 1-based. */
  readonly number: number;
  readonly name: string;
  /** Its first and last level numbers. */
  readonly firstLevel: number;
  readonly lastLevel: number;
  readonly coins: number;
  readonly cosmetic: string | null;
}

export function chapterAt(number: number): Chapter {
  const n = Math.max(1, Math.floor(number));
  const base = NAMES[(n - 1) % NAMES.length];
  const cycle = Math.floor((n - 1) / NAMES.length);
  return {
    number: n,
    name: cycle === 0 ? base : `${base} ${cycle + 1}`,
    firstLevel: (n - 1) * LEVELS_PER_CHAPTER + 1,
    lastLevel: n * LEVELS_PER_CHAPTER,
    coins: 60 + 20 * n,
    cosmetic: n <= COSMETIC_REWARDS.length ? COSMETIC_REWARDS[n - 1] : null,
  };
}

/** The chapter a level belongs to. */
export function chapterOfLevel(level: number): Chapter {
  return chapterAt(Math.ceil(Math.max(1, level) / LEVELS_PER_CHAPTER));
}

/** Chapters fully finished: the level in progress is past their last. */
export function chaptersFinished(progress: PlayerProgress): number {
  return Math.floor((progress.currentLevel - 1) / LEVELS_PER_CHAPTER);
}

/** The chapter being played now, and how many of its levels are done. */
export function currentChapter(progress: PlayerProgress): { chapter: Chapter; levelsDone: number } {
  const chapter = chapterOfLevel(progress.currentLevel);
  return { chapter, levelsDone: progress.currentLevel - chapter.firstLevel };
}

/** Finished chapters whose reward has not been claimed yet. */
export function unclaimedChapters(progress: PlayerProgress): Chapter[] {
  const finished = chaptersFinished(progress);
  const out: Chapter[] = [];
  for (let n = 1; n <= finished; n += 1) if (!progress.chaptersClaimed.includes(n)) out.push(chapterAt(n));
  return out;
}

/** Claims a finished chapter's reward. Null if it is not finished or was
 * already claimed. */
export function claimChapter(progress: PlayerProgress, number: number): PlayerProgress | null {
  if (number < 1 || number > chaptersFinished(progress) || progress.chaptersClaimed.includes(number)) return null;
  const chapter = chapterAt(number);
  const paid = { ...progress, coins: progress.coins + chapter.coins, chaptersClaimed: [...progress.chaptersClaimed, number] };
  return chapter.cosmetic ? grantCosmetic(paid, chapter.cosmetic) : paid;
}

/** The chapter whose reward is this cosmetic, if one is. */
export function chapterRewarding(id: string): number | null {
  const index = COSMETIC_REWARDS.indexOf(id);
  return index === -1 ? null : index + 1;
}

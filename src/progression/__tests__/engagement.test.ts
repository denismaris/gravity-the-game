import { emptyProgress, getDisplayDailyStreak, PlayerProgress, recordDaily } from '../playerProgress';
import { RANKS, collectRanks, experienceOf, pendingRanks, rankAt, rankReward, toRoman } from '../rank';
import { chapterAt, chaptersFinished, claimChapter, currentChapter, unclaimedChapters } from '../chapters';
import { advanceErrands, claimErrand, errandLogFor, errandsFor, unclaimedErrands } from '../errands';
import { COSMETICS, DEFAULT_EQUIPPED, buyCosmetic, buyStreakFreeze, equipCosmetic, equipped, owns } from '../shop';
import { parseProgress } from '../playerProgressStore';
import { puzzleKindOf } from '../../game/journey';
import { LevelResult } from '../../game/scoring';

/** `puzzles` solved, three stars each - `stars` is their total. */
const withStars = (stars: number, puzzles = stars / 3): PlayerProgress => {
  const levels: Record<string, LevelResult> = {};
  for (let i = 0; i < puzzles; i += 1) levels[`p${i}`] = { completed: true, stars: 3, bestMoves: 1 };
  return { ...emptyProgress(), levels };
};

describe('ranks', () => {
  test('climb through the named ranks, then numbered Grand Masters', () => {
    expect(rankAt(0).title).toBe('Novice');
    expect(rankAt(RANKS[1].at).title).toBe('Apprentice');
    expect(rankAt(RANKS[1].at - 1).number).toBe(1);
    const last = RANKS[RANKS.length - 1];
    expect(rankAt(last.at).title).toBe('Grand Master');
    expect(rankAt(last.at + 2000).title).toBe('Grand Master II');
    expect(rankAt(500).share).toBeGreaterThan(0);
    expect(rankAt(500).share).toBeLessThan(1);
  });

  test('experience is derived from stars, puzzles, errands and the best run', () => {
    const p = { ...withStars(3, 1), errandsClaimed: 2, bestDailyStreak: 4 };
    expect(experienceOf(p)).toBe(3 * 10 + 1 * 5 + 2 * 25 + 4 * 5);
  });

  test('a save that earned ranks before they existed collects them all, once', () => {
    const p = { ...withStars(90, 30), coins: 0 };
    const pending = pendingRanks(p);
    expect(pending.length).toBeGreaterThan(1);
    const collected = collectRanks(p);
    expect(collected.ranks).toEqual(pending);
    expect(collected.coins).toBe(pending.reduce((s, n) => s + rankReward(n), 0));
    expect(pendingRanks(collected.progress)).toEqual([]);
    expect(collectRanks(collected.progress).coins).toBe(0);
  });

  test('roman numerals', () => {
    expect([1, 4, 9, 14, 40].map(toRoman)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL']);
  });
});

describe('chapters', () => {
  test('ten levels a chapter, named, with growing rewards', () => {
    expect(chapterAt(1)).toMatchObject({ firstLevel: 1, lastLevel: 10, name: 'First Light' });
    expect(chapterAt(2).coins).toBeGreaterThan(chapterAt(1).coins);
    const p = { ...emptyProgress(), currentLevel: 24 };
    expect(chaptersFinished(p)).toBe(2);
    expect(currentChapter(p)).toMatchObject({ chapter: { number: 3 }, levelsDone: 3 });
  });

  test('a finished chapter pays once, with its cosmetic', () => {
    const p = { ...emptyProgress(), currentLevel: 12, coins: 0 };
    expect(unclaimedChapters(p).map(c => c.number)).toEqual([1]);
    const claimed = claimChapter(p, 1)!;
    expect(claimed.coins).toBe(chapterAt(1).coins);
    expect(owns(claimed, chapterAt(1).cosmetic!)).toBe(true);
    expect(claimChapter(claimed, 1)).toBeNull();
    expect(claimChapter(p, 2)).toBeNull();
  });
});

describe('errands', () => {
  const day = '2026-09-30';

  test('three a day - the same all day, different another day', () => {
    expect(errandsFor(day)).toHaveLength(3);
    expect(errandsFor(day)).toEqual(errandsFor(day));
    const week = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map(d => JSON.stringify(errandsFor(d)));
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  test('solves move them along; a finished one pays once', () => {
    const errands = errandsFor(day);
    let p = { ...emptyProgress(), coins: 0 };
    for (let i = 0; i < 12; i += 1) {
      p = advanceErrands(p, day, { kind: errands[1].game!, stars: 3, clean: true, difficulty: 'hard', isDaily: true, setCompleted: true });
    }
    const log = errandLogFor(p, day);
    errands.forEach((e, i) => expect(log.progress[i]).toBe(e.target));
    expect(unclaimedErrands(p, day)).toBe(3);
    const paid = claimErrand(p, day, 1)!;
    expect(paid.coins).toBe(errands[1].coins);
    expect(paid.errandsClaimed).toBe(1);
    expect(claimErrand(paid, day, 1)).toBeNull();
    expect(unclaimedErrands(paid, day)).toBe(2);
  });

  test('a new day starts fresh', () => {
    const p = advanceErrands(emptyProgress(), day, { kind: 'bridges', stars: 3, clean: true, difficulty: 'easy', isDaily: false, setCompleted: false });
    expect(errandLogFor(p, '2026-10-01').progress).toEqual([0, 0, 0]);
  });

  test('a solve knows its game and difficulty from the id alone', () => {
    expect(puzzleKindOf('bridges-hard-02')).toEqual({ kind: 'bridges', difficulty: 'hard' });
    expect(puzzleKindOf('bridges-e-medium-7')).toEqual({ kind: 'bridges', difficulty: 'medium' });
    expect(puzzleKindOf('level-001')?.kind).toBe('gravity');
    expect(puzzleKindOf('no-such-puzzle')).toBeUndefined();
  });
});

describe('the shop', () => {
  test('defaults are owned and worn; buying spends and wears', () => {
    const p = { ...emptyProgress(), coins: 1000 };
    expect(equipped(p, 'confetti').id).toBe(DEFAULT_EQUIPPED.confetti);
    const gold = COSMETICS.find(c => c.id === 'confetti-gold')!;
    const bought = buyCosmetic(p, gold.id)!;
    expect(bought.coins).toBe(1000 - gold.price);
    expect(equipped(bought, 'confetti').id).toBe(gold.id);
    expect(buyCosmetic(bought, gold.id)).toBeNull();
    expect(equipped(equipCosmetic(bought, DEFAULT_EQUIPPED.confetti), 'confetti').id).toBe(DEFAULT_EQUIPPED.confetti);
    expect(buyCosmetic({ ...p, coins: 1 }, gold.id)).toBeNull();
  });

  test('nothing unowned can be worn, even if the save says so', () => {
    const p = { ...emptyProgress(), equipped: { ball: 'ball-gold' } };
    expect(equipped(p, 'ball').id).toBe(DEFAULT_EQUIPPED.ball);
  });
});

describe('streak freezes', () => {
  test('a held freeze covers a missed day, and is spent doing it', () => {
    let p = { ...emptyProgress(), coins: 500 };
    p = recordDaily(p, '2026-09-01');
    p = recordDaily(p, '2026-09-02');
    p = buyStreakFreeze(p)!;
    expect(p.streakFreezes).toBe(1);
    // Missed the 3rd; still alive on the 4th, until played.
    expect(getDisplayDailyStreak(p, '2026-09-04')).toBe(2);
    p = recordDaily(p, '2026-09-04');
    expect(p.daily.streak).toBe(3);
    expect(p.streakFreezes).toBe(0);
    // No freeze left: the next miss breaks it.
    expect(recordDaily(p, '2026-09-06').daily.streak).toBe(1);
  });

  test('at most three are held', () => {
    let p: PlayerProgress | null = { ...emptyProgress(), coins: 10000 };
    for (let i = 0; i < 3; i += 1) p = buyStreakFreeze(p!);
    expect(buyStreakFreeze(p!)).toBeNull();
  });
});

describe('an old save', () => {
  test('reads the new fields as their defaults', () => {
    const old = JSON.stringify({ version: 5, levels: {}, cursor: null, daily: { streak: 0, lastCompletedKey: null }, bestDailyStreak: 0, currentLevel: 1, currentBatch: null, adFreeTimeRemainingMs: null, coins: 80 });
    const p = parseProgress(old);
    expect(p).toMatchObject({ coins: 80, errands: null, errandsClaimed: 0, rankRewarded: 1, chaptersClaimed: [], owned: [], equipped: {}, streakFreezes: 0 });
  });

  test('round-trips everything new', () => {
    const p = { ...emptyProgress(), errandsClaimed: 4, rankRewarded: 3, chaptersClaimed: [1, 2], owned: ['ball-jade'], equipped: { ball: 'ball-jade' }, streakFreezes: 2, errands: { dayKey: '2026-09-30', progress: [1, 0, 2], claimed: [false, true, false] } };
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
  });
});

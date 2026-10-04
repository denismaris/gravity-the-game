import { AD_RULES, EMPTY_LEDGER, adShown, setFinished, videoWatched, videosLeft } from '../policy';

const day = '2026-10-04';
const at = (minutes: number) => Date.UTC(2026, 9, 4, 9) + minutes * 60_000;
const veteran = { solved: 50, adFree: false };

/** Plays `sets` level sets `gap` minutes apart; the times an ad showed. */
function play(sets: number, gap: number, who = veteran) {
  let ledger = EMPTY_LEDGER;
  const shown: number[] = [];
  for (let i = 0; i < sets; i += 1) {
    const now = at(i * gap);
    const result = setFinished(ledger, { now, dayKey: day, ...who });
    ledger = result.ledger;
    if (result.showAd) {
      shown.push(i);
      ledger = adShown(ledger, now, day);
    }
  }
  return shown;
}

describe('when an ad may show', () => {
  test('never for a new player', () => {
    expect(play(10, 10, { solved: AD_RULES.minSolvedBeforeAds - 1, adFree: false })).toEqual([]);
  });

  test('never during ad-free time', () => {
    expect(play(10, 10, { solved: 50, adFree: true })).toEqual([]);
  });

  test('at most one every two finished sets', () => {
    expect(play(8, 10)).toEqual([1, 3, 5, 7]);
  });

  test('never two within five minutes, however fast the sets go', () => {
    const shown = play(20, 1);
    for (let i = 1; i < shown.length; i += 1) expect(shown[i] - shown[i - 1]).toBeGreaterThanOrEqual(AD_RULES.minMinutesBetweenAds);
  });

  test('no more than six a day, even for someone who plays all day', () => {
    expect(play(100, 10).length).toBe(AD_RULES.maxPerDay);
  });
});

describe('coin videos', () => {
  test('a few a day, counted per day', () => {
    let ledger = EMPTY_LEDGER;
    for (let i = 0; i < AD_RULES.maxVideosPerDay; i += 1) ledger = videoWatched(ledger, day);
    expect(videosLeft(ledger, day)).toBe(0);
    expect(videosLeft(ledger, '2026-10-05')).toBe(AD_RULES.maxVideosPerDay);
  });
});

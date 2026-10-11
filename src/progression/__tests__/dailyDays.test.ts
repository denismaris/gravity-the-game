import { emptyProgress, recordDaily } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';
import { mergeProgress } from '../../backend/merge';
import { seasonOf } from '../../components/villa/season';

describe('the Daily calendar', () => {
  test('a solved Daily adds its day, once', () => {
    let p = recordDaily(emptyProgress(), '2026-10-07');
    p = recordDaily(p, '2026-10-08');
    p = recordDaily(p, '2026-10-08');
    expect(p.dailyDays).toEqual(['2026-10-07', '2026-10-08']);
  });

  test('a save from before the calendar is pieced together from its times and its streak', () => {
    const old = JSON.stringify({ ...emptyProgress(), dailyDays: undefined, dailyTimes: { '2026-09-01': 60000 }, daily: { streak: 3, lastCompletedKey: '2026-10-08' } });
    expect(parseProgress(old).dailyDays).toEqual(['2026-09-01', '2026-10-06', '2026-10-07', '2026-10-08']);
  });

  test('two phones keep every day either one played', () => {
    const a = { ...emptyProgress(), dailyDays: ['2026-10-01', '2026-10-03'] };
    const b = { ...emptyProgress(), dailyDays: ['2026-10-02', '2026-10-03'] };
    expect(mergeProgress(a, b).dailyDays).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
});

describe('the villa seasons', () => {
  test('follow the northern calendar', () => {
    expect(seasonOf(new Date(2026, 3, 10))).toBe('spring');
    expect(seasonOf(new Date(2026, 6, 10))).toBe('summer');
    expect(seasonOf(new Date(2026, 9, 8))).toBe('autumn');
    expect(seasonOf(new Date(2026, 0, 10))).toBe('winter');
    expect(seasonOf(new Date(2026, 11, 31))).toBe('winter');
  });
});

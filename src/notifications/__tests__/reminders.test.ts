import { dailyKeyOf, getDailyEntry, getWeeklyGrand } from '../../game/journey';
import { emptyProgress, PlayerProgress } from '../../progression';
import { parseSettings } from '../../settings';
import { planReminders, REMINDER_DAYS } from '../reminders';

describe('planning the daily reminder', () => {
  // Wednesday morning, local time.
  const now = new Date(2026, 8, 30, 8, 15);

  test('plans a week ahead at the chosen hour, naming each day’s Daily', () => {
    const plan = planReminders({ now, hour: 19, progress: emptyProgress() });
    expect(plan).toHaveLength(REMINDER_DAYS);
    plan.forEach((reminder, d) => {
      const at = new Date(reminder.at);
      expect(at.getHours()).toBe(19);
      expect(at.getDate()).toBe(new Date(2026, 8, 30 + d).getDate());
      expect(reminder.body).toContain(getDailyEntry(at).name);
    });
    expect(new Set(plan.map(r => r.id)).size).toBe(REMINDER_DAYS);
  });

  test('skips a time already gone today, and a Daily already solved', () => {
    const evening = new Date(2026, 8, 30, 20, 0);
    expect(new Date(planReminders({ now: evening, hour: 19, progress: emptyProgress() })[0].at).getDate()).toBe(1);

    const solved: PlayerProgress = { ...emptyProgress(), daily: { streak: 1, lastCompletedKey: dailyKeyOf(new Date(2026, 8, 30, 19)) } };
    const plan = planReminders({ now, hour: 19, progress: solved });
    expect(new Date(plan[0].at).getDate()).toBe(1);
  });

  test('mentions a running streak on the first reminder only', () => {
    const yesterday = dailyKeyOf(new Date(2026, 8, 29, 12));
    const onARun: PlayerProgress = { ...emptyProgress(), daily: { streak: 6, lastCompletedKey: yesterday } };
    const plan = planReminders({ now, hour: 19, progress: onARun });
    expect(plan[0].body).toContain('6-day streak');
    expect(plan.slice(1).some(r => r.body.includes('streak'))).toBe(false);
  });

  test('announces a new Weekly Grand on Monday and warns on its last day', () => {
    const plan = planReminders({ now, hour: 19, progress: emptyProgress() });
    // By the Grand's own (UTC) week, so it holds in any time zone.
    const sunday = plan.find(r => getWeeklyGrand(new Date(r.at)).daysLeft === 1)!;
    const monday = plan.find(r => getWeeklyGrand(new Date(r.at)).daysLeft === 7)!;
    expect(sunday.body).toContain('Last day');
    expect(monday.body).toContain(getWeeklyGrand(new Date(monday.at)).name);
  });

  test('is re-planned to the same ids, so a re-plan replaces instead of stacking', () => {
    const a = planReminders({ now, hour: 19, progress: emptyProgress() }).map(r => r.id);
    const b = planReminders({ now: new Date(2026, 8, 30, 9), hour: 21, progress: emptyProgress() }).map(r => r.id);
    expect(b).toEqual(a);
  });
});

describe('the reminder setting', () => {
  test('is off by default, and survives a round-trip', () => {
    expect(parseSettings(null).remindersEnabled).toBe(false);
    expect(parseSettings(null).reminderHour).toBe(19);
    const saved = JSON.stringify({ ...parseSettings(null), remindersEnabled: true, reminderHour: 9 });
    expect(parseSettings(saved)).toMatchObject({ remindersEnabled: true, reminderHour: 9 });
    expect(parseSettings(JSON.stringify({ ...parseSettings(null), reminderHour: 30 })).reminderHour).toBe(19);
  });
});

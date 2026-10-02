import { getDailyEntry, gameDisplayName } from '../../game/journey';
import { buildWidgetSchedule, SCHEDULE_DAYS, SCHEDULE_START } from '../schedule';

const fs = require('fs') as { readFileSync(path: string, encoding: 'utf8'): string };
declare const __dirname: string;

describe('the widget schedule', () => {
  it("names each day's real Daily", () => {
    const schedule = buildWidgetSchedule();
    expect(schedule.start).toBe(SCHEDULE_START);
    expect(schedule.days).toHaveLength(SCHEDULE_DAYS);
    const day = new Date('2026-12-25T08:00:00Z');
    const i = Math.round((Date.parse('2026-12-25T00:00:00Z') - Date.parse(`${SCHEDULE_START}T00:00:00Z`)) / 86400000);
    expect(schedule.days[i].n).toBe(getDailyEntry(day).name);
    expect(schedule.days[i].g).toBe(gameDisplayName(getDailyEntry(day).kind));
  });

  it('is the same file both widgets ship - regenerate it if the pools change', () => {
    const fresh = JSON.stringify(buildWidgetSchedule());
    for (const target of ['ios/TesseraWidget/daily-schedule.json', 'android/app/src/main/assets/daily-schedule.json']) {
      expect(fs.readFileSync(`${__dirname}/../../../${target}`, 'utf8')).toBe(fresh);
    }
  });
});

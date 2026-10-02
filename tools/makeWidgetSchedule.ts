/**
 * Writes the next two years of Dailies for the home-screen widgets, so a
 * widget can show today's real puzzle without the app having run today.
 * The Daily is chosen from the date alone (`getDailyEntry`), which is what
 * makes this possible. Re-run when the puzzle pools change - the test in
 * `src/widget/__tests__` fails until you do:
 *
 *     npx jest --testRegex 'tools/makeWidgetSchedule\.ts$'
 */
import { buildWidgetSchedule } from '../src/widget/schedule';

declare const require: (id: string) => { writeFileSync(path: string, data: string): void };
declare const __dirname: string;

test('write the widget schedule', () => {
  const fs = require('fs');
  const json = JSON.stringify(buildWidgetSchedule());
  for (const target of ['ios/TesseraWidget/daily-schedule.json', 'android/app/src/main/assets/daily-schedule.json']) {
    fs.writeFileSync(`${__dirname}/../${target}`, json);
  }
});

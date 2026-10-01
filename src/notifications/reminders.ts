import { dailyKeyOf, gameDisplayName, getDailyEntry, getWeeklyGrand } from '../game/journey';
import { getDisplayDailyStreak, isDailyCompleted, isGrandSolved, PlayerProgress } from '../progression';

/**
 * The daily reminder: a week of local notifications planned ahead, each
 * one about *that day's* Daily - by name - rather than a single repeating
 * "come back!" that says nothing. Re-planned whenever the app opens or
 * the day's state changes, so a Daily already solved never nags, and the
 * streak and the Weekly Grand's deadline are mentioned when they matter.
 *
 * Pure: it plans, `native.ts` schedules.
 */

export interface PlannedReminder {
  /** Stable per day, so re-planning replaces rather than duplicates. */
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Epoch milliseconds. */
  readonly at: number;
}

/** How many days ahead are planned. Opening the app within a week keeps
 * the plan topped up; a player gone longer than that is not chased. */
export const REMINDER_DAYS = 7;

const TITLES = ['Today’s Daily is ready', 'A fresh puzzle is waiting', 'Five quiet minutes?', 'Your Daily puzzle', 'A new board for today'];

export interface PlanInput {
  readonly now: Date;
  /** Local hour, 0-23. */
  readonly hour: number;
  readonly progress: PlayerProgress;
}

export function planReminders({ now, hour, progress }: PlanInput): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  const streak = getDisplayDailyStreak(progress, dailyKeyOf(now));
  for (let d = 0; d < REMINDER_DAYS; d += 1) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, 0, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const dayKey = dailyKeyOf(at);
    // The Daily that will be live then is already solved - nothing to say.
    if (isDailyCompleted(progress, dayKey)) continue;

    const daily = getDailyEntry(at);
    const lines = [`${daily.name}, a ${gameDisplayName(daily.kind)} puzzle.`];
    // Only the first reminder can know the streak for certain.
    if (plan.length === 0 && streak > 1) lines.push(`Your ${streak}-day streak is on the line.`);
    const grand = getWeeklyGrand(at, progress.retired);
    if (!isGrandSolved(progress, grand.week)) {
      if (grand.daysLeft === 7) lines.push(`New Weekly Grand: ${grand.name}.`);
      else if (grand.daysLeft === 1) lines.push('Last day for this week’s Grand.');
    }
    plan.push({
      id: `tessera-daily-${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`,
      title: TITLES[(at.getDate() + at.getMonth()) % TITLES.length],
      body: lines.join(' '),
      at: at.getTime(),
    });
  }
  return plan;
}

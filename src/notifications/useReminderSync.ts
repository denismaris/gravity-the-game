import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { dailyKeyOf } from '../game/journey';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { cancelReminders, scheduleReminders } from './native';
import { planReminders } from './reminders';

/**
 * Keeps the scheduled reminders in step with the save: re-planned when the
 * app comes to the foreground (the date may have moved on), when the
 * Daily is solved, and when the setting changes. Mounted once, at the root.
 */
export function useReminderSync(): void {
  const { settings, ready: settingsReady } = useSettings();
  const { progress, ready: progressReady } = usePlayerProgress();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  const enabled = settings.remindersEnabled;
  const hour = settings.reminderHour;
  // Only what the plan reads - not every coin or star - triggers a
  // re-plan.
  const signature = `${dailyKeyOf(now)}|${progress.daily.lastCompletedKey ?? ''}|${progress.daily.streak}|${progress.grandsSolved.length}|${progress.retired.join(',')}`;
  const plan = useMemo(
    () => (enabled ? planReminders({ now, hour, progress }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands in for `progress`
    [enabled, hour, signature],
  );

  useEffect(() => {
    if (!settingsReady || !progressReady) return;
    if (enabled) scheduleReminders(plan);
    else cancelReminders();
  }, [settingsReady, progressReady, enabled, plan]);
}

import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { dailyKeyOf, gameDisplayName, getDailyEntry } from '../game/journey';
import { experienceOf, usePlayerProgress } from '../progression';
import { getLevelStars } from '../progression/playerProgress';
import { reportDaily } from './daily';
import { backend } from './client';
import { syncProgress } from './cloudSave';
import { backendConfigured } from './config';
import { publishXp } from './profile';

/** How long progress must sit still before it is sent - a burst of play
 * becomes one write, not one per move. */
const QUIET_MS = 8000;

/**
 * Keeps this device's save in the cloud: once on launch, again a few
 * seconds after progress stops changing, and whenever the app goes to the
 * background. Does nothing while the backend is not configured.
 */
export function useCloudSync(): void {
  const { progress, ready, adoptProgress } = usePlayerProgress();
  const latest = useRef(progress);
  latest.current = progress;
  const hooks = useMemo(() => ({ getLocal: () => latest.current, adopt: adoptProgress }), [adoptProgress]);
  // After each sync, the all-time board learns the player's experience,
  // and today's Daily board the player's time, if it never reached it
  // (solved offline, or before the backend existed). Posting twice is
  // harmless: the database keeps one result per player per day.
  const sync = useMemo(
    () => () =>
      syncProgress(hooks).then(async () => {
        const now = latest.current;
        await publishXp(experienceOf(now));
        const dayKey = dailyKeyOf(new Date());
        const ms = now.dailyTimes[dayKey];
        if (ms && now.daily.lastCompletedKey === dayKey) {
          const daily = getDailyEntry();
          await reportDaily({ dayKey, game: gameDisplayName(daily.kind), ms, stars: getLevelStars(now, daily.puzzleId) || 1 });
        }
      }),
    [hooks],
  );
  const on = ready && backendConfigured();

  useEffect(() => {
    if (on) sync();
  }, [on, sync]);

  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(sync, QUIET_MS);
    return () => clearTimeout(timer);
  }, [on, sync, progress]);

  // Signing in (or into another account) syncs at once, so a player who
  // just restored their account sees their progress straight away.
  useEffect(() => {
    if (!on) return;
    const api = backend();
    if (!api) return;
    const { data } = api.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(sync, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [on, sync]);

  useEffect(() => {
    if (!on) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') sync();
    });
    return () => subscription.remove();
  }, [on, sync]);
}

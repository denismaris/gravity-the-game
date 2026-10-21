import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dailyKeyOf, nextDayStart } from '../game/journey';

/**
 * Today's key, kept current: it moves on at local midnight while the app
 * is open, and again whenever the app comes back to the front - so Home
 * shows the new Daily, errands and gift the moment the day turns, rather
 * than once something else happens to redraw it.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dailyKeyOf(new Date()));
  useEffect(() => {
    const check = () => setToday(current => {
      const now = dailyKeyOf(new Date());
      return now === current ? current : now;
    });
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      const now = new Date();
      // A beat past midnight, so the new day is certainly the one read.
      timer = setTimeout(() => {
        check();
        arm();
      }, nextDayStart(now) - now.getTime() + 500);
    };
    arm();
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      check();
      arm();
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return today;
}

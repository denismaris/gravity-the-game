import { accentColorForKind, dailyKeyOf, gameDisplayName, getDailyEntry } from '../game/journey';

/** The first day the bundled schedule covers, and how many it covers. */
export const SCHEDULE_START = '2026-10-01';
export const SCHEDULE_DAYS = 730;

export interface WidgetSchedule {
  readonly start: string;
  /** One per day from `start`: the puzzle's name, its game, and the game's
   * colour (in the light palette - the generator runs in it). */
  readonly days: ReadonlyArray<{ readonly n: string; readonly g: string; readonly c: string }>;
}

export function buildWidgetSchedule(): WidgetSchedule {
  // Local noons, one per calendar day: the widget reads the list by the
  // phone's own date, as the app keys its Daily.
  const [y, m, d] = SCHEDULE_START.split('-').map(Number);
  const days = Array.from({ length: SCHEDULE_DAYS }, (_v, i) => {
    const entry = getDailyEntry(new Date(y, m - 1, d + i, 12));
    return { n: entry.name, g: gameDisplayName(entry.kind), c: accentColorForKind(entry.kind) };
  });
  return { start: dailyKeyOf(new Date(y, m - 1, d, 12)), days };
}

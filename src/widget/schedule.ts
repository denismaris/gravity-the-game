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
  const start = Date.parse(`${SCHEDULE_START}T12:00:00Z`);
  const days = Array.from({ length: SCHEDULE_DAYS }, (_v, i) => {
    const entry = getDailyEntry(new Date(start + i * 86400000));
    return { n: entry.name, g: gameDisplayName(entry.kind), c: accentColorForKind(entry.kind) };
  });
  return { start: dailyKeyOf(new Date(start)), days };
}

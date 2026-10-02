import { formatDuration } from './timing';

export interface ShareMessageInput {
  readonly dailyStreak: number;
  readonly totalStars: number;
  readonly solved: number;
  readonly totalPuzzles: number;
}

/**
 * The Home stats card's "Share" button text - a Wordle-style brag, not a
 * progress report: leads with the streak when there is one (the number
 * worth showing off), falls back to the solved count when there isn't one
 * yet, so a brand-new player's first share still reads as something
 * rather than "0-day streak". Pure and exported on its own so its exact
 * wording is a tested contract, not something only visible by opening the
 * share sheet by hand.
 *
 * No link included - the app has no public App Store page yet; adding a
 * placeholder URL here would be worse than no URL at all.
 */
export function buildShareMessage({ dailyStreak, totalStars, solved, totalPuzzles }: ShareMessageInput): string {
  const headline =
    dailyStreak > 0
      ? `🔥 ${dailyStreak}-day streak on Tessera. ★${totalStars}, ${solved}/${totalPuzzles} solved.`
      : `★${totalStars} · ${solved}/${totalPuzzles} puzzles solved on Tessera.`;
  return `${headline}\nTwelve calm puzzle games, one app.`;
}

/** Daily #1 was the first day of 2026; every Daily since counts up from it. */
export const DAILY_EPOCH = '2026-01-01';

export function dailyNumber(dayKey: string): number {
  return Math.round((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)) / 86400000) + 1;
}

export interface DailyShareInput {
  readonly dayKey: string;
  /** The game's display name. */
  readonly game: string;
  readonly stars: number;
  /** The timed first solve, if there was one. */
  readonly ms: number | null;
  readonly streak: number;
}

/**
 * Today's Daily, as something to post: which Daily, how it went, and the
 * streak as a row of squares - the shape people already know from word
 * games, and nothing that gives the puzzle away.
 */
export function buildDailyShare({ dayKey, game, stars, ms, streak }: DailyShareInput): string {
  const s = Math.max(0, Math.min(3, Math.round(stars)));
  const rating = '★'.repeat(s) + '☆'.repeat(3 - s);
  const time = ms !== null && ms > 0 ? ` · ${formatDuration(ms)}` : '';
  const marks = Array.from({ length: 7 }, (_v, i) => (i < Math.min(streak, 7) ? '🟧' : '⬜')).join('');
  const run = streak > 0 ? `${marks} ${streak}-day streak` : marks;
  return `Tessera Daily #${dailyNumber(dayKey)} · ${game}\n${rating}${time}\n${run}`;
}

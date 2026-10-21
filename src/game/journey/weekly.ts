import { endlessId, GRAND_INDEX_BASE, parseEndlessId } from '../endlessId';
import { GameKind, puzzleDisplayInfo, ROTATION } from './gameKind';

/**
 * The Weekly Grand: one hard board a week, the same for everyone, with a
 * reward the shop does not sell. Like the Daily it is picked from the
 * calendar alone - no server - but from the *endless* stream rather than
 * the curated pools, at an index the dealer never reaches, so it is never
 * a board the player has already been dealt.
 *
 * Weeks run Monday to Sunday on the player's own calendar, like the
 * Daily's days.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since 1970-01-01 on the local calendar. */
function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Weeks since the Monday before 1970-01-01 (a Thursday). */
export function weekIndexOf(date: Date): number {
  return Math.floor((dayNumber(date) + 3) / 7);
}

/** Days left in this week, today included: 7 on a Monday, 1 on Sunday. */
export function daysLeftInWeek(date: Date): number {
  return 7 - ((dayNumber(date) + 3) % 7);
}

/** The game a week's Grand is in - the rotation in turn, stepping past
 * any game the player has retired. */
export function grandKindFor(week: number, retired: ReadonlyArray<GameKind> = [], games: ReadonlyArray<GameKind> | null = null): GameKind {
  for (let step = 0; step < ROTATION.length; step += 1) {
    const kind = ROTATION[(week + step) % ROTATION.length];
    if (!retired.includes(kind) && (!games || games.includes(kind))) return kind;
  }
  return games?.[0] ?? ROTATION[week % ROTATION.length];
}

export function grandIdFor(week: number, kind: GameKind, tier: 'medium' | 'hard' = 'hard'): string {
  return endlessId(kind, tier, GRAND_INDEX_BASE + week);
}

/** The week a Grand board belongs to, or null for any other puzzle. */
export function grandWeekOf(puzzleId: string): number | null {
  const endless = parseEndlessId(puzzleId);
  return endless && endless.index >= GRAND_INDEX_BASE ? endless.index - GRAND_INDEX_BASE : null;
}

export interface WeeklyGrand {
  readonly week: number;
  readonly kind: GameKind;
  readonly puzzleId: string;
  readonly name: string;
  readonly daysLeft: number;
  /** Hard, once every game has arrived; medium before. */
  readonly tier: 'medium' | 'hard';
}

/** `games`: the games this player has while they are still arriving (null
 * once all have) - a newcomer's Grand is one of their own games, and no
 * harder than medium, like everything else they are dealt then. */
export function getWeeklyGrand(date: Date = new Date(), retired: ReadonlyArray<GameKind> = [], games: ReadonlyArray<GameKind> | null = null): WeeklyGrand {
  const week = weekIndexOf(date);
  const kind = grandKindFor(week, retired, games);
  const tier = games ? 'medium' : 'hard';
  const puzzleId = grandIdFor(week, kind, tier);
  return { week, kind, puzzleId, name: puzzleDisplayInfo(kind, puzzleId)?.name ?? 'The Grand', daysLeft: daysLeftInWeek(date), tier };
}

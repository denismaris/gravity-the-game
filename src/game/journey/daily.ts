import { JOURNEY, JourneyEntry } from './playlist';

/**
 * The Daily puzzle: one entry from the interleaved Journey, deterministically
 * picked from the calendar date so every player sees the same puzzle on the
 * same day (no server, no random seed to sync) and it never changes if the
 * app is reopened later that day. Deliberately independent of Journey
 * *progress* - unlike "Continue", the Daily is a fixed side quest into the
 * whole pool, not a resume point, so it can hand out any puzzle regardless
 * of what the player has actually reached.
 */

/** `date` as a stable `YYYY-MM-DD` key in UTC, so the Daily can't change
 * mid-session just because a device crosses a local midnight in a different
 * timezone than it started the day in. */
export function dailyKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A small, fast string hash (FNV-1a) - only needs to spread dates evenly
 * across the Journey, not resist any kind of attack. */
/* eslint-disable no-bitwise -- FNV-1a is bitwise by definition */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
/* eslint-enable no-bitwise */

/** The Journey entry today's Daily card opens. Pure given `date` (defaults
 * to now) - same calendar day always maps to the same entry. */
export function getDailyEntry(date: Date = new Date()): JourneyEntry {
  const index = hashKey(dailyKeyOf(date)) % JOURNEY.length;
  return JOURNEY[index];
}

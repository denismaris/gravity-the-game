import { LEVELS } from '../levels';
import { MIRROR_MAZES } from '../mirror';
import { TENTS_TREES } from '../tents';
import { TOWERS } from '../towers';
import { BINAIRO } from '../binairo';
import { GameKind, puzzleDisplayInfo, ROTATION } from './gameKind';

/**
 * The Daily puzzle: one puzzle, deterministically picked from the calendar
 * date so every player sees the same puzzle on the same day (no server, no
 * random seed to sync) and it never changes if the app is reopened later
 * that day. Deliberately independent of the level/batch system's own
 * *progress* - unlike "Continue", the Daily is a fixed side quest into the
 * whole pool, not a resume point, so it can hand out any puzzle regardless
 * of what the player has actually reached. It used to also be dependent on
 * the *pool* the old interleaved Journey dealt out (hashing an index into
 * that array) - since that system is gone, this hashes into its own flat,
 * stable concatenation of every puzzle in every game instead (`ALL_PUZZLES`
 * below), built once, in `ROTATION` order, Gravity sorted by its own
 * `order` field (matching this list's one behavioural requirement: stable
 * order across app restarts, not any particular ordering rationale beyond
 * that). One real side effect of this change worth knowing: because the
 * array shape itself changed (a flat concatenation now, not the old
 * interleaved deal), a given calendar date's hash lands on a different
 * puzzle than it would have before - today's and future Dailies shift;
 * already-recorded past streak/completion data is unaffected, since that
 * only ever stored the date and outcome, never which puzzle it was.
 */
interface PuzzleRef {
  readonly kind: GameKind;
  readonly puzzleId: string;
}

function buildAllPuzzles(): ReadonlyArray<PuzzleRef> {
  const gravity: PuzzleRef[] = [...LEVELS].sort((a, b) => a.order - b.order).map(level => ({ kind: 'gravity' as const, puzzleId: level.id }));
  const mirror: PuzzleRef[] = MIRROR_MAZES.map(puzzle => ({ kind: 'mirror' as const, puzzleId: puzzle.id }));
  const tents: PuzzleRef[] = TENTS_TREES.map(puzzle => ({ kind: 'tents' as const, puzzleId: puzzle.id }));
  const towers: PuzzleRef[] = TOWERS.map(puzzle => ({ kind: 'towers' as const, puzzleId: puzzle.id }));
  const binairo: PuzzleRef[] = BINAIRO.map(puzzle => ({ kind: 'binairo' as const, puzzleId: puzzle.id }));
  const byKind: Record<GameKind, PuzzleRef[]> = { gravity, mirror, tents, towers, binairo };
  return ROTATION.flatMap(kind => byKind[kind]);
}

/** Static - every game's pool is fixed at build time. */
const ALL_PUZZLES: ReadonlyArray<PuzzleRef> = buildAllPuzzles();

/** `date` as a stable `YYYY-MM-DD` key in UTC, so the Daily can't change
 * mid-session just because a device crosses a local midnight in a different
 * timezone than it started the day in. */
export function dailyKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A small, fast string hash (FNV-1a) - only needs to spread dates evenly
 * across the pool, not resist any kind of attack. */
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

export interface DailyEntry {
  readonly kind: GameKind;
  readonly puzzleId: string;
  readonly name: string;
  readonly chapter: string;
}

/** The puzzle today's Daily card opens. Pure given `date` (defaults to
 * now) - same calendar day always maps to the same entry. */
export function getDailyEntry(date: Date = new Date()): DailyEntry {
  const index = hashKey(dailyKeyOf(date)) % ALL_PUZZLES.length;
  const ref = ALL_PUZZLES[index];
  // Every ref in `ALL_PUZZLES` is built directly from its own game's live
  // pool above, so `puzzleDisplayInfo` resolving it is not a real failure
  // mode - the fallback exists only to satisfy the return type, never to
  // paper over an actually-missing puzzle.
  const info = puzzleDisplayInfo(ref.kind, ref.puzzleId) ?? { name: ref.puzzleId, chapter: '' };
  return { kind: ref.kind, puzzleId: ref.puzzleId, name: info.name, chapter: info.chapter };
}

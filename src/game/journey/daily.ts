import { grandWeekOf } from './weekly';
import { LEVELS } from '../levels';
import { MIRROR_MAZES } from '../mirror';
import { LILY_PONDS } from '../lilypads';
import { VANE_ROOFS } from '../vanes';
import { ARUKONE } from '../arukone';
import { BINAIRO } from '../binairo';
import { GLASS_WINDOWS } from '../glass';
import { LIGHTS_OUT } from '../lightsout';
import { BLOOM } from '../bloom';
import { MOSAIC } from '../mosaic';
import { BRIDGES } from '../bridges';
import { ADJACENT } from '../adjacent';
import { GameKind, puzzleDisplayInfo, ROTATION } from './gameKind';
import { DAILY_INDEX_BASE, endlessId } from '../endlessId';

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
  const lilypads: PuzzleRef[] = LILY_PONDS.map(puzzle => ({ kind: 'lilypads' as const, puzzleId: puzzle.id }));
  const vanes: PuzzleRef[] = VANE_ROOFS.map(puzzle => ({ kind: 'vanes' as const, puzzleId: puzzle.id }));
  const binairo: PuzzleRef[] = BINAIRO.map(puzzle => ({ kind: 'binairo' as const, puzzleId: puzzle.id }));
  const arukone: PuzzleRef[] = ARUKONE.map(puzzle => ({ kind: 'arukone' as const, puzzleId: puzzle.id }));
  const glass: PuzzleRef[] = GLASS_WINDOWS.map(puzzle => ({ kind: 'glass' as const, puzzleId: puzzle.id }));
  const lightsout: PuzzleRef[] = LIGHTS_OUT.map(puzzle => ({ kind: 'lightsout' as const, puzzleId: puzzle.id }));
  const adjacent: PuzzleRef[] = ADJACENT.map(puzzle => ({ kind: 'adjacent' as const, puzzleId: puzzle.id }));
  const bloom: PuzzleRef[] = BLOOM.map(puzzle => ({ kind: 'bloom' as const, puzzleId: puzzle.id }));
  const mosaic: PuzzleRef[] = MOSAIC.map(puzzle => ({ kind: 'mosaic' as const, puzzleId: puzzle.id }));
  const bridges: PuzzleRef[] = BRIDGES.map(puzzle => ({ kind: 'bridges' as const, puzzleId: puzzle.id }));
  const byKind: Record<GameKind, PuzzleRef[]> = { gravity, mirror, lilypads, vanes, binairo, arukone, glass, lightsout, adjacent, bloom, mosaic, bridges };
  return ROTATION.flatMap(kind => byKind[kind]).filter(ref => !bringsLaterRule(ref.puzzleId));
}

/**
 * Boards that bring a later rule (twin lanterns, vines, sand, fog and the
 * rest) stay out of the Daily: it is shared by everyone, newcomers
 * included, and its pool must not shift when such boards are added - a
 * shifted pool would hand players on two app versions two different
 * Dailies on the same day. They all carry ids of their own: a letter
 * before the number (`glass-medium-g01`), or a Gravity level past 230.
 */
export function bringsLaterRule(puzzleId: string): boolean {
  if (/-[a-z]\d\d$/.test(puzzleId)) return true;
  const level = /^level-(\d+)$/.exec(puzzleId);
  return !!level && Number(level[1]) > 230;
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
  /** The Daily everyone shares today (false: this player's own, while
   * their games are still arriving), so only it is posted to the world. */
  readonly shared: boolean;
}

/**
 * The games this player has, while they are still arriving one by one (null
 * once all have). Set by the progress provider whenever that changes, so
 * every caller of `getDailyEntry` - many of them render-time checks that
 * see only a puzzle id - agrees on the same Daily without being handed the
 * save.
 */
let roster: ReadonlyArray<GameKind> | null = null;

export function setDailyRoster(games: ReadonlyArray<GameKind> | null): void {
  roster = games;
}

function entryOf(ref: PuzzleRef, shared: boolean): DailyEntry {
  // Every ref in `ALL_PUZZLES` is built directly from its own game's live
  // pool above, so the fallback only satisfies the return type.
  const info = puzzleDisplayInfo(ref.kind, ref.puzzleId) ?? { name: ref.puzzleId, chapter: '' };
  return { kind: ref.kind, puzzleId: ref.puzzleId, name: info.name, chapter: info.chapter, shared };
}

/** A puzzle a newcomer can be dealt: one of their games, never hard. */
function suitsNewcomer(ref: PuzzleRef, games: ReadonlyArray<GameKind>): boolean {
  return games.includes(ref.kind) && puzzleDisplayInfo(ref.kind, ref.puzzleId)?.difficulty !== 'hard';
}

/** A newcomer's own Daily: a generated board of one of their games, from
 * a range of boards no set ever deals (`DAILY_INDEX_BASE`), easy and
 * medium on alternate days. */
function newcomerDaily(dayKey: string, hash: number, games: ReadonlyArray<GameKind>): PuzzleRef {
  const day = Math.round(Date.parse(`${dayKey}T00:00:00Z`) / 86400000);
  const kind = games[hash % games.length];
  return { kind, puzzleId: endlessId(kind, day % 2 === 0 ? 'easy' : 'medium', DAILY_INDEX_BASE + (day % 9000)) };
}

/** The puzzle today's Daily card opens. Pure given `date` (defaults to
 * now) and the roster - same calendar day always maps to the same entry.
 * A player whose games are still arriving gets the shared Daily when it is
 * one of their games and not hard; otherwise a Daily of their own, picked
 * the same way from what they can already play. */
export function getDailyEntry(date: Date = new Date()): DailyEntry {
  const dayKey = dailyKeyOf(date);
  const games = roster;
  const cacheKey = `${dayKey}|${games ? games.join(',') : '*'}`;
  if (cached?.key === cacheKey) return cached.entry;
  const hash = hashKey(dayKey);
  const ref = ALL_PUZZLES[hash % ALL_PUZZLES.length];
  let entry: DailyEntry;
  if (!games || suitsNewcomer(ref, games)) entry = entryOf(ref, true);
  else entry = games.length > 0 ? entryOf(newcomerDaily(dayKey, hash, games), false) : entryOf(ref, true);
  cached = { key: cacheKey, entry };
  return entry;
}

/** The last answer: the Daily is asked for on every render of a board. */
let cached: { key: string; entry: DailyEntry } | null = null;

/** Whether `puzzleId` is today's Daily - which is played on its own, not
 * as part of the level set, and so ends back at Home. */
export function isTodaysDaily(puzzleId: string, date: Date = new Date()): boolean {
  return getDailyEntry(date).puzzleId === puzzleId;
}

/**
 * A puzzle played on its own, outside the sets: today's Daily or a Weekly
 * Grand. Finishing one ends there - its card offers Home, never a Next
 * into the player's usual levels.
 */
export function isStandalonePuzzle(puzzleId: string, date: Date = new Date()): boolean {
  return isTodaysDaily(puzzleId, date) || grandWeekOf(puzzleId) !== null;
}

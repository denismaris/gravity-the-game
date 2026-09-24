import { StorageBackend } from '../storage';
import { StarRating } from '../game/scoring';
import { GameKind, ROTATION } from '../game/journey';
import { BatchPuzzleRef, BatchState } from './batches';
import {
  DailyStatus,
  emptyProgress,
  EMPTY_DAILY,
  PLAYER_PROGRESS_VERSION,
  PlayerProgress,
  ProgressCursor,
} from './playerProgress';

/** Single key everything player-progress-related is stored under. */
export const PLAYER_PROGRESS_KEY = 'gravity:player-progress';

/** Schema versions this build knows how to read (newest first). v1 had no
 * `cursor`; v2 had no `daily`; v3 had no `bestDailyStreak`; v4 had no
 * `currentLevel`/`currentBatch`/`adFreeTimeRemainingMs`. All are migrated
 * forward by defaulting the missing field. */
const READABLE_VERSIONS = [5, 4, 3, 2, 1];

function isStarRating(value: unknown): value is StarRating {
  return value === 1 || value === 2 || value === 3;
}

function parseLevels(
  value: unknown,
): Record<string, { completed: true; stars: StarRating; bestMoves: number }> {
  const levels: Record<string, { completed: true; stars: StarRating; bestMoves: number }> = {};
  if (typeof value !== 'object' || value === null) return levels;

  for (const [levelId, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue !== 'object' || entryValue === null) continue;
    const entry = entryValue as { stars?: unknown; bestMoves?: unknown };
    if (!isStarRating(entry.stars)) continue;
    if (
      typeof entry.bestMoves !== 'number' ||
      !Number.isFinite(entry.bestMoves) ||
      entry.bestMoves < 1
    ) {
      continue;
    }
    levels[levelId] = {
      completed: true,
      stars: entry.stars,
      bestMoves: Math.floor(entry.bestMoves),
    };
  }
  return levels;
}

function parseCursor(value: unknown): ProgressCursor | null {
  if (typeof value !== 'object' || value === null) return null;
  const cursor = value as { worldId?: unknown; levelId?: unknown };
  if (typeof cursor.worldId !== 'string' || typeof cursor.levelId !== 'string') return null;
  return { worldId: cursor.worldId, levelId: cursor.levelId };
}

function parseDaily(value: unknown): DailyStatus {
  if (typeof value !== 'object' || value === null) return EMPTY_DAILY;
  const daily = value as { streak?: unknown; lastCompletedKey?: unknown };
  if (typeof daily.streak !== 'number' || !Number.isFinite(daily.streak) || daily.streak < 0) {
    return EMPTY_DAILY;
  }
  if (daily.lastCompletedKey !== null && typeof daily.lastCompletedKey !== 'string') {
    return EMPTY_DAILY;
  }
  return { streak: Math.floor(daily.streak), lastCompletedKey: daily.lastCompletedKey ?? null };
}

/**
 * `bestDailyStreak` is new in v4. For older data (or a corrupt value) it
 * backfills from the just-parsed `daily.streak` - not a true historical
 * peak (the game never recorded one before v4), but a fair, honest floor:
 * whatever streak a player currently holds, they have necessarily reached
 * at least that high before.
 */
function parseBestDailyStreak(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.max(Math.floor(value), fallback);
  }
  return fallback;
}

/** `currentLevel` is new in v5. Older data (or a corrupt value) defaults to
 * 1, the level-batch system's own starting point. */
function parseCurrentLevel(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  return 1;
}

const GAME_KINDS: ReadonlySet<string> = new Set(ROTATION);

function isGameKind(value: unknown): value is GameKind {
  return typeof value === 'string' && GAME_KINDS.has(value);
}

function parseBatchPuzzleRef(value: unknown): BatchPuzzleRef | null {
  if (typeof value !== 'object' || value === null) return null;
  const ref = value as { kind?: unknown; puzzleId?: unknown };
  if (!isGameKind(ref.kind) || typeof ref.puzzleId !== 'string') return null;
  return { kind: ref.kind, puzzleId: ref.puzzleId };
}

/**
 * `currentBatch` is new in v5 - older data (or anything malformed) has none,
 * which `PlayerProgressProvider` treats as "generate level 1's batch on
 * load" (see its own comment). A batch that partially fails to parse (one
 * bad puzzle ref among otherwise-good ones) is discarded wholesale rather
 * than salvaged cell-by-cell the way `parseLevels` does for individual
 * levels - a batch's own puzzle list is a single fixed decision made at
 * generation time, not independently-meaningful entries, so a partial
 * batch isn't a meaningfully "smaller but still valid" one the way a
 * partial `levels` map is.
 */
function parseCurrentBatch(value: unknown): BatchState | null {
  if (typeof value !== 'object' || value === null) return null;
  const batch = value as { levelNumber?: unknown; puzzles?: unknown; completedPuzzleIds?: unknown };
  if (typeof batch.levelNumber !== 'number' || !Number.isFinite(batch.levelNumber) || batch.levelNumber < 1) return null;
  if (!Array.isArray(batch.puzzles) || batch.puzzles.length === 0) return null;

  const puzzles: BatchPuzzleRef[] = [];
  for (const entry of batch.puzzles) {
    const ref = parseBatchPuzzleRef(entry);
    if (!ref) return null;
    puzzles.push(ref);
  }

  const puzzleIds = new Set(puzzles.map(p => p.puzzleId));
  const completedPuzzleIds = Array.isArray(batch.completedPuzzleIds)
    ? batch.completedPuzzleIds.filter((id): id is string => typeof id === 'string' && puzzleIds.has(id))
    : [];

  return { levelNumber: Math.floor(batch.levelNumber), puzzles, completedPuzzleIds };
}

/** `adFreeTimeRemainingMs` is new in v5 - a stub for a future ad-free-time
 * reward system (see its own comment in `playerProgress.ts`). `null` (the
 * default) means "unused", the only meaningful value today. */
function parseAdFreeTimeRemainingMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return null;
}

/**
 * Parses whatever came back from storage into a trusted `PlayerProgress`.
 * Anything unexpected - missing key, malformed JSON, unreadable version, a
 * corrupt entry - degrades to an empty (or partially salvaged) progress
 * rather than throwing. Losing corrupt data is acceptable; crashing on
 * launch is not. Older readable schema versions are migrated forward, so a
 * player never loses stars just because the app updated.
 */
export function parseProgress(raw: string | null): PlayerProgress {
  if (!raw) return emptyProgress();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }

  if (typeof parsed !== 'object' || parsed === null) return emptyProgress();

  const record = parsed as {
    version?: unknown;
    levels?: unknown;
    cursor?: unknown;
    daily?: unknown;
    bestDailyStreak?: unknown;
    currentLevel?: unknown;
    currentBatch?: unknown;
    adFreeTimeRemainingMs?: unknown;
  };
  if (typeof record.version !== 'number' || !READABLE_VERSIONS.includes(record.version)) {
    return emptyProgress();
  }

  const daily = parseDaily(record.daily);

  return {
    version: PLAYER_PROGRESS_VERSION,
    levels: parseLevels(record.levels),
    // v1 has no cursor; parseCursor handles its absence.
    cursor: parseCursor(record.cursor),
    // v1/v2 have no daily streak; parseDaily handles its absence.
    daily,
    // v1/v2/v3 have no bestDailyStreak; back-filled from the live streak.
    bestDailyStreak: parseBestDailyStreak(record.bestDailyStreak, daily.streak),
    // v1-v4 have none of these three; all default to "level-batch system
    // hasn't started yet" - `PlayerProgressProvider` generates level 1's
    // batch on load when it sees `currentBatch === null`.
    currentLevel: parseCurrentLevel(record.currentLevel),
    currentBatch: parseCurrentBatch(record.currentBatch),
    adFreeTimeRemainingMs: parseAdFreeTimeRemainingMs(record.adFreeTimeRemainingMs),
  };
}

/** Loads persisted progress. Never rejects - returns empty progress on any failure. */
export async function loadProgress(backend: StorageBackend): Promise<PlayerProgress> {
  try {
    const raw = await backend.getItem(PLAYER_PROGRESS_KEY);
    return parseProgress(raw);
  } catch {
    return emptyProgress();
  }
}

/** Persists progress. Resolves even if the write fails (best-effort). */
export async function saveProgress(
  backend: StorageBackend,
  progress: PlayerProgress,
): Promise<void> {
  try {
    await backend.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // best-effort; in-memory state remains the source of truth this session
  }
}

/** Wipes persisted progress (used by tests / a future "reset progress" action). */
export async function clearProgress(backend: StorageBackend): Promise<void> {
  try {
    await backend.removeItem(PLAYER_PROGRESS_KEY);
  } catch {
    // ignore
  }
}

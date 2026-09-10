import { StorageBackend } from '../storage';
import { StarRating } from '../game/scoring';
import {
  emptyProgress,
  PLAYER_PROGRESS_VERSION,
  PlayerProgress,
  ProgressCursor,
} from './playerProgress';

/** Single key everything player-progress-related is stored under. */
export const PLAYER_PROGRESS_KEY = 'gravity:player-progress';

/** Schema versions this build knows how to read (newest first). v1 had no
 * `cursor` and is migrated forward by defaulting it to null. */
const READABLE_VERSIONS = [2, 1];

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

  const record = parsed as { version?: unknown; levels?: unknown; cursor?: unknown };
  if (typeof record.version !== 'number' || !READABLE_VERSIONS.includes(record.version)) {
    return emptyProgress();
  }

  return {
    version: PLAYER_PROGRESS_VERSION,
    levels: parseLevels(record.levels),
    // v1 has no cursor; parseCursor handles its absence.
    cursor: parseCursor(record.cursor),
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

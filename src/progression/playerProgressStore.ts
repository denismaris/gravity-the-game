import { migrateVillaIds } from './villa';
import { COSMETIC_SLOTS } from './shop';
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
import { STARTING_COINS, STARTING_INSIGHTS } from './coins';
import { EMPTY_GIFT, GIFT_DAYS, GiftLog } from './gift';

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
  const ref = value as { kind?: unknown; puzzleId?: unknown; challenge?: unknown; golden?: unknown; extreme?: unknown };
  if (!isGameKind(ref.kind) || typeof ref.puzzleId !== 'string') return null;
  // An extreme is always a challenge, so it keeps both flags.
  if (ref.extreme === true) return { kind: ref.kind, puzzleId: ref.puzzleId, challenge: true, ...(ref.golden === true ? { golden: true } : {}), extreme: true };
  if (ref.golden === true) return { kind: ref.kind, puzzleId: ref.puzzleId, ...(ref.challenge === true ? { challenge: true } : {}), golden: true };
  // `challenge` post-dates v5 and is deliberately not a version bump: a
  // batch saved without it is a valid batch with no challenge slot, which
  // is exactly what an absent flag already means. Kept off the object
  // entirely when false so a round-trip through storage is byte-identical
  // to what `generateBatch` produced.
  if (ref.challenge === true) return { kind: ref.kind, puzzleId: ref.puzzleId, challenge: true };
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
/** A save from before coins existed reads as holding the starting grant;
 * anything malformed does too, rather than a negative or fractional
 * balance leaking into the UI. */
function parseCoins(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  return STARTING_COINS;
}

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
    coins?: unknown;
    errands?: unknown;
    errandsClaimed?: unknown;
    rankRewarded?: unknown;
    chaptersClaimed?: unknown;
    owned?: unknown;
    equipped?: unknown;
    streakFreezes?: unknown;
    retired?: unknown;
    luckyCharges?: unknown;
    insights?: unknown;
    cleanRun?: unknown;
    grandsSolved?: unknown;
    stampsClaimed?: unknown;
    introSeen?: unknown;
    shopGoal?: unknown;
    today?: unknown;
    dailyTimes?: unknown;
    gift?: unknown;
    setsClaimed?: unknown;
    tesserae?: unknown;
    villa?: unknown;
    patron?: unknown;
    adFreeUntil?: unknown;
  };
  if (typeof record.version !== 'number' || !READABLE_VERSIONS.includes(record.version)) {
    return emptyProgress();
  }

  const daily = parseDaily(record.daily);
  const levels = parseLevels(record.levels);

  return {
    version: PLAYER_PROGRESS_VERSION,
    levels,
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
    coins: parseCoins(record.coins),
    // Everything below post-dates v5 and is read without a version bump:
    // missing or malformed reads as the default.
    errands: parseErrands(record.errands),
    errandsClaimed: parseCount(record.errandsClaimed, 0),
    // A save from before ranks starts at rank 1 celebrated, so every rank
    // it has already earned is waiting to be collected.
    rankRewarded: Math.max(1, parseCount(record.rankRewarded, 1)),
    chaptersClaimed: Array.isArray(record.chaptersClaimed)
      ? record.chaptersClaimed.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1)
      : [],
    owned: Array.isArray(record.owned) ? record.owned.filter((id): id is string => typeof id === 'string') : [],
    equipped: parseEquipped(record.equipped),
    streakFreezes: Math.min(3, parseCount(record.streakFreezes, 0)),
    retired: Array.isArray(record.retired) ? [...new Set(record.retired.filter(isGameKind))].slice(0, 3) : [],
    luckyCharges: parseCount(record.luckyCharges, 0),
    // A save from before Insight existed starts with the same few charges.
    insights: parseCount(record.insights, STARTING_INSIGHTS),
    cleanRun: parseCount(record.cleanRun, 0),
    grandsSolved: Array.isArray(record.grandsSolved)
      ? [...new Set(record.grandsSolved.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0))]
      : [],
    stampsClaimed: Array.isArray(record.stampsClaimed) ? [...new Set(record.stampsClaimed.filter((id): id is string => typeof id === 'string'))] : [],
    // A save from before the walkthrough that has played already knows
    // the way round; only a genuinely new one is shown it.
    introSeen: typeof record.introSeen === 'boolean' ? record.introSeen : Object.keys(levels).length > 0,
    shopGoal: typeof record.shopGoal === 'string' ? record.shopGoal : null,
    today: parseToday(record.today),
    dailyTimes: parseDailyTimes(record.dailyTimes),
    gift: parseGift(record.gift),
    patron: record.patron === true,
    adFreeUntil: typeof record.adFreeUntil === 'number' && Number.isFinite(record.adFreeUntil) && record.adFreeUntil > 0 ? record.adFreeUntil : null,
    setsClaimed: Array.isArray(record.setsClaimed) ? [...new Set(record.setsClaimed.filter((id): id is string => typeof id === 'string'))] : [],
    // A save from before the Villa starts with two tiles for every puzzle
    // it has solved, so a long-time player arrives with something to build.
    tesserae: parseCount(record.tesserae, Object.keys(levels).length * 2),
    // Pieces built in the first version (one room) carry into the first villa.
    villa: Array.isArray(record.villa) ? migrateVillaIds(record.villa.filter((id): id is string => typeof id === 'string')) : [],
  };
}

function parseGift(value: unknown): GiftLog {
  const v = value as { lastKey?: unknown; day?: unknown } | null;
  if (!v || typeof v.lastKey !== 'string' || !/^(\d{4}-\d{2}-\d{2})?$/.test(v.lastKey)) return EMPTY_GIFT;
  const day = typeof v.day === 'number' && Number.isInteger(v.day) && v.day >= 0 && v.day <= GIFT_DAYS ? v.day : 0;
  return { lastKey: v.lastKey, day };
}

function parseDailyTimes(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = Math.round(v);
  }
  return out;
}

function parseToday(value: unknown): PlayerProgress['today'] {
  const v = value as { dayKey?: unknown; solves?: unknown } | null;
  if (!v || typeof v.dayKey !== 'string') return { dayKey: '', solves: 0 };
  return { dayKey: v.dayKey, solves: parseCount(v.solves, 0) };
}

function parseCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function parseErrands(value: unknown): PlayerProgress['errands'] {
  if (typeof value !== 'object' || value === null) return null;
  const log = value as { dayKey?: unknown; progress?: unknown; claimed?: unknown };
  if (typeof log.dayKey !== 'string' || !Array.isArray(log.progress) || !Array.isArray(log.claimed)) return null;
  if (log.progress.length !== 3 || log.claimed.length !== 3) return null;
  return {
    dayKey: log.dayKey,
    progress: log.progress.map(n => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0)),
    claimed: log.claimed.map(c => c === true),
  };
}

function parseEquipped(value: unknown): PlayerProgress['equipped'] {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  // Every slot - an earlier list here had left out page art, so a worn
  // blossom colour was forgotten on every relaunch.
  for (const slot of COSMETIC_SLOTS) {
    const id = (value as Record<string, unknown>)[slot];
    if (typeof id === 'string') out[slot] = id;
  }
  return out;
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

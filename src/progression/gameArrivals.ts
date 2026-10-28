import { createDefaultBackend, StorageBackend } from '../storage';
import { GameKind } from '../game/journey';

/**
 * The games a player has already been shown arriving, so Home can greet a
 * new one once, with a proper reveal, rather than it simply being there in
 * the set row one day.
 *
 * Kept in memory and loaded once during the launch, like the board saves.
 * The very first time (a new install, or a player from before this was
 * kept) every game already held is taken as seen: only a game that
 * arrives from now on is revealed.
 */
const KEY = 'tessera.gamesSeen.v1';

let seen: Set<GameKind> | null = null;
let backend: StorageBackend | null = null;
let loaded = false;

/** Whether what was seen has been read back yet: nothing is greeted before. */
export function arrivalsLoaded(): boolean {
  return loaded;
}

const waiting: Array<() => void> = [];
/** Runs `then` once what was seen is read back (now, if it already is). */
export function whenArrivalsLoaded(then: () => void): () => void {
  if (loaded) {
    then();
    return () => {};
  }
  waiting.push(then);
  return () => {
    const i = waiting.indexOf(then);
    if (i >= 0) waiting.splice(i, 1);
  };
}

export async function loadGameArrivals(storage: StorageBackend = createDefaultBackend()): Promise<void> {
  backend = storage;
  try {
    const raw = await storage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    seen = Array.isArray(parsed) ? new Set(parsed.filter((k): k is GameKind => typeof k === 'string')) : null;
  } catch {
    seen = null;
  }
  loaded = true;
  waiting.splice(0).forEach(then => then());
}

function save(): void {
  if (!seen) return;
  (backend ?? createDefaultBackend()).setItem(KEY, JSON.stringify([...seen])).catch(() => {});
}

/**
 * The game that has arrived since the player last looked, if any. On the
 * first look ever, every game already held is taken as seen.
 */
export function newlyArrived(held: ReadonlyArray<GameKind>, played: ReadonlySet<GameKind> = new Set()): GameKind | null {
  if (!seen) {
    seen = new Set(held);
    save();
    return null;
  }
  // A game already played is never greeted as new, whatever was recorded.
  const known = held.filter(kind => played.has(kind) && !seen!.has(kind));
  if (known.length > 0) {
    known.forEach(kind => seen!.add(kind));
    save();
  }
  return held.find(kind => !seen!.has(kind)) ?? null;
}

export function markArrivalSeen(kind: GameKind): void {
  if (!seen) seen = new Set();
  seen.add(kind);
  save();
}

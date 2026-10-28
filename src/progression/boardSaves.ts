import { useEffect, useRef } from 'react';
import { createDefaultBackend, StorageBackend } from '../storage';

/**
 * Boards left half played, kept so they open again exactly as they were.
 *
 * Leaving a board (Home, a phone call, the app closed) used to throw it
 * away: the next visit dealt it fresh. Each game now saves its board as it
 * changes and reads it back when the board opens; a solve clears it.
 *
 * Held in memory and read synchronously, so a board's first frame is
 * already the saved one; loaded from storage once, during the launch
 * (`loadBoardSaves`), and written back a moment after each change.
 */
const KEY = 'tessera.boardSaves.v1';
/** The most boards kept at once: the oldest go first. */
const LIMIT = 40;
/** A change is written this long after the last one, so a run of moves is
 * one write. */
const WRITE_AFTER_MS = 600;

export interface BoardSave {
  readonly state: unknown;
  /** Counters that belong to the attempt: Insight used, presses made. */
  readonly extras: Readonly<Record<string, number>>;
  readonly at: number;
}

let saves: Record<string, BoardSave> = {};
let backend: StorageBackend | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadBoardSaves(storage: StorageBackend = createDefaultBackend()): Promise<void> {
  backend = storage;
  try {
    const raw = await storage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === 'object') saves = parsed as Record<string, BoardSave>;
  } catch {
    saves = {};
  }
}

function scheduleWrite(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    (backend ?? createDefaultBackend()).setItem(KEY, JSON.stringify(saves)).catch(() => {});
  }, WRITE_AFTER_MS);
}

/**
 * Whether `saved` has the same shape as a fresh board: the same keys, and
 * arrays of the same length all the way down. A save from before an update
 * that changed a board's make-up is dropped rather than trusted.
 */
export function sameShape(saved: unknown, fresh: unknown): boolean {
  if (fresh === null || typeof fresh !== 'object') return typeof saved === typeof fresh || (fresh === null && (saved === null || typeof saved !== 'object'));
  if (saved === null || typeof saved !== 'object') return false;
  if (Array.isArray(fresh)) {
    if (!Array.isArray(saved) || saved.length !== fresh.length) return false;
    return fresh.every((f, i) => f === null || saved[i] === null || sameShape(saved[i], f));
  }
  if (Array.isArray(saved)) return false;
  const keys = Object.keys(fresh as object).filter(k => (fresh as Record<string, unknown>)[k] !== undefined);
  return keys.every(k => k in (saved as object) && sameShape((saved as Record<string, unknown>)[k], (fresh as Record<string, unknown>)[k]));
}

/** The board saved for `puzzleId`, if it still fits `fresh`. */
export function savedBoard<T>(puzzleId: string, fresh: T): { state: T; extras: Readonly<Record<string, number>> } | null {
  const save = saves[puzzleId];
  if (!save) return null;
  if (!sameShape(save.state, fresh)) {
    forgetBoard(puzzleId);
    return null;
  }
  return { state: save.state as T, extras: save.extras ?? {} };
}

export function saveBoard(puzzleId: string, state: unknown, extras: Readonly<Record<string, number>> = {}): void {
  saves[puzzleId] = { state, extras, at: Date.now() };
  const ids = Object.keys(saves);
  if (ids.length > LIMIT) {
    ids.sort((a, b) => saves[a].at - saves[b].at);
    for (const id of ids.slice(0, ids.length - LIMIT)) delete saves[id];
  }
  scheduleWrite();
}

export function forgetBoard(puzzleId: string): void {
  if (!(puzzleId in saves)) return;
  delete saves[puzzleId];
  scheduleWrite();
}

/** Every save gone: a progress reset, or signing out. */
export function forgetAllBoards(): void {
  saves = {};
  scheduleWrite();
}

/** Whether a board for `puzzleId` is waiting half played. */
export function hasSavedBoard(puzzleId: string): boolean {
  return puzzleId in saves;
}

/**
 * Keeps `puzzleId`'s board saved while it is played: written on every
 * change, forgotten once solved. A board that has not moved from its fresh
 * state saves nothing. Off (`enabled` false) for boards that must not be
 * resumed, such as the timed Daily.
 */
export function useSaveBoard(puzzleId: string, state: unknown, solved: boolean, extras: Readonly<Record<string, number>> = {}, enabled = true): void {
  const first = useRef(state);
  const extrasKey = JSON.stringify(extras);
  useEffect(() => {
    if (!enabled) return;
    if (solved) {
      forgetBoard(puzzleId);
      return;
    }
    // Untouched: nothing worth keeping.
    const counted = JSON.parse(extrasKey) as Record<string, number>;
    if (state === first.current && Object.values(counted).every(v => v === 0)) return;
    saveBoard(puzzleId, state, counted);
  }, [puzzleId, state, solved, extrasKey, enabled]);
}

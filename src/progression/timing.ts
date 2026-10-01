/**
 * How long a puzzle took: the moment it was opened, kept here (not in the
 * save - a solve never spans an app restart that matters), and read back
 * when it is solved. One puzzle at a time, as the app plays them.
 */
let opened: { id: string; at: number } | null = null;

export function notePuzzleOpened(id: string, now = Date.now()): void {
  if (opened?.id !== id) opened = { id, at: now };
}

/** Milliseconds since `id` was opened, or null if it wasn't the one open. */
export function elapsedFor(id: string, now = Date.now()): number | null {
  return opened?.id === id ? Math.max(0, now - opened.at) : null;
}

/** "2:31" / "12:04". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Where `ms` sits among `times` (all the player's Daily times, this one
 * included): its 1-based place from fastest, and the share it beat. */
export function standing(ms: number, times: ReadonlyArray<number>): { place: number; of: number; beat: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const place = sorted.indexOf(ms) + 1;
  const slower = times.filter(t => t > ms).length;
  return { place, of: times.length, beat: times.length > 1 ? slower / (times.length - 1) : 0 };
}

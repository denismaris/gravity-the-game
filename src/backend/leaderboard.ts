import { backend, ensureSession } from './client';

export type BoardKind = 'daily' | 'xp';
export type BoardScope = 'world' | 'country' | 'city';

export interface BoardRow {
  readonly place: number;
  readonly name: string;
  readonly country: string | null;
  readonly city: string | null;
  /** Milliseconds on the Daily board; experience on the all-time board. */
  readonly score: number;
  readonly isMe: boolean;
}

/** One board, top first, with the player's own row included even when
 * they are further down. Null when it cannot be reached. */
export async function fetchBoard(kind: BoardKind, scope: BoardScope, dayKey: string): Promise<BoardRow[] | null> {
  const api = backend();
  if (!api) return null;
  try {
    const userId = await ensureSession();
    if (!userId) return null;
    const { data, error } =
      kind === 'daily' ? await api.rpc('daily_board', { p_day: dayKey, p_scope: scope, p_limit: 50 }) : await api.rpc('xp_board', { p_scope: scope, p_limit: 50 });
    if (error || !Array.isArray(data)) return null;
    return data.map((row: { place: number; display_name: string; country: string | null; city: string | null; ms?: number; xp?: number; is_me: boolean }) => ({
      place: Number(row.place),
      name: row.display_name,
      country: row.country,
      city: row.city,
      score: Number(kind === 'daily' ? row.ms : row.xp),
      isMe: row.is_me,
    }));
  } catch {
    return null;
  }
}

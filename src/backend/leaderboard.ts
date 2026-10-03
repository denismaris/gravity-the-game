import AsyncStorage from '@react-native-async-storage/async-storage';
import { backend, ensureSession } from './client';

export type BoardKind = 'daily' | 'xp';
export type BoardScope = 'world' | 'country' | 'city';

export interface BoardRow {
  readonly place: number;
  /** Who the row belongs to - for Report and Hide. */
  readonly player: string;
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
    return data.map((row: { place: number; player: string; display_name: string; country: string | null; city: string | null; ms?: number; xp?: number; is_me: boolean }) => ({
      place: Number(row.place),
      player: row.player,
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

/** Reports a player's name as offensive. Three different players
 * reporting one name hides it from every board (see the moderation
 * migration). Whether it reached the server. */
export async function reportPlayer(player: string): Promise<boolean> {
  const api = backend();
  if (!api) return false;
  try {
    if (!(await ensureSession())) return false;
    const { error } = await api.rpc('report_player', { p_target: player });
    return !error;
  } catch {
    return false;
  }
}

const HIDDEN_KEY = 'tessera.board.hidden';

/** The players this phone has hidden: their rows still hold their place,
 * but show no name and no city. Kept on the phone only. */
export async function hiddenPlayers(): Promise<ReadonlySet<string>> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Hides or shows a player again; returns the new set. */
export async function setPlayerHidden(player: string, hidden: boolean): Promise<ReadonlySet<string>> {
  const next = new Set(await hiddenPlayers());
  if (hidden) next.add(player);
  else next.delete(player);
  await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(next)));
  return next;
}

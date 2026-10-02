import { backend, ensureSession } from './client';

export interface DailyStanding {
  /** Everyone who has posted a time on this Daily, this player included. */
  readonly players: number;
  /** The share of the others this time beat, 0 to 1. */
  readonly fasterThan: number;
}

/**
 * Posts a first solve of the Daily (once a day: a second post is refused
 * by the database, which is fine) and returns where it stands among
 * everyone's. Null offline or when the backend cannot be reached.
 */
export async function reportDaily(input: { dayKey: string; game: string; ms: number; stars: number }): Promise<DailyStanding | null> {
  const api = backend();
  if (!api) return null;
  try {
    const userId = await ensureSession();
    if (!userId) return null;
    const { error } = await api
      .from('daily_results')
      .insert({ user_id: userId, day_key: input.dayKey, game: input.game, ms: Math.round(input.ms), stars: Math.max(1, Math.min(3, input.stars)) });
    // 23505: already posted today - the standing is still worth showing.
    if (error && error.code !== '23505') return null;
    const { data } = await api.rpc('daily_standing', { p_day: input.dayKey, p_ms: Math.round(input.ms) });
    const row = Array.isArray(data) ? data[0] : null;
    return row ? { players: Number(row.players), fasterThan: Number(row.faster_than) } : null;
  } catch {
    return null;
  }
}

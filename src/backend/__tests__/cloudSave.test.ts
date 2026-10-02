import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyProgress, PlayerProgress } from '../../progression/playerProgress';

/**
 * A stand-in for the hosted database: one save row with a revision, and a
 * `put_save` that follows the same rule as the real one (see
 * supabase/migrations) - write only if the caller names the current
 * revision, otherwise hand back the server's copy.
 */
const server: { row: { progress: unknown; revision: number } | null; offline: boolean; writes: number } = { row: null, offline: false, writes: 0 };

const mockApi = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => (server.offline ? { data: null, error: { message: 'offline' } } : { data: server.row, error: null }),
      }),
    }),
  }),
  rpc: async (_name: string, args: { p_progress: unknown; p_base_revision: number }) => {
    if (server.offline) return { data: null, error: { message: 'offline' } };
    const current = server.row;
    if (current && current.revision !== args.p_base_revision) {
      return { data: [{ ok: false, revision: current.revision, progress: current.progress }], error: null };
    }
    server.writes += 1;
    server.row = { progress: JSON.parse(JSON.stringify(args.p_progress)), revision: (current?.revision ?? 0) + 1 };
    return { data: [{ ok: true, revision: server.row.revision, progress: server.row.progress }], error: null };
  },
};

jest.mock('../client', () => ({
  backend: () => mockApi,
  ensureSession: async () => 'player-1',
}));

import { syncProgress } from '../cloudSave';

const solved = (stars: 1 | 2 | 3) => ({ completed: true as const, stars, bestMoves: 10 });

/** A device: its own save, and its own idea of the cloud revision. */
function device(initial: PlayerProgress) {
  let progress = initial;
  let stored: string | null = null;
  return {
    get progress() {
      return progress;
    },
    set progress(next: PlayerProgress) {
      progress = next;
    },
    async sync() {
      // Each device has its own storage: swap its revision in and out.
      if (stored === null) await AsyncStorage.removeItem('tessera.cloud.revision');
      else await AsyncStorage.setItem('tessera.cloud.revision', stored);
      await syncProgress({ getLocal: () => progress, adopt: next => (progress = next) });
      stored = await AsyncStorage.getItem('tessera.cloud.revision');
    },
  };
}

beforeEach(async () => {
  server.row = null;
  server.offline = false;
  server.writes = 0;
  await AsyncStorage.clear();
});

describe('cloud save', () => {
  it('says whether the cloud now holds the save - signing out waits on it', async () => {
    const progress = { ...emptyProgress(), coins: 420 };
    expect(await syncProgress({ getLocal: () => progress, adopt: () => {} })).toBe(true);
    server.offline = true;
    expect(await syncProgress({ getLocal: () => progress, adopt: () => {} })).toBe(false);
  });

  it('a new phone takes the save from the cloud', async () => {
    const old = device({ ...emptyProgress(), levels: { a: solved(3) }, coins: 700, patron: true });
    await old.sync();
    const fresh = device(emptyProgress());
    await fresh.sync();
    expect(fresh.progress.levels.a.stars).toBe(3);
    expect(fresh.progress.coins).toBe(700);
    expect(fresh.progress.patron).toBe(true);
  });

  it('two devices that both played end up with both games in each', async () => {
    const phone = device(emptyProgress());
    const tablet = device(emptyProgress());
    await phone.sync();
    await tablet.sync();

    phone.progress = { ...phone.progress, levels: { ...phone.progress.levels, p: solved(2) } };
    tablet.progress = { ...tablet.progress, levels: { ...tablet.progress.levels, t: solved(3) } };
    await phone.sync();
    // The tablet's write is refused (stale revision), so it merges and retries.
    await tablet.sync();
    await phone.sync();

    for (const d of [phone, tablet]) {
      expect(Object.keys(d.progress.levels).sort()).toEqual(['p', 't']);
    }
    expect(Object.keys((server.row!.progress as PlayerProgress).levels).sort()).toEqual(['p', 't']);
  });

  it('offline, nothing changes and nothing breaks', async () => {
    server.offline = true;
    const phone = device({ ...emptyProgress(), coins: 123 });
    await expect(phone.sync()).resolves.toBeUndefined();
    expect(phone.progress.coins).toBe(123);
    expect(server.writes).toBe(0);
  });
});

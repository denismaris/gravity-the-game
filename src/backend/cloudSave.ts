import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { PlayerProgress } from '../progression/playerProgress';
import { parseProgress } from '../progression/playerProgressStore';
import { backend, ensureSession } from './client';
import { isFresh, mergeProgress } from './merge';

/** The save revision this device last agreed with the cloud on. */
const REVISION_KEY = 'tessera.cloud.revision';

export interface SyncHooks {
  /** This device's progress, as it is right now. */
  getLocal(): PlayerProgress;
  /** Replace this device's progress (with a merged copy). */
  adopt(progress: PlayerProgress): void;
}

let running: Promise<boolean> | null = null;

/**
 * Brings this device and the cloud into agreement. One run at a time;
 * a call while one is running waits for it instead of starting another.
 *
 * - A device's first sync reads the cloud copy and merges it in (or simply
 *   takes it, on a fresh install) before writing.
 * - Every write names the revision it is based on. If another device has
 *   written since, the server says so and hands back its copy; this
 *   device merges the two and writes again.
 *
 * Never throws: offline, signed out or unreachable, it just does nothing
 * and the next sync tries again. Resolves to whether the cloud now holds
 * this device's progress.
 */
export function syncProgress(hooks: SyncHooks): Promise<boolean> {
  if (!running) {
    running = run(hooks)
      .catch(() => false)
      .finally(() => {
        running = null;
      });
  }
  return running;
}

async function run({ getLocal, adopt }: SyncHooks): Promise<boolean> {
  const api = backend();
  if (!api) return false;
  const userId = await ensureSession();
  if (!userId) return false;

  let base = Number(await AsyncStorage.getItem(REVISION_KEY)) || 0;
  let progress = getLocal();

  if (base === 0) {
    const { data, error } = await api.from('saves').select('progress, revision').eq('user_id', userId).maybeSingle();
    if (error) return false;
    if (data) {
      const remote = parseProgress(JSON.stringify(data.progress));
      progress = isFresh(progress) ? remote : mergeProgress(progress, remote);
      adopt(progress);
      base = data.revision;
    }
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await api.rpc('put_save', { p_progress: progress, p_settings: null, p_base_revision: base, p_device: Platform.OS });
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return false;
    if (row.ok) {
      await AsyncStorage.setItem(REVISION_KEY, String(row.revision));
      return true;
    }
    // Another device wrote first: take both, and try once more.
    progress = mergeProgress(getLocal(), parseProgress(JSON.stringify(row.progress)));
    adopt(progress);
    base = row.revision;
  }
  return false;
}

/** Forgets the agreed revision - after the save is wiped on this device,
 * so the next sync reads the cloud again instead of overwriting it. */
export async function forgetCloudRevision(): Promise<void> {
  await AsyncStorage.removeItem(REVISION_KEY);
}

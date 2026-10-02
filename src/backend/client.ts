import type { SupabaseClient } from '@supabase/supabase-js';
import { BACKEND_CONFIG, backendConfigured } from './config';

let client: SupabaseClient | null = null;

/**
 * The Supabase client, made on first use - and only when the backend is
 * configured, so an offline build never loads it at all.
 */
export function backend(): SupabaseClient | null {
  if (!backendConfigured()) return null;
  if (!client) {
    require('react-native-url-polyfill/auto');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
    client = createClient(BACKEND_CONFIG.url, BACKEND_CONFIG.anonKey, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

/**
 * The player's account id, signing in anonymously the first time: every
 * player gets an account without being asked for anything. Apple or
 * Google sign-in can later be linked to this same account, keeping its
 * save. Null when offline or the backend cannot be reached.
 */
export async function ensureSession(): Promise<string | null> {
  const api = backend();
  if (!api) return null;
  try {
    const { data } = await api.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: signedIn, error } = await api.auth.signInAnonymously();
    if (error) return null;
    return signedIn.user?.id ?? null;
  } catch {
    return null;
  }
}

import { NativeModules, Platform } from 'react-native';
import { backend, ensureSession } from './client';

export interface Profile {
  readonly displayName: string | null;
  readonly country: string | null;
  readonly city: string | null;
}

/** The country the phone is set to (its region, not its location - no
 * permission is needed), as an ISO code, or null if it cannot tell. */
export function deviceCountry(): string | null {
  const pick = (id: unknown): string | null => {
    const match = typeof id === 'string' ? /[-_]([A-Z]{2})(?![A-Za-z])/.exec(id) : null;
    return match ? match[1] : null;
  };
  try {
    const native =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ?? NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    return pick(native) ?? pick(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return null;
  }
}

/** The player's own profile, or null offline. A player without one yet
 * reads as the phone's country and no name or city. */
export async function getProfile(): Promise<Profile | null> {
  const api = backend();
  if (!api) return null;
  const userId = await ensureSession();
  if (!userId) return null;
  const { data, error } = await api.from('profiles').select('display_name, country, city').eq('id', userId).maybeSingle();
  if (error) return null;
  return data ? { displayName: data.display_name, country: data.country, city: data.city } : { displayName: null, country: deviceCountry(), city: null };
}

/** Saves the name and place the player shows on leaderboards. */
export async function saveProfile(profile: Profile): Promise<boolean> {
  const api = backend();
  if (!api) return false;
  const userId = await ensureSession();
  if (!userId) return false;
  const clean = (value: string | null) => (value && value.trim().length > 0 ? value.trim() : null);
  const { error } = await api.from('profiles').upsert({
    id: userId,
    display_name: clean(profile.displayName),
    country: profile.country,
    city: clean(profile.city),
    updated_at: new Date().toISOString(),
  });
  return !error;
}

/**
 * Publishes the player's experience for the all-time board. The first
 * time, this also makes their profile, in the phone's country.
 */
export async function publishXp(xp: number): Promise<void> {
  const api = backend();
  if (!api) return;
  try {
    const userId = await ensureSession();
    if (!userId) return;
    const { data } = await api.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (data) await api.from('profiles').update({ xp: Math.max(0, Math.round(xp)) }).eq('id', userId);
    else await api.from('profiles').insert({ id: userId, xp: Math.max(0, Math.round(xp)), country: deviceCountry() });
  } catch {
    // The next sync tries again.
  }
}

/** Cities other players in a country already use - for the city field. */
export async function citySuggestions(country: string): Promise<string[]> {
  const api = backend();
  if (!api) return [];
  const userId = await ensureSession();
  if (!userId) return [];
  const { data } = await api.rpc('cities_in', { p_country: country });
  return Array.isArray(data) ? data.map((row: { city: string }) => row.city.trim()) : [];
}

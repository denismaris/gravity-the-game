import { Platform } from 'react-native';
import { forgetCloudRevision } from './cloudSave';
import { backend, ensureSession } from './client';
import { APPLE_SIGN_IN_ENABLED, GOOGLE_SIGN_IN, backendConfigured } from './config';
import { getProfile, saveProfile } from './profile';

export type Provider = 'apple' | 'google';

export interface Account {
  /** Signed in with Apple or Google, or the silent account every player
   * starts with. */
  readonly kind: 'anonymous' | Provider;
  readonly email: string | null;
  readonly name: string | null;
}

export type SignInResult = { ok: true; switched: boolean } | { ok: false; cancelled: boolean; message: string };

/** Which sign-in buttons this build can offer. */
export function availableProviders(): Provider[] {
  if (!backendConfigured()) return [];
  const out: Provider[] = [];
  if (Platform.OS === 'ios' && APPLE_SIGN_IN_ENABLED) out.push('apple');
  if (GOOGLE_SIGN_IN.webClientId && (Platform.OS !== 'ios' || GOOGLE_SIGN_IN.iosClientId)) out.push('google');
  return out;
}

/** The account on this phone, or null offline. */
export async function currentAccount(): Promise<Account | null> {
  const api = backend();
  if (!api) return null;
  if (!(await ensureSession())) return null;
  const { data } = await api.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const linked = (user.identities ?? []).map(i => i.provider).find((p): p is Provider => p === 'apple' || p === 'google');
  const meta = user.user_metadata ?? {};
  return {
    kind: user.is_anonymous || !linked ? 'anonymous' : linked,
    email: user.email ?? null,
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
  };
}

/**
 * The name to show on leaderboards, from the account's own: the first
 * name and the last name's initial ("Maris D."), never the whole name -
 * the boards are public. Null when the account has no name.
 */
export function boardNameFrom(fullName: string | null | undefined): string | null {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const first = parts[0];
  const initial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : '';
  const name = `${first}${initial}`.slice(0, 24);
  return name.length >= 2 ? name : null;
}

/** The leaderboard name a signed-in player could take from their account
 * ("Maris D."), for the account screen to *offer* - never set on its own:
 * the boards are public, so a real name only goes on them when the player
 * says so. Null when there is nothing to offer: no account name, or the
 * player already has a name of their own. */
export async function accountNameSuggestion(): Promise<string | null> {
  const account = await currentAccount();
  if (!account || account.kind === 'anonymous') return null;
  const name = boardNameFrom(account.name);
  if (!name) return null;
  const profile = await getProfile();
  if (!profile || profile.displayName) return null;
  return name;
}

/** Puts the offered account name on the leaderboards - the player said yes. */
export async function applyAccountName(name: string): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  return saveProfile({ ...profile, displayName: name });
}

/** Asks Apple or Google who the player is: an ID token, and the nonce it
 * was made with (Apple). Null when the player closes the sheet. */
async function identityToken(provider: Provider): Promise<{ token: string; nonce?: string } | null> {
  if (provider === 'google') {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: GOOGLE_SIGN_IN.webClientId, iosClientId: GOOGLE_SIGN_IN.iosClientId || undefined });
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success' || !response.data.idToken) return null;
    return { token: response.data.idToken };
  }
  const { appleAuth } = require('@invertase/react-native-apple-authentication') as typeof import('@invertase/react-native-apple-authentication');
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });
  if (!response.identityToken) return null;
  // The library sends Apple the nonce's SHA-256 and hands back the original,
  // which is what Supabase checks the token against.
  return { token: response.identityToken, nonce: response.nonce };
}

function cancelled(error: unknown): boolean {
  const code = (error as { code?: string | number } | null)?.code;
  return code === 'SIGN_IN_CANCELLED' || code === '-5' || code === '1001' || code === 1001 || String(code).includes('cancel');
}

/**
 * Signs in with Apple or Google.
 *
 * The player already has an account - the silent one made on first
 * launch, holding their save and their leaderboard times - so the new
 * sign-in is *linked* to it, and nothing changes but that it can now be
 * found again. If that Apple or Google account already belongs to a
 * Tessera account (they played on another phone first), this phone
 * switches to that one instead, and the next sync merges the two saves.
 */
export async function signIn(provider: Provider): Promise<SignInResult> {
  const api = backend();
  if (!api) return { ok: false, cancelled: false, message: 'Not connected.' };
  try {
    const identity = await identityToken(provider);
    if (!identity) return { ok: false, cancelled: true, message: '' };
    const credentials = { provider, token: identity.token, nonce: identity.nonce };
    const { data } = await api.auth.getSession();
    if (data.session?.user.is_anonymous) {
      const linked = await api.auth.linkIdentity(credentials);
      if (!linked.error) return { ok: true, switched: false };
    }
    const { error } = await api.auth.signInWithIdToken(credentials);
    if (error) {
      console.warn(`[sign-in] ${provider}: ${error.message}`);
      return { ok: false, cancelled: false, message: error.message };
    }
    // Another account: forget this phone's agreed revision, so the next
    // sync reads that account's save and merges this phone's into it.
    await forgetCloudRevision();
    return { ok: true, switched: true };
  } catch (error) {
    if (cancelled(error)) return { ok: false, cancelled: true, message: '' };
    const code = (error as { code?: unknown } | null)?.code;
    const text = `${error instanceof Error ? error.message : String(error)}${code !== undefined ? ` (code ${String(code)})` : ''}`;
    console.warn(`[sign-in] ${provider}: ${text}`);
    return { ok: false, cancelled: false, message: text };
  }
}

/** Signs this phone out. The caller wipes the local save afterwards (see
 * AccountScreen); play then carries on, saved to a fresh silent account
 * from the next sync. */
export async function signOut(): Promise<void> {
  const api = backend();
  if (!api) return;
  try {
    await api.auth.signOut();
  } catch {
    // Signed out locally either way.
  }
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google, or not available.
  }
  await forgetCloudRevision();
}

/** Deletes the account and everything stored with it, for good. */
export async function deleteAccount(): Promise<boolean> {
  const api = backend();
  if (!api) return false;
  const { error } = await api.rpc('delete_my_account');
  if (error) return false;
  await signOut();
  return true;
}

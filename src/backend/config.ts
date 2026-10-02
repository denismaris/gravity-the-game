/**
 * Where the backend lives. Both values come from the Supabase project's
 * Settings -> API page. The anon key is meant to ship inside the app: it
 * can only do what the database's row-level security allows (see
 * `supabase/migrations`).
 *
 * Left empty, the backend is off and the app works exactly as it does
 * offline - nothing is sent anywhere.
 */
export const BACKEND_CONFIG = {
  url: 'https://repqzzncuvtszvioznda.supabase.co',
  anonKey: 'sb_publishable_gVw5JtIMrws1P02K902O0Q_tl3MVTWF',
};

export function backendConfigured(): boolean {
  return BACKEND_CONFIG.url.length > 0 && BACKEND_CONFIG.anonKey.length > 0;
}

/**
 * Sign-in with Google: the two OAuth client ids from Google Cloud Console
 * (APIs & Services -> Credentials). The web id is the one Supabase checks
 * tokens against; the iOS id is the app's own. Empty: the Google button
 * does not show. On iOS the iOS id's "reversed" form must also be a URL
 * scheme in Info.plist.
 */
export const GOOGLE_SIGN_IN = {
  webClientId: '361676279398-t7a74bkcu2nqqp89aa0fvm154jv8sjpl.apps.googleusercontent.com',
  iosClientId: '361676279398-fmanmbj5nnslebqlq7ggrots038ggg8m.apps.googleusercontent.com',
};

/** Sign in with Apple needs the paid Apple Developer account and the
 * "Sign in with Apple" capability on the app; turn this on with it. */
export const APPLE_SIGN_IN_ENABLED = false;

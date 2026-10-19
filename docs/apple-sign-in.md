# Turning on Sign in with Apple

The code is ready. It stays off until the paid Apple Developer account exists, because Apple only lets paid teams use this permission. While it's off, the iPhone shows the Apple button next to Google's for the design, and tapping it says "Sign in with Apple is coming soon". Google sign-in works as normal.

**Before an App Store build, this must be switched on.** App Review rejects a button that does nothing (and an app that offers Google sign-in without a working Apple option, guideline 4.8).

## On the day you have the account

1. **Xcode:** open `ios/GravityInit.xcworkspace`, select the **GravityInit** target, then **Signing & Capabilities**.
   - Set **Team** to your paid team.
   - Click **+ Capability** and add **Sign in with Apple**. Xcode picks up the ready-made `GravityInit/GravityInit.entitlements` file.
   - Leave the **TesseraWidget** target alone. It doesn't need this.
2. **Supabase:** open Authentication, then Sign In / Providers, then **Apple**.
   - Turn it on.
   - Under **Client IDs**, add `com.marisdenis.tessera`.
   - Leave the secret key empty. It's only for signing in on a website, and the app signs in natively.
3. **The app:** in `src/backend/config.ts`, set `APPLE_SIGN_IN_ENABLED = true`. The Apple button then signs in for real.
4. **Test on a real iPhone.** The simulator can't complete an Apple sign-in reliably.
   - Open the account screen and tap **Sign in with Apple**. The player's progress should stay exactly as it was.
   - Delete the app, reinstall it, and sign in again. The same account and progress should come back.
   - On the first sign-in, Apple shares the player's name once. The account screen should then offer "Maris D." for the leaderboards.
   - To repeat the first-time test: on the iPhone, go to Settings, tap your name, then Sign in with Apple, find Tessellatum and choose **Stop using Apple ID**.

## If something fails

- **Error 1000 when tapping the button:** the capability isn't on the target, or the team isn't the paid one (step 1).
- **"Unacceptable audience" from Supabase:** the bundle id is missing from Supabase's Client IDs (step 2).
- **Sign-in works but no name is offered:** Apple only sends the name the very first time. Reset as described in the last part of step 4 and try again.

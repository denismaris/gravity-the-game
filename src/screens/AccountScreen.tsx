import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { PressableScale } from '../components';
import { PageBloom } from '../components/PageBloom';
import { TesseraMark } from '../components/TesseraMark';
import { Account, Provider, adoptAccountName, availableProviders, backendConfigured, currentAccount, deleteAccount, signIn, signOut, syncProgress } from '../backend';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { usePlayerProgress } from '../progression';
import { useAppearance } from '../settings';
import { theme, themedStyles } from '../theme';

export interface AccountScreenProps {
  onExit: () => void;
}

/** Google's "G", from its own brand artwork (an 18-unit square). */
function GoogleG({ size }: { size: number }): React.JSX.Element {
  const k = size / 18;
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: k }]}>
        <Path path="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" color="#4285F4" />
        <Path path="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" color="#34A853" />
        <Path path="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" color="#FBBC05" />
        <Path path="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" color="#EA4335" />
      </Group>
    </Canvas>
  );
}

/** Apple's own button - the one Apple asks apps to use - in the style that
 * suits the page: black on paper, white at night. */
function AppleSignInButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }): React.JSX.Element | null {
  const scheme = useAppearance();
  if (Platform.OS !== 'ios') return null;
  const { AppleButton } = require('@invertase/react-native-apple-authentication') as typeof import('@invertase/react-native-apple-authentication');
  return (
    <View style={[styles.appleWrap, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'auto'}>
      <AppleButton
        buttonStyle={scheme === 'dark' ? AppleButton.Style.WHITE : AppleButton.Style.BLACK}
        buttonType={AppleButton.Type.CONTINUE}
        cornerRadius={26}
        style={styles.appleButton}
        onPress={onPress}
      />
    </View>
  );
}

function GoogleSignInButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }): React.JSX.Element {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.98}
      style={({ pressed }) => [styles.google, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <GoogleG size={18} />
      <Text style={styles.googleText}>Continue with Google</Text>
    </PressableScale>
  );
}

const BENEFITS: ReadonlyArray<string> = [
  'Your progress, streak and purchases on any phone',
  'Your name on the leaderboards',
  'Nothing posted, and no emails',
];

/**
 * The player's account. Everyone has one from the first launch - a silent
 * one, holding their save and their leaderboard times. Signing in with
 * Apple or Google only makes it findable again, on a new phone or after a
 * reinstall. Signed in, this is where to sign out, or delete it all.
 */
export function AccountScreen({ onExit }: AccountScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { progress, resetProgress, adoptProgress } = usePlayerProgress();
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const online = backendConfigured();
  const providers = availableProviders();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(online);
  const [busy, setBusy] = useState<Provider | 'out' | 'delete' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // What Google, Apple or the server actually said, under the friendly
  // line - so a failed sign-in can be reported exactly.
  const [detail, setDetail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, reduced]);
  const rise = (from: number) => ({
    opacity: enter.interpolate({ inputRange: [from, Math.min(1, from + 0.5)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: enter.interpolate({ inputRange: [from, Math.min(1, from + 0.5)], outputRange: [12, 0], extrapolate: 'clamp' }) }],
  });

  const refresh = useCallback(async () => {
    if (!online) return;
    const found = await currentAccount();
    setAccount(found);
    setLoading(false);
    // Signed in before names were taken from accounts: take it now.
    if (found && found.kind !== 'anonymous') adoptAccountName();
  }, [online]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const start = async (provider: Provider) => {
    if (busy) return;
    triggerFeedback('tap');
    setBusy(provider);
    setMessage(null);
    setDetail(null);
    const result = await signIn(provider);
    setBusy(null);
    if (result.ok) {
      triggerFeedback('coin');
      setMessage(result.switched ? 'Welcome back. Your progress from your other phone is being brought over.' : 'Signed in. Your progress is saved to your account.');
      refresh();
    } else if (!result.cancelled) {
      setMessage('That did not work. Check your connection and try again.');
      setDetail(result.message || null);
    }
  };

  // Signing out leaves this phone as a new player's. The account keeps
  // everything, so the latest play is saved to it first; if that cannot
  // happen (offline), the player stays signed in rather than lose it.
  const leave = async () => {
    setBusy('out');
    setMessage(null);
    setDetail(null);
    const saved = await syncProgress({ getLocal: () => progressRef.current, adopt: adoptProgress });
    if (!saved) {
      setBusy(null);
      setMessage('Could not reach your account, and signing out now would lose your latest progress. Check your connection and try again.');
      return;
    }
    await signOut();
    resetProgress();
    setBusy(null);
    setMessage('Signed out. This phone starts fresh, and signing in again brings your progress back.');
    refresh();
  };

  const remove = async () => {
    setBusy('delete');
    const ok = await deleteAccount();
    setBusy(null);
    setConfirmDelete(false);
    if (ok) {
      resetProgress();
      setMessage('Your account and everything saved with it have been deleted.');
      refresh();
    } else setMessage('Could not delete your account. Check your connection and try again.');
  };

  const signedIn = account !== null && account.kind !== 'anonymous';
  const initial = (account?.name ?? account?.email ?? '?').trim().slice(0, 1).toUpperCase();

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to settings" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Settings</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Account</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        {loading ? (
          <ActivityIndicator style={styles.loading} color={theme.colors.textTertiary} />
        ) : signedIn ? (
          <Animated.View style={rise(0)}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <Text style={styles.identityName} numberOfLines={1}>
                {account!.name ?? account!.email ?? 'Signed in'}
              </Text>
              {account!.name && account!.email ? <Text style={styles.identityEmail}>{account!.email}</Text> : null}
              <View style={styles.providerChip}>
                {account!.kind === 'google' ? <GoogleG size={12} /> : <Text style={styles.appleGlyph}>{''}</Text>}
                <Text style={styles.providerText}>{account!.kind === 'google' ? 'Signed in with Google' : 'Signed in with Apple'}</Text>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelRow}>
                <View style={styles.dot} />
                <View style={styles.flex}>
                  <Text style={styles.panelTitle}>Saved to the cloud</Text>
                  <Text style={styles.panelText}>Your progress, streak and purchases follow you to any phone you sign in on.</Text>
                </View>
              </View>
            </View>

            <PressableScale accessibilityRole="button" accessibilityLabel="Sign out" onPress={leave} disabled={busy !== null} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>{busy === 'out' ? 'Signing out…' : 'Sign out'}</Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <View>
            <Animated.View style={[styles.hero, rise(0)]}>
              <View style={styles.mark}>
                <TesseraMark size={56} />
              </View>
              <Text style={styles.heroTitle}>Keep your almanac safe</Text>
              <Text style={styles.heroText}>Sign in and your progress is never lost, on this phone or the next one.</Text>
            </Animated.View>

            <Animated.View style={[styles.benefits, rise(0.12)]}>
              {BENEFITS.map(line => (
                <View key={line} style={styles.benefit}>
                  <View style={styles.benefitMark}>
                    <Text style={styles.benefitTick}>{'✓︎'}</Text>
                  </View>
                  <Text style={styles.benefitText}>{line}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View style={[styles.buttons, rise(0.22)]}>
              {providers.includes('apple') && <AppleSignInButton onPress={() => start('apple')} disabled={busy !== null} />}
              {providers.includes('google') && <GoogleSignInButton onPress={() => start('google')} disabled={busy !== null} />}
              {busy === 'apple' || busy === 'google' ? <ActivityIndicator style={styles.spinner} color={theme.colors.textTertiary} /> : null}
              {providers.length === 0 && (
                <View style={styles.soon}>
                  <Text style={styles.soonTitle}>Sign-in is coming soon</Text>
                  <Text style={styles.panelText}>Until then your progress is saved on this phone and backed up to the cloud.</Text>
                </View>
              )}
            </Animated.View>

            <Text style={styles.fine}>Until you sign in, your progress is backed up without a name. Signing in keeps everything you have now.</Text>
          </View>
        )}

        {message && (
          <View style={styles.message}>
            <Text style={styles.messageText}>{message}</Text>
            {detail ? (
              <Text style={styles.detailText} selectable>
                {detail}
              </Text>
            ) : null}
          </View>
        )}

        {/* Deleting: for anyone with anything stored, signed in or not. */}
        {online && !loading && (
          <View style={styles.dangerZone}>
            {confirmDelete ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>Delete your account?</Text>
                <Text style={styles.panelText}>Your account, your saved progress and your leaderboard times are removed for good, and this phone starts over. Purchases are not refunded.</Text>
                <View style={styles.confirmActions}>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Keep my account" onPress={() => setConfirmDelete(false)} containerStyle={styles.flex} style={({ pressed }) => [styles.secondary, styles.confirmButton, pressed && styles.pressed]}>
                    <Text style={styles.secondaryText}>Keep it</Text>
                  </PressableScale>
                  <PressableScale accessibilityRole="button" accessibilityLabel="Delete my account for good" onPress={remove} disabled={busy !== null} containerStyle={styles.flex} style={({ pressed }) => [styles.danger, styles.confirmButton, pressed && styles.pressed]}>
                    <Text style={styles.dangerText}>{busy === 'delete' ? 'Deleting…' : 'Delete for good'}</Text>
                  </PressableScale>
                </View>
              </View>
            ) : (
              <PressableScale accessibilityRole="button" accessibilityLabel="Delete my account and data" onPress={() => setConfirmDelete(true)} hitSlop={8} containerStyle={styles.deleteLink}>
                <Text style={styles.deleteText}>Delete my account and data</Text>
              </PressableScale>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 92 },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
  flex: { flex: 1 },
  loading: { marginTop: theme.spacing.xxl },
  hero: { alignItems: 'center', paddingTop: theme.spacing.md },
  mark: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHi,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  heroTitle: {
    marginTop: theme.spacing.lg,
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  heroText: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  benefits: { marginTop: theme.spacing.xl, gap: 12, alignSelf: 'stretch', paddingHorizontal: theme.spacing.lg },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  benefitTick: { fontSize: 11, fontWeight: theme.typography.weights.bold, color: theme.colors.success },
  benefitText: { flexShrink: 1, fontSize: theme.typography.sizes.body, color: theme.colors.textPrimary },
  buttons: { marginTop: theme.spacing.xl, gap: 12 },
  appleWrap: { height: 52 },
  appleButton: { width: '100%', height: 52 },
  google: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  googleText: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  spinner: { marginTop: 4 },
  soon: { padding: theme.spacing.md, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.borderStrong, alignItems: 'center' },
  soonTitle: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  fine: { marginTop: theme.spacing.lg, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textTertiary, textAlign: 'center', paddingHorizontal: theme.spacing.md },
  identity: { alignItems: 'center', paddingTop: theme.spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  avatarText: { fontFamily: theme.typography.families.display, fontSize: 34, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  identityName: { marginTop: theme.spacing.md, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  identityEmail: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  providerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.md, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
  appleGlyph: { fontSize: 13, color: theme.colors.textPrimary },
  providerText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  panel: { marginTop: theme.spacing.xl, padding: theme.spacing.md, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  panelRow: { flexDirection: 'row', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: theme.colors.success },
  panelTitle: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  panelText: { marginTop: 2, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary },
  secondary: { marginTop: theme.spacing.lg, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, borderWidth: 1, borderColor: theme.colors.borderStrong },
  secondaryText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  message: { marginTop: theme.spacing.lg, padding: theme.spacing.md, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt },
  detailText: { marginTop: 6, fontSize: theme.typography.sizes.micro + 1, lineHeight: 15, color: theme.colors.textTertiary, textAlign: 'center' },
  messageText: { fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textPrimary, textAlign: 'center' },
  dangerZone: { marginTop: theme.spacing.xxl, alignItems: 'center' },
  deleteLink: { padding: 4 },
  deleteText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.danger },
  confirm: { alignSelf: 'stretch', padding: theme.spacing.md, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.danger, backgroundColor: theme.colors.surface },
  confirmTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  confirmActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  confirmButton: { marginTop: 0 },
  danger: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: theme.colors.danger },
  dangerText: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
}));

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { version } from '../../package.json';
import { PressableScale } from '../components';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { requestReminderPermission } from '../notifications';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { TesseraMark } from '../components/TesseraMark';
import { Account, currentAccount } from '../backend';
import { AppearancePicker } from '../components/AppearancePicker';
import { copyrightLine } from '../legal/documents';
import { privacyChoicesRequired, showPrivacyChoices } from '../ads';
import { LegalDoc, LegalScreen } from './LegalScreen';

export interface SettingsScreenProps {
  onExit: () => void;
  /** The player's account: sign in, sign out, delete. */
  onOpenAccount: () => void;
}

/**
 * The app's one settings screen: independent sound/haptics/calming-break
 * toggles and a destructive, confirm-gated progress reset. Sound/haptics
 * are read imperatively by `game/rendering` from the flags
 * `SettingsProvider` keeps in sync (see its own doc comment); the calming-
 * break toggle is read directly by `App.tsx` at the moment a level batch
 * completes (see `src/interstitial/`). `resetProgress` lives on
 * `PlayerProgressProvider` since progress is what's being reset, not a
 * settings concern itself.
 */
export function SettingsScreen({ onExit, onOpenAccount }: SettingsScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { settings, setSoundEnabled, setMusicEnabled, setHapticsEnabled, setCalmingInterstitialEnabled, setReminders, setAppearance } = useSettings();
  const { resetProgress } = usePlayerProgress();
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    let live = true;
    currentAccount().then(a => live && setAccount(a));
    return () => {
      live = false;
    };
  }, []);
  // Set when the system refused permission, so the switch can say why it
  // stayed off rather than silently flicking back.
  const [blocked, setBlocked] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  // Where the law asks (the EU), a way back to Google's ad consent form.
  const [adChoices, setAdChoices] = useState(false);
  useEffect(() => {
    privacyChoicesRequired().then(setAdChoices);
  }, []);

  // The permission prompt is asked for here, in answer to the player
  // turning reminders on - never on launch.
  const toggleReminders = useCallback(
    async (on: boolean) => {
      if (!on) {
        setReminders(false);
        return;
      }
      const granted = await requestReminderPermission();
      setBlocked(!granted);
      if (granted) setReminders(true);
    },
    [setReminders],
  );

  const confirmReset = useCallback(() => {
    Alert.alert(
      'Reset all progress?',
      'This clears every star, completion and streak. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetProgress() },
      ],
    );
  }, [resetProgress]);

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Settings</Text>
        </View>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* The account first: the one setting that keeps everything else. */}
        <PressableScale accessibilityRole="button" accessibilityLabel={account && account.kind !== 'anonymous' ? 'Your account' : 'Sign in to keep your progress safe'} onPress={onOpenAccount} scaleTo={0.985} containerStyle={styles.accountWrap} style={styles.account}>
          <View style={styles.accountMark}>
            <TesseraMark size={30} />
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountTitle}>{account && account.kind !== 'anonymous' ? account.name ?? account.email ?? 'Signed in' : 'Keep your progress safe'}</Text>
            <Text style={styles.accountSub}>{account && account.kind !== 'anonymous' ? `Signed in with ${account.kind === 'google' ? 'Google' : 'Apple'}` : 'Sign in to save it to your account'}</Text>
          </View>
          <Text style={styles.accountChevron}>›</Text>
        </PressableScale>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.card}>
          <AppearancePicker value={settings.appearance} onChange={setAppearance} />
        </View>

        <Text style={styles.sectionLabel}>SOUND & HAPTICS</Text>
        <View style={styles.card}>
          <Row
            label="Sound Effects"
            value={settings.soundEnabled}
            onValueChange={setSoundEnabled}
            accessibilityLabel="Sound effects"
          />
          <View style={styles.divider} />
          <Row
            label="Music"
            value={settings.musicEnabled}
            onValueChange={setMusicEnabled}
            accessibilityLabel="Background music"
          />
          <View style={styles.divider} />
          <Row
            label="Haptics"
            value={settings.hapticsEnabled}
            onValueChange={setHapticsEnabled}
            accessibilityLabel="Haptic feedback"
          />
        </View>

        <Text style={styles.sectionLabel}>GAMEPLAY</Text>
        <View style={styles.card}>
          <Row
            label="Calming Break Between Levels"
            value={settings.calmingInterstitialEnabled}
            onValueChange={setCalmingInterstitialEnabled}
            accessibilityLabel="Show a calming swipe-maze break between levels"
          />
        </View>

        <Text style={styles.sectionLabel}>REMINDERS</Text>
        <View style={styles.card}>
          <Row
            label="Daily Puzzle Reminder"
            value={settings.remindersEnabled}
            onValueChange={toggleReminders}
            accessibilityLabel="Remind me about the Daily puzzle"
          />
          {settings.remindersEnabled && (
            <>
              <View style={styles.divider} />
              <View style={styles.hours}>
                {REMINDER_HOURS.map(([hour, label]) => {
                  const on = settings.reminderHour === hour;
                  return (
                    <PressableScale
                      key={hour}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Remind me at ${label}`}
                      onPress={() => setReminders(true, hour)}
                      containerStyle={styles.hourWrap}
                      style={[styles.hour, on && styles.hourOn]}
                    >
                      <Text style={[styles.hourText, on && styles.hourTextOn]}>{label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}
          <Text style={styles.note}>
            {blocked
              ? 'Notifications are switched off for Tessellatum. Turn them on in your phone’s Settings, then try again.'
              : 'One quiet note a day with the Daily’s name, never if you have already solved it.'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>PROGRESS</Text>
        <View style={styles.card}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Reset all progress"
            onPress={confirmReset}
            style={({ pressed }) => [styles.resetRow, pressed && styles.resetRowPressed]}
          >
            <Text style={styles.resetLabel}>Reset All Progress</Text>
          </PressableScale>
        </View>

        <Text style={styles.sectionLabel}>LEGAL</Text>
        <View style={styles.card}>
          {LEGAL_ROWS.map(([doc, label], i) => (
            <React.Fragment key={doc}>
              {i > 0 && <View style={styles.divider} />}
              <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={() => setLegal(doc)} feedback={false} scaleTo={1} style={({ pressed }) => [styles.row, pressed && styles.resetRowPressed]}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.chevron}>›</Text>
              </PressableScale>
            </React.Fragment>
          ))}
          {adChoices && (
            <>
              <View style={styles.divider} />
              <PressableScale accessibilityRole="button" accessibilityLabel="Ad privacy choices" onPress={showPrivacyChoices} feedback={false} scaleTo={1} style={({ pressed }) => [styles.row, pressed && styles.resetRowPressed]}>
                <Text style={styles.rowLabel}>Ad Privacy Choices</Text>
                <Text style={styles.chevron}>›</Text>
              </PressableScale>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>TESSELLATUM</Text>
          <Text style={styles.footerMeta}>Version {version}</Text>
          <Text style={styles.footerTagline}>An Almanac of Puzzles</Text>
          <Text style={styles.footerCopyright}>{copyrightLine()}</Text>
        </View>
      </ScrollView>
      {legal && <LegalScreen doc={legal} onClose={() => setLegal(null)} />}
    </View>
  );
}

const LEGAL_ROWS: ReadonlyArray<readonly [LegalDoc, string]> = [
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms of Use'],
  ['licenses', 'Open-Source Licences'],
];

/** The reminder times on offer: morning coffee, lunch, early evening,
 * last thing at night. */
const REMINDER_HOURS: ReadonlyArray<readonly [number, string]> = [
  [9, '9:00'],
  [13, '13:00'],
  [19, '19:00'],
  [21, '21:00'],
];

interface RowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
}

function Row({ label, value, onValueChange, accessibilityLabel }: RowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={accessibilityLabel}
        trackColor={{ false: theme.colors.border, true: theme.colors.secondary }}
        thumbColor={theme.colors.surfaceHi}
        ios_backgroundColor={theme.colors.border}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56 },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  sectionLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  accountWrap: { marginTop: theme.spacing.sm },
  account: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceHi, borderWidth: 1, borderColor: theme.colors.border },
  accountMark: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  accountText: { flex: 1 },
  accountTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  accountSub: { marginTop: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  accountChevron: { fontSize: 24, color: theme.colors.textTertiary },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowLabel: {
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  divider: {
    marginLeft: theme.spacing.lg,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  hours: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  hourWrap: { flex: 1 },
  hour: {
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceHi,
  },
  hourOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  hourText: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textPrimary,
  },
  hourTextOn: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.bold },
  note: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    fontSize: theme.typography.sizes.caption,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  resetRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  resetRowPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  resetLabel: {
    fontSize: theme.typography.sizes.body,
    color: theme.colors.danger,
    fontWeight: theme.typography.weights.semibold,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  footerTitle: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  footerMeta: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
  },
  chevron: { fontSize: 22, lineHeight: 24, color: theme.colors.textTertiary },
  footerCopyright: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.md,
  },
  footerTagline: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
  },
}));

import React, { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { version } from '../../package.json';
import { GeometricRule, PressableScale } from '../components';
import { usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme } from '../theme';

export interface SettingsScreenProps {
  onExit: () => void;
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
export function SettingsScreen({ onExit }: SettingsScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { settings, setSoundEnabled, setHapticsEnabled, setCalmingInterstitialEnabled } = useSettings();
  const { resetProgress } = usePlayerProgress();

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
        <Text style={styles.sectionLabel}>SOUND & HAPTICS</Text>
        <View style={styles.card}>
          <Row
            label="Sound Effects"
            value={settings.soundEnabled}
            onValueChange={setSoundEnabled}
            accessibilityLabel="Sound effects"
          />
          <GeometricRule variant="quiet" style={styles.divider} />
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

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>GRAVITY</Text>
          <Text style={styles.footerMeta}>Version {version}</Text>
          <Text style={styles.footerTagline}>An Almanac of Puzzles</Text>
        </View>
      </ScrollView>
    </View>
  );
}

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

const styles = StyleSheet.create({
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
  footerTagline: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.xs,
  },
});

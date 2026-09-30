import React from 'react';
import { Text, View } from 'react-native';
import { AppearancePreference } from '../settings';
import { paletteFor, Palette, theme, themedStyles } from '../theme';
import { PressableScale } from './PressableScale';

const OPTIONS: ReadonlyArray<{ value: AppearancePreference; label: string; note: string }> = [
  { value: 'system', label: 'System', note: 'Follows the phone' },
  { value: 'light', label: 'Light', note: 'By daylight' },
  { value: 'dark', label: 'Dark', note: 'By lamplight' },
];

/**
 * A page of the almanac in miniature, drawn in one palette: the ground, a
 * card with a coloured band, two lines of type and a star - enough to
 * show what the whole app will look like without describing it.
 */
function MiniPage({ palette }: { palette: Palette }): React.JSX.Element {
  return (
    <View style={[styles.page, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.band, { backgroundColor: palette.secondary }]} />
        <View style={[styles.line, styles.lineLong, { backgroundColor: palette.textPrimary }]} />
        <View style={[styles.line, styles.lineShort, styles.lineSoft, { backgroundColor: palette.textSecondary }]} />
        <View style={styles.cardFoot}>
          <View style={[styles.star, { backgroundColor: palette.accent }]} />
          <View style={[styles.pill, { backgroundColor: palette.primary }]} />
        </View>
      </View>
    </View>
  );
}

export interface AppearancePickerProps {
  value: AppearancePreference;
  onChange: (value: AppearancePreference) => void;
}

/** Light, dark or the phone's own setting - each shown as the page it
 * gives, not as a word. "System" is the two halves side by side. */
export function AppearancePicker({ value, onChange }: AppearancePickerProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {OPTIONS.map(option => {
        const on = option.value === value;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${option.label} appearance. ${option.note}.`}
            onPress={() => onChange(option.value)}
            scaleTo={0.96}
            containerStyle={styles.option}
            style={styles.press}
          >
            <View style={[styles.frame, on && styles.frameOn]}>
              {option.value === 'system' ? (
                <View style={styles.split}>
                  <View style={styles.half}>
                    <View style={styles.shift}>
                      <MiniPage palette={paletteFor('light')} />
                    </View>
                  </View>
                  <View style={[styles.half, styles.halfRight]}>
                    <View style={styles.shift}>
                      <MiniPage palette={paletteFor('dark')} />
                    </View>
                  </View>
                </View>
              ) : (
                <MiniPage palette={paletteFor(option.value)} />
              )}
              {on && (
                <View style={styles.tick}>
                  <Text style={styles.tickText}>{'✓︎'}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, on && styles.labelOn]}>{option.label}</Text>
            <Text style={styles.note}>{option.note}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const PAGE_HEIGHT = 96;

const styles = themedStyles(() => ({
  row: { flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.md },
  option: { flex: 1 },
  press: { width: '100%', alignItems: 'center' },
  frame: {
    width: '100%',
    height: PAGE_HEIGHT,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  frameOn: { borderColor: theme.colors.secondary, borderWidth: 2 },
  page: { flex: 1, padding: 9, justifyContent: 'center' },
  card: { borderRadius: 8, borderWidth: 1, padding: 7, overflow: 'hidden' },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  line: { height: 4, borderRadius: 2, marginTop: 5 },
  lineLong: { width: '72%' },
  lineShort: { width: '48%' },
  lineSoft: { opacity: 0.8 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  star: { width: 7, height: 7, borderRadius: 1.5, transform: [{ rotate: '45deg' }] },
  pill: { width: 20, height: 7, borderRadius: 4 },
  split: { flex: 1, flexDirection: 'row' },
  half: { flex: 1, overflow: 'hidden' },
  halfRight: { alignItems: 'flex-end' },
  // Each half is a full-width page cropped to its own side - the light
  // page's left, the dark page's right - so together they read as one
  // page, lit on one side and not the other.
  shift: { width: '200%', height: '100%' },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: { color: theme.colors.surfaceHi, fontSize: 10, fontWeight: theme.typography.weights.bold },
  label: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  labelOn: { color: theme.colors.textPrimary },
  note: {
    marginTop: 1,
    fontFamily: theme.typography.families.mono,
    fontSize: 9.5,
    letterSpacing: 0.4,
    color: theme.colors.textTertiary,
  },
}));

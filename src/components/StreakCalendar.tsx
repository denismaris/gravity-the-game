import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { theme, themedStyles } from '../theme';
import { ModalLayer } from './ModalLayer';
import { PressableScale } from './PressableScale';
import { DialogActions, dialogStyles } from './dialog';

/**
 * The Daily's calendar: the days it was solved, so a streak is something
 * to look at, not just a number. Day keys are the Daily's own (UTC
 * `YYYY-MM-DD`, see `dailyKeyOf`), so the calendar is laid out in UTC too.
 */

const DAY_MS = 86400000;
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function keyOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function msOf(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

/** Monday 0 ... Sunday 6. */
function weekdayOf(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

/** The last seven days, today last: a letter and a dot each, the dot full
 * on a day the Daily was solved. Tapping it opens the whole calendar. */
export function WeekStrip({ days, todayKey, onPress }: { days: ReadonlySet<string>; todayKey: string; onPress: () => void }): React.JSX.Element {
  const today = msOf(todayKey);
  const week = Array.from({ length: 7 }, (_v, i) => today - (6 - i) * DAY_MS);
  const solvedCount = week.filter(ms => days.has(keyOf(ms))).length;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`This week: the Daily solved on ${solvedCount} of 7 days. Open your calendar`} onPress={onPress} hitSlop={6} style={styles.strip}>
      {week.map(ms => {
        const key = keyOf(ms);
        const isToday = key === todayKey;
        return (
          <View key={key} style={styles.stripDay}>
            <Text style={[styles.stripLetter, isToday && styles.stripLetterToday]}>{WEEKDAY_LETTERS[weekdayOf(ms)]}</Text>
            <View style={[styles.stripDot, days.has(key) && styles.dotOn, isToday && !days.has(key) && styles.dotToday]} />
          </View>
        );
      })}
    </Pressable>
  );
}

/** The calendar itself: a month at a time, back as far as there is history. */
export function StreakCalendar({ days, todayKey, streak, best, onClose }: { days: ReadonlySet<string>; todayKey: string; streak: number; best: number; onClose: () => void }): React.JSX.Element {
  const today = new Date(msOf(todayKey));
  const [monthOffset, setMonthOffset] = useState(0);
  const earliest = useMemo(() => [...days].sort()[0] ?? todayKey, [days, todayKey]);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() - monthOffset;
  const first = Date.UTC(year, month, 1);
  const shown = new Date(first);
  const daysInMonth = new Date(Date.UTC(shown.getUTCFullYear(), shown.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = weekdayOf(first);
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_v, i) => first + i * DAY_MS)];
  while (cells.length % 7 !== 0) cells.push(null);
  const solvedThisMonth = cells.filter(ms => ms !== null && days.has(keyOf(ms))).length;
  const canGoBack = keyOf(first) > earliest;

  return (
    <ModalLayer zIndex={60}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.scrim}>
        <Pressable accessibilityLabel="Close the calendar" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={styles.card}>
          <Text style={dialogStyles.kicker}>Your Dailies</Text>
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{streak}</Text>
              <Text style={styles.figureLabel}>day streak</Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{best}</Text>
              <Text style={styles.figureLabel}>best streak</Text>
            </View>
            <View style={styles.rule} />
            <View style={styles.figure}>
              <Text style={styles.figureValue}>{days.size}</Text>
              <Text style={styles.figureLabel}>in all</Text>
            </View>
          </View>

          <View style={styles.monthHead}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoBack} onPress={() => setMonthOffset(m => m + 1)} hitSlop={10} style={[styles.arrow, !canGoBack && styles.arrowOff]}>
              <Text style={styles.arrowText}>‹</Text>
            </PressableScale>
            <Text style={styles.monthName}>{`${MONTHS[shown.getUTCMonth()]} ${shown.getUTCFullYear()}`}</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Next month" disabled={monthOffset === 0} onPress={() => setMonthOffset(m => Math.max(0, m - 1))} hitSlop={10} style={[styles.arrow, monthOffset === 0 && styles.arrowOff]}>
              <Text style={styles.arrowText}>›</Text>
            </PressableScale>
          </View>

          <View style={styles.grid}>
            {WEEKDAY_LETTERS.map((letter, i) => (
              <Text key={`h${i}`} style={styles.gridLetter}>
                {letter}
              </Text>
            ))}
            {cells.map((ms, i) => {
              if (ms === null) return <View key={`e${i}`} style={styles.cell} />;
              const key = keyOf(ms);
              const solved = days.has(key);
              const isToday = key === todayKey;
              const future = key > todayKey;
              return (
                <View key={key} style={styles.cell} accessible accessibilityLabel={`${new Date(ms).getUTCDate()} ${MONTHS[shown.getUTCMonth()]}${solved ? ', solved' : ''}`}>
                  <View style={[styles.day, solved && styles.daySolved, isToday && !solved && styles.dayToday]}>
                    <Text style={[styles.dayText, solved && styles.dayTextSolved, future && styles.dayTextFuture]}>{new Date(ms).getUTCDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.monthNote}>{solvedThisMonth === 0 ? 'No Dailies this month yet.' : `${solvedThisMonth} ${solvedThisMonth === 1 ? 'Daily' : 'Dailies'} this month.`}</Text>

          <DialogActions primary={{ label: 'Done', onPress: onClose, accessibilityLabel: 'Close' }} />
        </Animated.View>
      </View>
    </ModalLayer>
  );
}

const styles = themedStyles(() => ({
  strip: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingRight: theme.spacing.md },
  stripDay: { alignItems: 'center', gap: 4 },
  stripLetter: { fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  stripLetterToday: { color: theme.colors.textPrimary },
  stripDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.border },
  dotOn: { backgroundColor: theme.colors.secondary },
  dotToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.secondary },

  scrim: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '88%',
    maxWidth: 360,
    padding: theme.spacing.lg,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  kicker: { fontSize: theme.typography.sizes.caption + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary, textAlign: 'center' },
  figures: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderRadius: 16, backgroundColor: theme.colors.surfaceAlt },
  figure: { flex: 1, alignItems: 'center' },
  figureValue: { fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, fontVariant: ['tabular-nums'], color: theme.colors.textPrimary },
  figureLabel: { fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 6, backgroundColor: theme.colors.borderStrong },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.lg },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  arrowOff: { opacity: 0.3 },
  arrowText: { fontSize: 20, lineHeight: 22, color: theme.colors.textPrimary },
  monthName: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 2, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm },
  gridLetter: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 4, fontSize: theme.typography.sizes.micro + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.textTertiary },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: '80%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  daySolved: { backgroundColor: theme.colors.secondary },
  dayToday: { borderWidth: 1.5, borderColor: theme.colors.secondary },
  dayText: { fontSize: theme.typography.sizes.caption + 1, fontVariant: ['tabular-nums'], color: theme.colors.textSecondary },
  dayTextSolved: { color: theme.colors.surfaceHi, fontWeight: theme.typography.weights.bold },
  dayTextFuture: { color: theme.colors.textTertiary, opacity: 0.5 },
  monthNote: { marginTop: theme.spacing.xs, textAlign: 'center', fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  doneWrap: { alignSelf: 'stretch', marginTop: theme.spacing.lg },
  done: { height: 50, borderRadius: theme.radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  doneText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  pressed: { opacity: 0.85 },
}));

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../components';
import { PageBloom } from '../components/PageBloom';
import {
  BoardKind,
  BoardRow,
  BoardScope,
  COUNTRIES,
  Profile,
  backendConfigured,
  citySuggestions,
  countryName,
  fetchBoard,
  flagOf,
  getProfile,
  saveProfile,
} from '../backend';
import { dailyKeyOf } from '../game/journey';
import { triggerFeedback, useReducedMotion } from '../game/rendering';
import { formatDuration, usePlayerProgress } from '../progression';
import { theme, themedStyles } from '../theme';

export interface LeaderboardScreenProps {
  onExit: () => void;
  onPlayDaily: () => void;
}

const BOARDS: ReadonlyArray<{ id: BoardKind; label: string }> = [
  { id: 'daily', label: "Today's Daily" },
  { id: 'xp', label: 'All time' },
];

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; rows: BoardRow[] };

/** Gold, silver and bronze for the first three places. */
function medal(place: number): string | null {
  if (place === 1) return '#C99A2E';
  if (place === 2) return '#9AA3AD';
  if (place === 3) return '#B0714A';
  return null;
}

function Row({ row, kind, index }: { row: BoardRow; kind: BoardKind; index: number }): React.JSX.Element {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.timing(enter, { toValue: 1, duration: 260, delay: Math.min(index, 12) * 28, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, index, reduced]);
  const metal = medal(row.place);
  const where = [flagOf(row.country), row.city ?? countryName(row.country) ?? ''].filter(Boolean).join(' ');
  return (
    <Animated.View
      style={[styles.row, row.isMe && styles.rowMe, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
      accessible
      accessibilityLabel={`${row.isMe ? 'You, ' : ''}place ${row.place}, ${row.name}${where ? `, ${where}` : ''}, ${kind === 'daily' ? formatDuration(row.score) : `${row.score} experience`}`}
    >
      <View style={[styles.place, metal ? { backgroundColor: metal } : null]}>
        <Text style={[styles.placeText, metal ? styles.placeTextMedal : null]}>{row.place}</Text>
      </View>
      <View style={styles.who}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
          {row.isMe ? <Text style={styles.you}>{'  you'}</Text> : null}
        </Text>
        {where ? (
          <Text style={styles.where} numberOfLines={1}>
            {where}
          </Text>
        ) : null}
      </View>
      <Text style={styles.score}>{kind === 'daily' ? formatDuration(row.score) : `${row.score.toLocaleString('en-US')} XP`}</Text>
    </Animated.View>
  );
}

/** Name, country and city: what a player shows on the boards. */
function ProfileEditor({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile.displayName ?? '');
  const [country, setCountry] = useState<string | null>(profile.country);
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(!profile.country);
  const [city, setCity] = useState(profile.city ?? '');
  const [cities, setCities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setCities([]);
    if (country) citySuggestions(country).then(list => live && setCities(list));
    return () => {
      live = false;
    };
  }, [country]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return COUNTRIES.filter(([code, label]) => label.toLowerCase().includes(q) || code.toLowerCase() === q).slice(0, 6);
  }, [search]);
  const nameOk = name.trim().length === 0 || (name.trim().length >= 2 && name.trim().length <= 24);
  const cityOk = city.trim().length === 0 || (city.trim().length >= 2 && city.trim().length <= 40);

  const save = async () => {
    if (!nameOk || !cityOk || saving) return;
    setSaving(true);
    setFailed(false);
    const next = { displayName: name.trim() || null, country, city: country ? city.trim() || null : null };
    const ok = await saveProfile(next);
    setSaving(false);
    if (ok) {
      triggerFeedback('coin');
      onSaved(next);
    } else setFailed(true);
  };

  return (
    <View style={styles.sheetLayer}>
      <PressableScale accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} feedback={false} scaleTo={1} containerStyle={styles.scrim}>
        <View style={styles.scrimFill} />
      </PressableScale>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <ScrollView style={[styles.sheet, { paddingBottom: insets.bottom }]} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>How you appear</Text>
          <Text style={styles.sheetLede}>Your name and place on the leaderboards. Your city is up to you.</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Leave empty to stay anonymous" placeholderTextColor={theme.colors.textTertiary} maxLength={24} style={[styles.input, !nameOk && styles.inputBad]} autoCorrect={false} />

          <Text style={styles.label}>Country</Text>
          {country && !picking ? (
            <View style={styles.chosen}>
              <Text style={styles.chosenText}>{`${flagOf(country)}  ${countryName(country) ?? country}`}</Text>
              <PressableScale accessibilityRole="button" accessibilityLabel="Change country" onPress={() => setPicking(true)} hitSlop={8}>
                <Text style={styles.link}>Change</Text>
              </PressableScale>
            </View>
          ) : (
            <View>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search for your country" placeholderTextColor={theme.colors.textTertiary} style={styles.input} autoFocus={country !== null} autoCorrect={false} />
              {matches.map(([code, label]) => (
                <PressableScale
                  key={code}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => {
                    setCountry(code);
                    setCity('');
                    setSearch('');
                    setPicking(false);
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <Text style={styles.optionText}>{`${flagOf(code)}  ${label}`}</Text>
                </PressableScale>
              ))}
            </View>
          )}

          {country && (
            <>
              <Text style={styles.label}>City</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="Optional" placeholderTextColor={theme.colors.textTertiary} maxLength={40} style={[styles.input, !cityOk && styles.inputBad]} autoCorrect={false} />
              {cities.length > 0 && (
                <View style={styles.suggestions}>
                  {cities
                    .filter(c => c.toLowerCase() !== city.trim().toLowerCase())
                    .slice(0, 8)
                    .map(c => (
                      <PressableScale key={c} accessibilityRole="button" accessibilityLabel={c} onPress={() => setCity(c)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                        <Text style={styles.suggestionText}>{c}</Text>
                      </PressableScale>
                    ))}
                </View>
              )}
            </>
          )}

          {failed && <Text style={styles.failed}>That did not save. Check your connection and try again.</Text>}
          <View style={styles.sheetActions}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} containerStyle={styles.flex} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Save" onPress={save} containerStyle={styles.flex} style={({ pressed }) => [styles.primary, (!nameOk || !cityOk) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The leaderboards: today's Daily (fastest first) and all-time experience,
 * each for the world, the player's country and their city. The player's
 * own row is always shown, even far down the board.
 */
export function LeaderboardScreen({ onExit, onPlayDaily }: LeaderboardScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { dailyCompletedToday } = usePlayerProgress();
  const [kind, setKind] = useState<BoardKind>('daily');
  const [scope, setScope] = useState<BoardScope>('world');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const online = backendConfigured();
  const dayKey = dailyKeyOf(new Date());

  useEffect(() => {
    if (online) getProfile().then(setProfile);
  }, [online]);

  // A scope the player has not set a place for has nothing to show.
  const needsPlace = (scope === 'country' && !profile?.country) || (scope === 'city' && !profile?.city);

  useEffect(() => {
    if (!online || needsPlace) return;
    let live = true;
    setLoad({ state: 'loading' });
    fetchBoard(kind, scope, dayKey).then(rows => {
      if (live) setLoad(rows ? { state: 'ready', rows } : { state: 'error' });
    });
    return () => {
      live = false;
    };
  }, [online, kind, scope, dayKey, needsPlace, attempt, profile]);

  const pick = useCallback(<T,>(set: (v: T) => void, value: T) => {
    triggerFeedback('uiPage');
    set(value);
  }, []);

  const scopes: ReadonlyArray<{ id: BoardScope; label: string }> = [
    { id: 'world', label: 'World' },
    { id: 'country', label: profile?.country ? `${flagOf(profile.country)} ${countryName(profile.country) ?? profile.country}` : 'Country' },
    { id: 'city', label: profile?.city ?? 'Your city' },
  ];

  const rows = load.state === 'ready' ? load.rows : [];
  const me = rows.find(r => r.isMe);
  const top = rows.filter(r => !r.isMe || r.place <= 50);
  const meBelow = me && !top.includes(me) ? me : null;

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8} containerStyle={styles.headerSide}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Leaderboards</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xxl }]}>
        <View style={styles.boards}>
          {BOARDS.map(b => (
            <PressableScale
              key={b.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === b.id }}
              accessibilityLabel={b.label}
              onPress={() => pick(setKind, b.id)}
              feedback={false}
              containerStyle={styles.flex}
              style={[styles.board, kind === b.id && styles.boardOn]}
            >
              <Text style={[styles.boardText, kind === b.id && styles.boardTextOn]}>{b.label}</Text>
            </PressableScale>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopesScroll} contentContainerStyle={styles.scopes}>
          {scopes.map(s => (
            <PressableScale
              key={s.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === s.id }}
              accessibilityLabel={s.label}
              onPress={() => pick(setScope, s.id)}
              feedback={false}
              style={[styles.scope, scope === s.id && styles.scopeOn]}
            >
              <Text style={[styles.scopeText, scope === s.id && styles.scopeTextOn]} numberOfLines={1}>
                {s.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>

        <Text style={styles.explain}>
          {kind === 'daily'
            ? "Ranked by the time of each player's first solve of today's Daily, from opening it to the last move. Replays don't count."
            : 'Ranked by experience: every star, solved puzzle, errand and streak day adds to it.'}
        </Text>

        {online && profile && (
          <View style={styles.me}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(profile.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.who}>
              <Text style={styles.meName} numberOfLines={1}>
                {profile.displayName ?? 'Anonymous'}
              </Text>
              <Text style={styles.where} numberOfLines={1}>
                {[profile.country ? `${flagOf(profile.country)} ${countryName(profile.country)}` : 'No country', profile.city].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <PressableScale accessibilityRole="button" accessibilityLabel="Edit how you appear" onPress={() => setEditing(true)} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}>
              <Text style={styles.editText}>Edit</Text>
            </PressableScale>
          </View>
        )}

        {!online ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Not connected yet</Text>
            <Text style={styles.noticeText}>Leaderboards appear once the game is connected to its server.</Text>
          </View>
        ) : needsPlace ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{scope === 'city' ? 'Who is playing near you?' : 'Which country are you in?'}</Text>
            <Text style={styles.noticeText}>{scope === 'city' ? 'Add your city to see the board for it. Only the city you choose is shown, nothing else.' : 'Choose your country to see its board.'}</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel={scope === 'city' ? 'Add your city' : 'Choose your country'} onPress={() => setEditing(true)} style={({ pressed }) => [styles.primary, styles.noticeButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{scope === 'city' ? 'Add your city' : 'Choose your country'}</Text>
            </PressableScale>
          </View>
        ) : load.state === 'loading' ? (
          <View style={styles.list}>
            {Array.from({ length: 6 }, (_v, i) => (
              <View key={i} style={[styles.row, styles.ghost]}>
                <View style={[styles.place, styles.ghostBlock]} />
                <View style={[styles.ghostLine, { width: `${50 - i * 4}%` }]} />
              </View>
            ))}
          </View>
        ) : load.state === 'error' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Could not reach the leaderboard</Text>
            <Text style={styles.noticeText}>Check your connection.</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Try again" onPress={() => setAttempt(a => a + 1)} style={({ pressed }) => [styles.secondary, styles.noticeButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryText}>Try again</Text>
            </PressableScale>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{kind === 'daily' ? 'Nobody here has solved it yet' : 'Nobody here yet'}</Text>
            <Text style={styles.noticeText}>{kind === 'daily' ? "Solve today's Daily and take first place." : 'Play a few puzzles and you will be the first name on this board.'}</Text>
            {kind === 'daily' && (
              <PressableScale accessibilityRole="button" accessibilityLabel="Play today's Daily" onPress={onPlayDaily} style={({ pressed }) => [styles.primary, styles.noticeButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Play the Daily</Text>
              </PressableScale>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {top.map((row, i) => (
              <Row key={`${row.place}-${row.name}-${i}`} row={row} kind={kind} index={i} />
            ))}
            {meBelow && (
              <>
                <Text style={styles.gap}>· · ·</Text>
                <Row row={meBelow} kind={kind} index={top.length} />
              </>
            )}
            {kind === 'daily' && !dailyCompletedToday && (
              <View style={styles.footer}>
                <Text style={styles.noticeText}>Solve today's Daily to take your place.</Text>
                <PressableScale accessibilityRole="button" accessibilityLabel="Play today's Daily" onPress={onPlayDaily} style={({ pressed }) => [styles.primary, styles.noticeButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryText}>Play the Daily</Text>
                </PressableScale>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {editing && profile && (
        <ProfileEditor
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={next => {
            setProfile(next);
            setEditing(false);
          }}
        />
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerSide: { width: 80 },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  flex: { flex: 1 },
  boards: { flexDirection: 'row', padding: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
  board: { paddingVertical: 9, borderRadius: theme.radii.pill, alignItems: 'center' },
  boardOn: { backgroundColor: theme.colors.textPrimary },
  boardText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  boardTextOn: { color: theme.colors.background },
  scopesScroll: { marginHorizontal: -theme.spacing.lg, marginTop: theme.spacing.md },
  scopes: { paddingHorizontal: theme.spacing.lg, gap: 8 },
  scope: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, maxWidth: 200 },
  scopeOn: { borderColor: theme.colors.secondary, backgroundColor: theme.colors.surfaceHi },
  scopeText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  scopeTextOn: { color: theme.colors.textPrimary },
  explain: { marginTop: theme.spacing.md, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textTertiary },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  meName: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  edit: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  editText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  list: { marginTop: theme.spacing.lg, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowMe: { borderColor: theme.colors.secondary, borderWidth: 1.5, backgroundColor: theme.colors.surfaceHi },
  place: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt },
  placeText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] },
  placeTextMedal: { color: '#FFFDF8' },
  who: { flex: 1 },
  name: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textPrimary },
  you: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  where: { marginTop: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textTertiary },
  score: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },
  gap: { textAlign: 'center', color: theme.colors.textTertiary, letterSpacing: 2 },
  ghost: { opacity: 0.6 },
  ghostBlock: { backgroundColor: theme.colors.surfaceAlt },
  ghostLine: { height: 12, borderRadius: 6, backgroundColor: theme.colors.surfaceAlt },
  notice: { marginTop: theme.spacing.lg, padding: theme.spacing.lg, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  noticeTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.subtitle + 1, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  noticeText: { marginTop: 4, fontSize: theme.typography.sizes.caption, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center' },
  noticeButton: { marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  footer: { marginTop: theme.spacing.md, alignItems: 'center' },
  primary: { alignItems: 'center', paddingVertical: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  primaryText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  secondary: { alignItems: 'center', paddingVertical: 12, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  secondaryText: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  sheetLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 20 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrimFill: { flex: 1, backgroundColor: theme.colors.overlay },
  sheetWrap: { maxHeight: '88%' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: theme.colors.background },
  sheetContent: { padding: theme.spacing.lg },
  sheetTitle: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  sheetLede: { marginTop: 2, fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  label: { marginTop: theme.spacing.lg, marginBottom: 6, fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  input: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
  },
  inputBad: { borderColor: theme.colors.danger },
  chosen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chosenText: { fontSize: theme.typography.sizes.body, color: theme.colors.textPrimary },
  link: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.secondary },
  option: { paddingHorizontal: theme.spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  optionText: { fontSize: theme.typography.sizes.body, color: theme.colors.textPrimary },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm },
  suggestion: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
  suggestionText: { fontSize: theme.typography.sizes.caption, color: theme.colors.textPrimary },
  failed: { marginTop: theme.spacing.md, fontSize: theme.typography.sizes.caption, color: theme.colors.danger },
  sheetActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xl },
}));

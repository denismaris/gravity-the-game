import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { accentColorForKind, GameKind, ROTATION } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { GameEmblemGlyph } from './GameEmblem';
import { PressableScale } from './PressableScale';

/** The coin, as Skia content - the same strike as `CoinGlyph`. */
function CoinMark({ x, y, size }: { x: number; y: number; size: number }): React.JSX.Element {
  const c = size / 2;
  const d = size * 0.2;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Circle cx={c} cy={c} r={c} color={theme.colors.accent} />
      <Circle cx={c} cy={c} r={c * 0.74} color="#E2B85C" style="stroke" strokeWidth={Math.max(1, size * 0.07)} />
      <Path path={`M ${c} ${c - d} L ${c + d} ${c} L ${c} ${c + d} L ${c - d} ${c} Z`} color="#FFF3D4" />
    </Group>
  );
}

/** Page one: all twelve games, as the almanac's own contents page. */
function GamesArt({ width }: { width: number }): React.JSX.Element {
  const cols = 4;
  const gap = 12;
  const size = Math.min(58, (width - gap * (cols - 1)) / cols);
  const rows = Math.ceil(ROTATION.length / cols);
  const left = (width - (size * cols + gap * (cols - 1))) / 2;
  return (
    <Canvas style={{ width, height: rows * size + (rows - 1) * gap }}>
      {ROTATION.map((kind, i) => (
        <GameEmblemGlyph key={kind} kind={kind} size={size} x={left + (i % cols) * (size + gap)} y={Math.floor(i / cols) * (size + gap)} />
      ))}
    </Canvas>
  );
}

/** Page two: a level's set of four - the challenge ruled under, one
 * golden puzzle wearing its coin. */
function SetArt({ width }: { width: number }): React.JSX.Element {
  const set: GameKind[] = ['tents', 'bridges', 'binairo', 'mirror'];
  const size = Math.min(62, (width - 3 * 16) / 4);
  const gap = (width - size * 4) / 3;
  return (
    <Canvas style={{ width, height: size + 26 }}>
      {set.map((kind, i) => (
        <GameEmblemGlyph key={kind} kind={kind} size={size} x={i * (size + gap)} y={10} />
      ))}
      <CoinMark x={size + gap + size - 14} y={0} size={24} />
      <RoundedRect x={3 * (size + gap)} y={size + 18} width={size} height={4} r={2} color={theme.colors.accent} />
    </Canvas>
  );
}

/** Page three: a purse's worth of coins, fanned. */
function CoinsArt({ width }: { width: number }): React.JSX.Element {
  const size = 46;
  const centre = width / 2 - size / 2;
  return (
    <Canvas style={{ width, height: size + 30 }}>
      <CoinMark x={centre - 52} y={22} size={size - 8} />
      <CoinMark x={centre + 60} y={22} size={size - 8} />
      <CoinMark x={centre} y={0} size={size + 8} />
    </Canvas>
  );
}

/** Page four: a week of Daily marks, four lit - a streak under way. */
function DaysArt({ width }: { width: number }): React.JSX.Element {
  const marks = 7;
  const gap = 8;
  const w = Math.min(30, (width - gap * (marks - 1)) / marks);
  const left = (width - (w * marks + gap * (marks - 1))) / 2;
  return (
    <Canvas style={[styles.daysArt, { width }]}>
      {Array.from({ length: marks }, (_v, i) => (
        <RoundedRect
          key={i}
          x={left + i * (w + gap)}
          y={14}
          width={w}
          height={36}
          r={8}
          color={i < 4 ? theme.colors.secondary : theme.colors.surfaceAlt}
        />
      ))}
      <Circle cx={left + 3 * (w + gap) + w / 2} cy={6} r={4} color={theme.colors.secondary} />
    </Canvas>
  );
}

interface IntroPage {
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly points: ReadonlyArray<readonly [string, string]>;
  readonly art: (width: number) => React.JSX.Element;
}

const PAGES: ReadonlyArray<IntroPage> = [
  {
    kicker: 'WELCOME TO TESSERA',
    title: 'Twelve games, one almanac',
    body: 'Logic puzzles from twelve different games, dealt to you one after another. No level select, no menus to wade through. Just the next good puzzle.',
    points: [
      ['▦︎', 'A new board every time. They never run out'],
      ['✓︎', 'Every puzzle has one solution, reachable by logic'],
    ],
    art: width => <GamesArt width={width} />,
  },
  {
    kicker: 'HOW LEVELS WORK',
    title: 'Sets of four',
    body: 'Each level is a set of puzzles from mixed games. Finish the set to move on. Difficulty climbs gently, and a hard challenge turns up now and then.',
    points: [
      ['▁', 'The underlined puzzle is the challenge'],
      ['◉', 'A golden puzzle pays triple coins'],
    ],
    art: width => <SetArt width={width} />,
  },
  {
    kicker: 'COINS & HINTS',
    title: 'Earn, then spend',
    body: 'Every first solve pays coins, more for three stars. Spend them on a hint when you are stuck, or on new looks for your almanac in the shop.',
    points: [
      ['★︎', 'Stars fall with each hint you take'],
      ['×', 'Solve without hints in a row for a clean-run bonus'],
    ],
    art: width => <CoinsArt width={width} />,
  },
  {
    kicker: 'EVERY DAY',
    title: 'Something to come back for',
    body: 'A Daily puzzle to keep your streak, three errands for bonus coins, and a Weekly Grand with rewards the shop never sells.',
    points: [
      ['☀︎', 'Ranks, chapters and a stamp album fill as you play'],
      ['⚙︎', 'Sound, haptics and breaks live in Settings'],
    ],
    art: width => <DaysArt width={width} />,
  },
];

export interface IntroWalkthroughProps {
  onDone: () => void;
}

/**
 * The first-launch walkthrough: four pages on how the almanac works, over
 * a dimmed Home. Swipe or tap through; Skip leaves at once. Shown once -
 * the caller records it seen, whichever way it is left.
 */
export function IntroWalkthrough({ onDone }: IntroWalkthroughProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - theme.spacing.lg * 2, 420);
  const artWidth = cardWidth - theme.spacing.lg * 2;
  const [page, setPage] = useState(0);
  const scroller = useRef<React.ElementRef<typeof ScrollView>>(null);
  const appear = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [appear]);

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    triggerFeedback('tap');
    Animated.timing(appear, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onDone());
  };

  const goTo = (next: number) => {
    scroller.current?.scrollTo({ x: next * cardWidth, animated: true });
    setPage(next);
    triggerFeedback('uiPage');
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
    if (next !== page && next >= 0 && next < PAGES.length) setPage(next);
  };

  const last = page === PAGES.length - 1;
  const accent = accentColorForKind(ROTATION[(page * 3) % ROTATION.length]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[styles.scrim, { opacity: appear }]} />
      <Animated.View
        style={[
          styles.wrap,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg },
          { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
        ]}
      >
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={[styles.band, { backgroundColor: accent }]} />
          <View style={styles.top}>
            <Text style={styles.count}>{`${page + 1} / ${PAGES.length}`}</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Skip the introduction" onPress={finish} hitSlop={10}>
              <Text style={styles.skip}>Skip</Text>
            </PressableScale>
          </View>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            style={{ width: cardWidth }}
          >
            {PAGES.map(p => (
              <View key={p.title} style={[styles.page, { width: cardWidth }]}>
                <View style={styles.art}>{p.art(artWidth)}</View>
                <Text style={styles.kicker}>{p.kicker}</Text>
                <Text style={styles.title}>{p.title}</Text>
                <Text style={styles.body}>{p.body}</Text>
                <View style={styles.points}>
                  {p.points.map(([glyph, text]) => (
                    <View key={text} style={styles.point}>
                      <View style={styles.pointGlyphBox}>
                        <Text style={styles.pointGlyph}>{glyph}</Text>
                      </View>
                      <Text style={styles.pointText}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.foot}>
            <View style={styles.dots}>
              {PAGES.map((p, i) => (
                <View key={p.title} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={last ? 'Start playing' : 'Next page'}
              onPress={last ? finish : () => goTo(page + 1)}
              style={({ pressed }) => [styles.next, pressed && styles.pressed]}
            >
              <Text style={styles.nextText}>{last ? 'Start playing ›' : 'Next ›'}</Text>
            </PressableScale>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = themedStyles(() => ({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.overlay },
  daysArt: { height: 64 },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surfaceHi,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  band: { height: 5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  count: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.2, color: theme.colors.textTertiary },
  skip: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  page: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  art: { alignItems: 'center', justifyContent: 'center', minHeight: 150, marginBottom: theme.spacing.md },
  kicker: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.5, color: theme.colors.secondary },
  title: {
    marginTop: 4,
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  body: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.body, lineHeight: 21, color: theme.colors.textSecondary },
  points: { marginTop: theme.spacing.md, gap: 8, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointGlyphBox: { width: 24, height: 24, borderRadius: 7, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  pointGlyph: { fontSize: 12, color: theme.colors.accent, fontWeight: theme.typography.weights.bold },
  pointText: { flex: 1, fontSize: theme.typography.sizes.caption, color: theme.colors.textPrimary },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  dotOn: { width: 18, backgroundColor: theme.colors.primary },
  next: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary },
  nextText: { color: theme.colors.surfaceHi, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  pressed: { opacity: 0.85 },
}));

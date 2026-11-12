import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { accentColorForKind, GameKind, ROTATION } from '../game/journey';
import { isReducedMotion, readableOn, triggerFeedback } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { GameEmblemGlyph, mix } from './GameEmblem';
import { DialogActions } from './dialog';
import { Frosted } from './Frosted';
import { TesseraMark } from './TesseraMark';
import { curve } from '../theme/motion';

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
  const cols = 7;
  const gap = 8;
  const size = Math.min(40, (width - gap * (cols - 1)) / cols);
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
  const set: GameKind[] = ['lilypads', 'bridges', 'binairo', 'mirror'];
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
    kicker: 'The games',
    title: 'Twelve games, one at a time',
    body: 'You start with one game. Once you have the hang of it, the next one arrives, and so on until all twelve are yours. Every new game opens with a short lesson.',
    points: [
      ['▦︎', 'A new board every time. They never run out'],
      ['✓︎', 'Every puzzle can be solved by logic alone'],
    ],
    art: width => <GamesArt width={width} />,
  },
  {
    kicker: 'How levels work',
    title: 'Short sets',
    body: 'Each level is a short set of puzzles. Finish the set to move on. Everything starts easy, and nothing gets hard until you know every game.',
    points: [
      ['▁', 'The underlined puzzle is the challenge'],
      ['◉', 'A golden puzzle pays triple coins'],
    ],
    art: width => <SetArt width={width} />,
  },
  {
    kicker: 'Insight and coins',
    title: 'Stuck? Ask for Insight',
    body: 'Insight shows your next move and tells you why. You start with three; a short video or a few coins brings more. Coins also buy new looks in the shop.',
    points: [
      ['✓︎', 'A puzzle solved without help pays a little more'],
      ['×', 'Solve a few in a row without help for a bonus'],
    ],
    art: width => <CoinsArt width={width} />,
  },
  {
    kicker: 'Every day',
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

/** The reading column, the same width the finish page and the game
 * lessons use. */
const COLUMN_MAX = 420;
const PAGE_GUTTER = theme.spacing.xl;
/** Every page's picture sits in a plate this tall, so the titles line up
 * from page to page. */
const PLATE_HEIGHT = 150;
/** On a short phone (an SE) the plate gives up some height first. */
const PLATE_HEIGHT_SHORT = 120;
const PLATE_INSET = 20;

/**
 * The first-launch walkthrough: four pages on how the almanac works, laid
 * over Home the way a game's own "How to play" is: Home frosted behind,
 * the almanac's mark at the head, each page's picture on a plate in the
 * middle, the way on at the thumb. Swipe or tap through; Skip leaves at
 * once. Shown once - the caller records it seen, whichever way it is left.
 */
export function IntroWalkthrough({ onDone }: IntroWalkthroughProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const plateHeight = height < 760 ? PLATE_HEIGHT_SHORT : PLATE_HEIGHT;
  const pageWidth = width;
  const columnWidth = Math.min(COLUMN_MAX, pageWidth - PAGE_GUTTER * 2);
  const artWidth = columnWidth - PLATE_INSET * 2;
  const [page, setPage] = useState(0);
  const scroller = useRef<React.ElementRef<typeof ScrollView>>(null);
  const appear = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  const leaving = useRef(false);

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 420, easing: curve.arrive, useNativeDriver: true }).start();
  }, [appear]);

  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    triggerFeedback('tap');
    Animated.timing(appear, { toValue: 0, duration: 260, easing: curve.leave, useNativeDriver: true }).start(() => onDone());
  };

  const settleOn = (next: number) => {
    if (next === page || next < 0 || next >= PAGES.length) return;
    setPage(next);
    triggerFeedback('uiPage');
  };

  const goTo = (next: number) => {
    scroller.current?.scrollTo({ x: next * pageWidth, animated: true });
    settleOn(next);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    settleOn(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  const last = page === PAGES.length - 1;
  const steps = PAGES.length - 1;
  const pillX = scrollX.interpolate({ inputRange: [0, steps * pageWidth], outputRange: [0, steps * (DOT + DOT_GAP)], extrapolate: 'clamp' });
  const pill = pageAccent(page);

  return (
    <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]} pointerEvents="none">
        <Frosted />
      </Animated.View>
      <Animated.View
        style={[
          styles.wrap,
          { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.md },
          { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
        ]}
      >
        <View style={styles.head}>
          <TesseraMark size={44} />
          <Text style={styles.headKicker}>Welcome to Tessellatum</Text>
        </View>

        <View style={styles.pages}>
          <Animated.ScrollView
            ref={scroller as never}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onScrollEnd}
            style={[styles.scroller, { width: pageWidth }]}
          >
            {PAGES.map((p, i) => {
              const accent = pageAccent(i);
              const ink = readableOn(accent, theme.colors.background, theme.colors.textPrimary);
              const around = [(i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
              return (
                <View
                  key={p.title}
                  style={[styles.page, { width: pageWidth }]}
                  accessibilityElementsHidden={i !== page}
                  importantForAccessibility={i === page ? 'auto' : 'no-hide-descendants'}
                >
                  <View style={{ width: columnWidth }}>
                    {/* The picture drifts a little behind the swipe and
                        fades at the edge of its page: depth, not a slide. */}
                    <Animated.View
                      style={[
                        styles.plate,
                        { height: plateHeight },
                        { backgroundColor: safeMix(theme.colors.surfaceAlt, accent, 0.14), borderColor: safeMix(theme.colors.surfaceAlt, accent, 0.32) },
                        {
                          opacity: scrollX.interpolate({ inputRange: around, outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' }),
                          transform: [{ translateX: scrollX.interpolate({ inputRange: around, outputRange: [pageWidth * 0.2, 0, -pageWidth * 0.2], extrapolate: 'clamp' }) }],
                        },
                      ]}
                    >
                      {p.art(artWidth)}
                    </Animated.View>
                    <Text style={[styles.kicker, { color: ink }]}>{`${i + 1} of ${PAGES.length} · ${p.kicker}`}</Text>
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
                </View>
              );
            })}
          </Animated.ScrollView>
        </View>

        <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
          {PAGES.map(p => (
            <View key={p.title} style={styles.dot} />
          ))}
          {/* One pill that travels with the finger, page to page. */}
          <Animated.View style={[styles.pill, { backgroundColor: pill, transform: [{ translateX: pillX }] }]} />
        </View>

        {/* The way on, docked where the thumb is. The second choice is
            always there, so the buttons never jump. */}
        <View style={{ width: columnWidth }}>
          <DialogActions
            primary={last ? { label: 'Got it', onPress: finish, accessibilityLabel: 'Close the introduction' } : { label: 'Next', onPress: () => goTo(page + 1), onward: true }}
            secondary={last ? { label: 'Back', onPress: () => goTo(page - 1) } : { label: 'Skip', onPress: finish, accessibilityLabel: 'Skip the introduction' }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

/** Each page wears a different game's colour, stepping round the set. */
function pageAccent(i: number): string {
  return accentColorForKind(ROTATION[(i * 3) % ROTATION.length]);
}

/** `mix`, falling back to the plain colour if either is not `#rrggbb`. */
function safeMix(a: string, b: string, t: number): string {
  const hex = /^#[0-9a-f]{6}$/i;
  return hex.test(a) && hex.test(b) ? mix(a, b, t) : a;
}

/** The dots under the pages, and the pill that runs over them. */
const DOT = 6;
const DOT_GAP = 8;
const PILL = 18;

const styles = themedStyles(() => ({
  daysArt: { height: 64 },
  wrap: { flex: 1, alignItems: 'center' },
  head: { alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  headKicker: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  pages: { flex: 1, justifyContent: 'center' },
  scroller: { flexGrow: 0 },
  page: { alignItems: 'center' },
  /** The picture's plate: paper with a little of the page's colour in it. */
  plate: { alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1 },
  kicker: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: theme.typography.families.display,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  body: { marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.body, lineHeight: theme.typography.lineHeights.body, color: theme.colors.textSecondary },
  points: { marginTop: theme.spacing.md, gap: 10 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointGlyphBox: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  pointGlyph: { fontSize: 12, color: theme.colors.accentText, fontWeight: theme.typography.weights.bold },
  pointText: { flex: 1, fontSize: theme.typography.sizes.body, lineHeight: theme.typography.lineHeights.body, color: theme.colors.textPrimary },
  dots: { flexDirection: 'row', gap: DOT_GAP, height: DOT, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: theme.colors.borderStrong },
  pill: { position: 'absolute', left: -(PILL - DOT) / 2, width: PILL, height: DOT, borderRadius: DOT / 2 },
}));

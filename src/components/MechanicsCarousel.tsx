import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Group } from '@shopify/react-native-skia';
import { Text } from './Text';
import { DialogActions } from './dialog';
import { announce, isReducedMotion, readableOn, triggerFeedback } from '../game/rendering';
import { TutorialSlide } from '../game/tutorials';
import { GameKind, gameDisplayName } from '../game/journey';
import { theme, themedStyles } from '../theme';
import { curve } from '../theme/motion';
import { ModalLayer } from './ModalLayer';
import { Frosted } from './Frosted';
import { GameEmblem, mix } from './GameEmblem';

/** The size every slide's illustration is drawn at. Each game's set
 * (`BinairoMechanicsIllustrations.tsx`, ...) centres its diagram in this
 * box; the carousel scales the whole box up to the phone it is on. */
export const ILLUSTRATION_WIDTH = 260;
export const ILLUSTRATION_HEIGHT = 140;

/** The reading column, the same width the finish page uses. */
const COLUMN_MAX = 420;
const PAGE_GUTTER = theme.spacing.xl;
/** Room inside the plate around the drawing. */
const PLATE_INSET = 18;
/** Never blown up past this: the diagrams are drawn for a small box. */
const MAX_SCALE = 1.4;

export interface MechanicsCarouselProps {
  slides: ReadonlyArray<TutorialSlide>;
  /** Draws one slide's illustration, keyed by `TutorialSlide.illustration`,
   * from that game's own board drawing, so a slide's pieces look exactly
   * like the ones on the board. */
  renderIllustration: (kind: string) => React.ReactNode;
  onDone: () => void;
  /** The game being taught: its emblem and name head the page. */
  kind?: GameKind;
  /** The game's colour, for the name, the plates and the page marker. */
  accentColor?: string;
}

/**
 * How a game plays, one rule per page, laid over the board the way a
 * finish is: the board frosted behind, the game's emblem and name at the
 * head, the rule's picture large in the middle, the way on at the thumb.
 * Shown on a game's first open and again from its "?" key; always starts
 * at page one, since its state is fresh on every mount.
 *
 * Paging is a plain `ScrollView` with `pagingEnabled`; Next and Skip are
 * there for anyone who would rather tap.
 */
export function MechanicsCarousel({ slides, renderIllustration, onDone, kind, accentColor = theme.colors.secondary }: MechanicsCarouselProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth;
  const columnWidth = Math.min(COLUMN_MAX, pageWidth - PAGE_GUTTER * 2);
  const scale = Math.min(MAX_SCALE, (columnWidth - PLATE_INSET * 2) / ILLUSTRATION_WIDTH);
  const artW = Math.round(ILLUSTRATION_WIDTH * scale);
  const artH = Math.round(ILLUSTRATION_HEIGHT * scale);

  // Text in the game's colour, never fainter than 4.5:1 on the paper.
  const ink = readableOn(accentColor, theme.colors.background, theme.colors.textPrimary);
  const plate = safeMix(theme.colors.surfaceAlt, accentColor, 0.14);
  const plateEdge = safeMix(theme.colors.surfaceAlt, accentColor, 0.32);

  const appear = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  // Where the pages are, read on the native thread: the marker and each
  // picture's drift follow the finger with no JavaScript per frame.
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  // A picture is drawn once its page is near, and kept once drawn: every
  // canvas made at once was the heavy frame as the page opened.
  const [drawn, setDrawn] = useState<ReadonlySet<number>>(() => new Set([0, 1]));

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 420, easing: curve.arrive, useNativeDriver: true }).start();
  }, [appear]);

  useEffect(() => {
    announce(`${kind ? `${gameDisplayName(kind)}. ` : ''}How to play. ${slides[0]?.title ?? ''}`, 500);
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settleOn = useCallback((i: number) => {
    // A light tick as a page lands, the way a page turns under a thumb.
    setIndex(prev => {
      if (prev !== i) triggerFeedback('uiPage');
      return i;
    });
    setDrawn(prev => (prev.has(i + 1) && prev.has(i) ? prev : new Set([...prev, i, i + 1])));
  }, []);

  const goTo = useCallback(
    (i: number) => {
      scrollRef.current?.scrollTo({ x: i * pageWidth, animated: true });
      settleOn(i);
    },
    [settleOn, pageWidth],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleOn(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / pageWidth))));
    },
    [settleOn, pageWidth, slides.length],
  );

  const isLast = index === slides.length - 1;
  const steps = Math.max(1, slides.length - 1);
  const pillX = scrollX.interpolate({ inputRange: [0, steps * pageWidth], outputRange: [0, steps * (DOT + DOT_GAP)], extrapolate: 'clamp' });

  return (
    <ModalLayer zIndex={10}>
      {/* The whole screen takes the touch: the board waits behind. */}
      <View style={styles.overlay} onStartShouldSetResponder={() => true} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: appear }]} pointerEvents="none">
          <Frosted />
        </Animated.View>

        <Animated.View
          style={[
            styles.page,
            { paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.md },
            { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] },
          ]}
        >
          <View style={styles.head}>
            {kind && <GameEmblem kind={kind} size={52} raised />}
            <Text style={[styles.kicker, { color: ink }]}>{kind ? `${gameDisplayName(kind)} · How to play` : 'How to play'}</Text>
          </View>

          <View style={styles.pages}>
            <Animated.ScrollView
              ref={scrollRef as never}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={onMomentumScrollEnd}
              style={[styles.scroller, { width: pageWidth }]}
            >
              {slides.map((slide, i) => {
                const around = [(i - 1) * pageWidth, i * pageWidth, (i + 1) * pageWidth];
                return (
                  <View
                    key={i}
                    style={[styles.slide, { width: pageWidth }]}
                    accessibilityElementsHidden={i !== index}
                    importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
                  >
                    <View style={{ width: columnWidth }}>
                      {/* The picture drifts a little behind the swipe and
                          fades at the edge of its page: depth, not a slide. */}
                      <Animated.View
                        style={[
                          styles.plate,
                          { height: artH + PLATE_INSET * 2, backgroundColor: plate, borderColor: plateEdge },
                          {
                            opacity: scrollX.interpolate({ inputRange: around, outputRange: [0.2, 1, 0.2], extrapolate: 'clamp' }),
                            transform: [{ translateX: scrollX.interpolate({ inputRange: around, outputRange: [pageWidth * 0.2, 0, -pageWidth * 0.2], extrapolate: 'clamp' }) }],
                          },
                        ]}
                      >
                        {drawn.has(i) ? (
                          <Canvas style={{ width: artW, height: artH }}>
                            <Group transform={[{ scale }]}>{renderIllustration(slide.illustration)}</Group>
                          </Canvas>
                        ) : (
                          <View style={{ width: artW, height: artH }} />
                        )}
                      </Animated.View>

                      <Text style={[styles.step, { color: ink }]}>{`${i + 1} of ${slides.length}`}</Text>
                      <Text style={styles.title}>{slide.title}</Text>
                      <Text style={styles.body}>{slide.body}</Text>
                      {slide.tip ? (
                        <View style={styles.tip}>
                          <View style={[styles.tipMark, { backgroundColor: accentColor }]} />
                          <Text style={styles.tipText}>{slide.tip}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Animated.ScrollView>
          </View>

          {slides.length > 1 && (
            <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${slides.length}`}>
              {slides.map((_slide, i) => (
                <View key={i} style={styles.dot} />
              ))}
              {/* One pill that travels with the finger, page to page. */}
              <Animated.View style={[styles.pill, { backgroundColor: accentColor, transform: [{ translateX: pillX }] }]} />
            </View>
          )}

          {/* The way on, docked where the thumb is, as on the finish page.
              The second choice is always there, so the buttons never jump. */}
          <View style={{ width: columnWidth }}>
            <DialogActions
              primary={isLast ? { label: 'Start playing', onPress: onDone, onward: true } : { label: 'Next', onPress: () => goTo(index + 1), onward: true }}
              secondary={isLast && slides.length > 1 ? { label: 'Back', onPress: () => goTo(index - 1) } : isLast ? undefined : { label: 'Skip', onPress: onDone }}
            />
          </View>
        </Animated.View>
      </View>
    </ModalLayer>
  );
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
  overlay: { ...StyleSheet.absoluteFill },
  page: { flex: 1, alignItems: 'center' },
  head: { alignItems: 'center', gap: theme.spacing.sm },
  kicker: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  /** The pages sit in the room between the head and the keys. */
  pages: { flex: 1, justifyContent: 'center' },
  scroller: { flexGrow: 0 },
  slide: { alignItems: 'center' },
  /** The picture's plate: paper with a little of the game's colour in it,
   * so the drawing sits in a place rather than floating on the page. */
  plate: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  step: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.micro,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: theme.typography.families.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  body: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
  },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: theme.spacing.md },
  tipMark: { width: 3, alignSelf: 'stretch', borderRadius: 1.5, opacity: 0.85 },
  tipText: { flex: 1, fontSize: theme.typography.sizes.body, lineHeight: theme.typography.lineHeights.body, color: theme.colors.textPrimary },
  dots: { flexDirection: 'row', gap: DOT_GAP, height: DOT, marginTop: theme.spacing.md, marginBottom: theme.spacing.lg, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: theme.colors.borderStrong },
  pill: { position: 'absolute', left: -(PILL - DOT) / 2, width: PILL, height: DOT, borderRadius: DOT / 2 },
}));

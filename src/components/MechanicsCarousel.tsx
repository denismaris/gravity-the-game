import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Canvas } from '@shopify/react-native-skia';
import { DialogActions } from './dialog';
import { isReducedMotion, triggerFeedback } from '../game/rendering';
import { TutorialSlide } from '../game/tutorials';
import { motion, theme, themedStyles } from '../theme';
import { ModalLayer } from './ModalLayer';

/** The card's own fixed width - paging needs an exact known slide width,
 * not a `maxWidth` that could vary per device the way `TutorialOverlay`'s
 * does. 328 comfortably fits with margin on every phone this app targets
 * (even the smallest, ~375pt wide) without needing to measure layout. */
const CARD_WIDTH = 328;
const CARD_PADDING_H = theme.spacing.lg;

/** The fixed size every slide's illustration canvas renders into -
 * exported so each game's own illustration set (`BinairoMechanicsIllustrations.tsx`,
 * `TentsMechanicsIllustrations.tsx`, ...) can centre its own diagram
 * against the same box without duplicating these numbers. */
export const ILLUSTRATION_WIDTH = 260;
export const ILLUSTRATION_HEIGHT = 140;

export interface MechanicsCarouselProps {
  slides: ReadonlyArray<TutorialSlide>;
  /** Draws one slide's illustration, keyed by `TutorialSlide.illustration`
   * - the one game-specific piece of an otherwise fully generic carousel.
   * Each game supplies its own (see `renderBinairoIllustration`/
   * `renderTentsIllustration`), built from that game's own real board-
   * rendering functions so a slide's tree/circle/badge is pixel-identical
   * to the one a player will actually see. */
  renderIllustration: (kind: string) => React.ReactNode;
  onDone: () => void;
  /** Colour for the "HOW TO PLAY" eyebrow and the active pagination dot -
   * defaults the same way `TutorialOverlay`'s `accentColor` does. */
  accentColor?: string;
}

/**
 * A horizontally-paged "how this works" carousel, one slide per mechanic -
 * the multi-page counterpart to `TutorialOverlay` for a game whose rules
 * don't fit in one overlay's body text. Fully game-agnostic: every game
 * supplies its own `slides` (from `src/game/tutorials.ts`) and its own
 * `renderIllustration` (from that game's own illustration module) - this
 * component only owns the paging/chrome/dots/buttons every game shares.
 * Reused verbatim for both the first-time auto-open and a manual reopen
 * (see each screen's own "?" icon) - the caller just mounts/unmounts the
 * same component either way, so "always starts at slide 1" is free: this
 * component's own `index` state is fresh on every mount, never persisted
 * or resumed.
 *
 * Paging is a plain `ScrollView` with `pagingEnabled`, not a hand-rolled
 * `PanResponder` - there's no gesture need here (no velocity handoff, no
 * mid-drag decision) that a `ScrollView` doesn't already give for free,
 * and this app has no other carousel to match a hand-rolled gesture to.
 * Explicit Skip/Next controls exist alongside the swipe for anyone who'd
 * rather tap through.
 */
export function MechanicsCarousel({
  slides,
  renderIllustration,
  onDone,
  accentColor = theme.colors.secondary,
}: MechanicsCarouselProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  // Where the pages are, read on the native thread: the dot pill and each
  // picture's drift follow the finger with no JavaScript per frame.
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }), [scrollX]);
  // A picture is drawn once its page is near: every slide's canvas made at
  // once was the heavy frame as the card opened. Kept once drawn, so
  // paging back never redraws it from blank.
  const [drawn, setDrawn] = useState<ReadonlySet<number>>(() => new Set([0, 1]));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.cardEnter.duration,
      easing: motion.cardEnter.easing,
      useNativeDriver: true,
    }).start();
  }, [progress]);

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
      scrollRef.current?.scrollTo({ x: i * CARD_WIDTH, animated: true });
      settleOn(i);
    },
    [settleOn],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleOn(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH));
    },
    [settleOn],
  );

  const isLast = index === slides.length - 1;
  const span = Math.max(1, slides.length - 1) * CARD_WIDTH;
  const pillX = scrollX.interpolate({ inputRange: [0, span], outputRange: [0, Math.max(1, slides.length - 1) * (DOT + DOT_GAP)], extrapolate: 'clamp' });

  return (
    <ModalLayer zIndex={10}>
      <Animated.View style={[styles.overlay, { opacity: progress }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <Text style={[styles.eyebrow, { color: accentColor }]}>How to play</Text>

          <Animated.ScrollView
            ref={scrollRef as never}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumScrollEnd}
            style={{ width: CARD_WIDTH }}
          >
            {slides.map((slide, i) => {
              const around = [(i - 1) * CARD_WIDTH, i * CARD_WIDTH, (i + 1) * CARD_WIDTH];
              return (
                <View key={i} style={styles.slide} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
                  {/* The picture drifts a little behind the swipe and
                      fades at the edge of its page: depth, not a slide. */}
                  <Animated.View
                    style={[
                      styles.plate,
                      {
                        opacity: scrollX.interpolate({ inputRange: around, outputRange: [0.15, 1, 0.15], extrapolate: 'clamp' }),
                        transform: [{ translateX: scrollX.interpolate({ inputRange: around, outputRange: [CARD_WIDTH * 0.22, 0, -CARD_WIDTH * 0.22], extrapolate: 'clamp' }) }],
                      },
                    ]}
                  >
                    {drawn.has(i) ? (
                      <Canvas style={{ width: ILLUSTRATION_WIDTH, height: ILLUSTRATION_HEIGHT }}>{renderIllustration(slide.illustration)}</Canvas>
                    ) : (
                      <View style={{ width: ILLUSTRATION_WIDTH, height: ILLUSTRATION_HEIGHT }} />
                    )}
                  </Animated.View>
                  <Text style={styles.title}>{slide.title}</Text>
                  <Text style={styles.body}>{slide.body}</Text>
                  {slide.tip ? (
                    <View style={styles.tip}>
                      <View style={[styles.tipMark, { backgroundColor: accentColor }]} />
                      <Text style={styles.tipText}>{slide.tip}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Animated.ScrollView>

          {slides.length > 1 && (
            <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${slides.length}`}>
              {slides.map((_slide, i) => (
                <View key={i} style={styles.dot} />
              ))}
              {/* One pill that travels with the finger, page to page. */}
              <Animated.View style={[styles.pill, { backgroundColor: accentColor, transform: [{ translateX: pillX }] }]} />
            </View>
          )}

          <View style={styles.actions}>
            <DialogActions
              primary={isLast ? { label: 'Start playing', onPress: onDone, onward: true } : { label: 'Next', onPress: () => goTo(index + 1), onward: true }}
              secondary={isLast ? undefined : { label: 'Skip', onPress: onDone }}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </ModalLayer>
  );
}

/** The dots under the pages, and the pill that runs over them. */
const DOT = 6;
const DOT_GAP = 8;
const PILL = 18;

const styles = themedStyles(() => ({
  /** The page's paper over the board, as every finish screen has it. */
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.background}EB`,
    zIndex: 10,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  eyebrow: {
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.md,
  },
  slide: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingHorizontal: CARD_PADDING_H,
  },
  /** The picture's plate: a quiet inset of paper, so the drawing sits in a
   * place rather than floating on the card. */
  plate: {
    width: ILLUSTRATION_WIDTH + 24,
    height: ILLUSTRATION_HEIGHT + 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceAlt,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    lineHeight: theme.typography.lineHeights.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, alignSelf: 'stretch', marginTop: theme.spacing.md, paddingHorizontal: 4 },
  tipMark: { width: 3, alignSelf: 'stretch', borderRadius: 1.5, opacity: 0.8 },
  tipText: { flex: 1, fontSize: theme.typography.sizes.caption, lineHeight: theme.typography.lineHeights.caption, color: theme.colors.textPrimary },
  dots: { flexDirection: 'row', gap: DOT_GAP, height: DOT, marginTop: theme.spacing.lg, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: theme.colors.borderStrong },
  pill: { position: 'absolute', left: -(PILL - DOT) / 2, width: PILL, height: DOT, borderRadius: DOT / 2 },
  actions: { alignSelf: 'stretch', marginTop: theme.spacing.lg, paddingHorizontal: CARD_PADDING_H },
}));

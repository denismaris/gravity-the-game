import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { PressableScale } from './PressableScale';
import { TutorialSlide } from '../game/tutorials';
import { motion, theme } from '../theme';

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
  const progress = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.cardEnter.duration,
      easing: motion.cardEnter.easing,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const goTo = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ x: i * CARD_WIDTH, animated: true });
    setIndex(i);
  }, []);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH));
  }, []);

  const isLast = index === slides.length - 1;
  const opacity = progress;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        <Text style={[styles.eyebrow, { color: accentColor }]}>HOW TO PLAY</Text>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={{ width: CARD_WIDTH }}
        >
          {slides.map((slide, i) => (
            <View key={i} style={styles.slide}>
              <Canvas style={{ width: ILLUSTRATION_WIDTH, height: ILLUSTRATION_HEIGHT }}>{renderIllustration(slide.illustration)}</Canvas>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          {slides.map((_slide, i) => (
            <View key={i} style={[styles.dot, i === index && [styles.dotActive, { backgroundColor: accentColor }]]} />
          ))}
        </View>

        <View style={styles.actions}>
          {isLast ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Start playing"
              onPress={onDone}
              style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonLabel}>Start playing</Text>
            </PressableScale>
          ) : (
            <>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Skip"
                onPress={onDone}
                style={({ pressed }) => [styles.button, styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonLabel}>Skip</Text>
              </PressableScale>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Next"
                onPress={() => goTo(index + 1)}
                style={({ pressed }) => [styles.button, styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonLabel}>Next</Text>
              </PressableScale>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.overlay,
    zIndex: 10,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  eyebrow: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: theme.typography.tracking.eyebrow,
    color: theme.colors.secondary,
    marginBottom: theme.spacing.sm,
  },
  slide: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingHorizontal: CARD_PADDING_H,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingHorizontal: CARD_PADDING_H,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.transparent,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  primaryButtonLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  secondaryButtonLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});

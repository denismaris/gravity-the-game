import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { theme, themedStyles } from '../theme';
import { isReducedMotion } from '../game/rendering';
import { curve } from '../theme/motion';
import { isContinuing } from './playContinuity';
import { handoffActive } from './EmblemHandoff';

export interface ScreenTransitionProps {
  /** Identifies the screen inside. Changing it swaps the screen. */
  routeKey: string;
  /** Going back (to Home): the screen on show slides down off the one
   * beneath. Otherwise the new one slides up over it. */
  direction?: 'forward' | 'back';
  children: React.ReactNode;
}

/** Held after the new screen has drawn, before anything moves: what a
 * screen measures and settles in its first moments happens before the
 * slide, not during it. */
const SETTLE_MS = 90;
const SLIDE_MS = 380;

interface Slide {
  readonly from: string;
  readonly fromNode: React.ReactNode;
  readonly to: string;
  readonly back: boolean;
}

/**
 * Every change of screen as a sheet: the new screen slides up from the
 * bottom over the one being left; going back, the screen on show slides
 * down and away, revealing the one beneath.
 *
 * The incoming screen is built first, out of sight, and moves only once
 * it has drawn. A screen takes a few frames to build, and a slide started
 * before that froze, then caught up: the laggy swipe. Both screens are on
 * hand for the slide (the one being left kept as it last rendered), so
 * there is never a blank page between them.
 *
 * Every screen is a layer with its own key at one level, so the one
 * arriving is the same mounted screen before, during and after its slide.
 *
 * Two changes keep their own way in: board straight on to board ("Next
 * puzzle", the header stays put) and the opening hand-off from Home (its
 * veil and the emblem's flight). Reduced motion swaps at once.
 */
export function ScreenTransition({ routeKey, direction = 'forward', children }: ScreenTransitionProps): React.JSX.Element {
  const { height } = useWindowDimensions();
  const [settledKey, setSettledKey] = useState(routeKey);
  const [slide, setSlide] = useState<Slide | null>(null);
  const t = useRef(new Animated.Value(0)).current;
  // The settled screen as it last rendered: shown, and slid against, while
  // the next one is on its way.
  const settledNode = useRef<React.ReactNode>(children);
  if (!slide && routeKey === settledKey) settledNode.current = children;

  // A new screen asked for (or another one while a slide was under way).
  useEffect(() => {
    if (slide || routeKey === settledKey) return;
    if (isContinuing() || handoffActive() || isReducedMotion()) {
      setSettledKey(routeKey);
      return;
    }
    t.setValue(0);
    setSlide({ from: settledKey, fromNode: settledNode.current, to: routeKey, back: direction === 'back' });
    // Started by a new `routeKey`, or by a slide ending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, slide]);

  // The new screen is mounted, out of sight or beneath: once it has drawn,
  // slide.
  useEffect(() => {
    if (!slide) return;
    let second = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          Animated.timing(t, { toValue: 1, duration: SLIDE_MS, easing: slide.back ? curve.glide : curve.arrive, useNativeDriver: true }).start(() => {
            setSettledKey(slide.to);
            setSlide(null);
          });
        }, SETTLE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (timer) clearTimeout(timer);
    };
  }, [slide, t]);

  const layers: React.ReactNode[] = [];
  if (!slide) {
    // Settled - or a change just asked for and not yet begun: the screen
    // on show stays until its slide starts.
    const key = routeKey === settledKey ? routeKey : settledKey;
    layers.push(
      <Animated.View key={key} style={styles.layer}>
        {routeKey === settledKey ? children : settledNode.current}
      </Animated.View>,
    );
  } else {
    const incoming = slide.to === routeKey ? children : null;
    const rise = { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] };
    const drop = { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }] };
    // The page underneath recedes a shade as it is covered and comes
    // forward as it is uncovered: depth by a tone, not a shadow.
    const dimming = { opacity: t.interpolate({ inputRange: [0, 1], outputRange: slide.back ? [0.9, 1] : [1, 0.9] }) };
    if (slide.back) {
      layers.push(
        <Animated.View key={slide.to} style={[styles.layer, dimming]}>
          {incoming}
        </Animated.View>,
        <Animated.View key={slide.from} style={[styles.layer, styles.sheet, drop]}>
          {slide.fromNode}
        </Animated.View>,
      );
    } else {
      layers.push(
        <Animated.View key={slide.from} style={[styles.layer, dimming]}>
          {slide.fromNode}
        </Animated.View>,
        <Animated.View key={slide.to} style={[styles.layer, styles.sheet, rise]}>
          {incoming}
        </Animated.View>,
      );
    }
  }
  return <View style={styles.fill}>{layers}</View>;
}

const styles = themedStyles(() => ({
  fill: { flex: 1, backgroundColor: theme.colors.background },
  layer: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.background },
  /** The sliding page: its top corners rounded and ruled, a sheet laid
   * over the one beneath. */
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderStrong },
}));

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { textScale } from './Text';;
import Reanimated, { cancelAnimation, Easing as Curve, interpolateColor, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import { ACTS, actProgress, easeInOut, easeOut, letterProgress, OCHRE, tilePress, TOTAL_MS } from './launchChoreography';
import { curve } from '../theme/motion';

export interface LaunchSequenceProps {
  /** Whether the app behind this has finished loading. The sequence always
   * plays its full beat, but it will hold on the finished tile rather than
   * hand off to a half-loaded screen. */
  readonly appReady: boolean;
  /** Called once, when the name has landed and the tile is at rest: the
   * still moment to build the screen behind it. */
  readonly onSettled?: () => void;
  /** Called once, when the tile starts lifting away: Home begins placing
   * its own pieces under it then, so the two read as one movement. */
  readonly onHandoff?: () => void;
  /** Called once, when the sequence is over and the layer can unmount. */
  readonly onDone: () => void;
}

const WORDMARK = 'TESSELLATUM';

/** The mark's layers, as the icon draws them (`tools/make_icon.py`). */
const GROUND = require('../assets/brand/mark-ground.png');
const GEM = require('../assets/brand/mark-gem.png');
/** The four tiles, in the order they land: top left, bottom left, bottom
 * right, then the top right one, lifted - each with the way it flies in. */
const TILES = [
  { source: require('../assets/brand/mark-tile-0.png'), from: [-1, -1], spin: -16 },
  { source: require('../assets/brand/mark-tile-1.png'), from: [-1, 1], spin: 14 },
  { source: require('../assets/brand/mark-tile-2.png'), from: [1, 1], spin: -12 },
  { source: require('../assets/brand/mark-tile-3.png'), from: [1, -1], spin: 18 },
] as const;
const TILE_STAGGER_MS = 90;
const TILE_FLIGHT_MS = 360;
/** The gem drops in as the last tile seats. */
const GEM_IN = { start: ACTS.assemble.start + 3 * TILE_STAGGER_MS + TILE_FLIGHT_MS - 120, end: ACTS.assemble.start + 3 * TILE_STAGGER_MS + TILE_FLIGHT_MS + 260 } as const;

/** Out past its mark and back: a tile landing with a little give. */
function overshoot(t: number): number {
  'worklet';
  const c = 1.55;
  const x = t - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}
const LETTERS = WORDMARK.split('');

/** The loading bar under the name: in once the tile has landed. */
const BAR_IN = { start: ACTS.tileIn.end - 120, end: ACTS.tileIn.end + 220 } as const;
const BAR_W = 128;
/** Once faded, the layer stays (invisible, letting touches through) this
 * long before it unmounts: taking its canvas down froze Home's arrival
 * midway. By then Home's pieces are all placed. */
const LINGER_MS = 800;

/**
 * The app's mark, building itself.
 *
 * The plum ground rises into place, the icon's four glazed tiles fly in
 * from their corners and land each with its share of the star, the gold
 * gem drops onto the meeting of the four and the mark gives once as it
 * seats, the wordmark rolls up letter by letter into the name, and the
 * mark lifts away to Home. The layers are the icon's own renders
 * (`tools/make_icon.py`); the acts live in `launchChoreography.ts`.
 *
 * Every frame of it runs on the UI thread, off one shared clock: a cold
 * start is exactly when the JS thread is busiest (building Home behind
 * this layer), and a sequence redrawn from React state stuttered there.
 * JS only swaps the rolling letters' glyphs, which can lag a frame
 * without anything visibly catching.
 *
 * It sits on the app's own paper colour, which is also what the native
 * launch screen is set to, so there is no flash between the two. A tap
 * anywhere skips it, and under reduced motion it degrades to a short
 * cross-fade.
 */
export function LaunchSequence({ appReady, onSettled, onHandoff, onDone }: LaunchSequenceProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  /** Milliseconds into the sequence. Runs to the handoff and holds there
   * until the app behind is ready, then runs out. */
  const t = useSharedValue(reducedMotion ? TOTAL_MS : 0);
  const [atRest, setAtRest] = useState(reducedMotion);
  const stoppedRef = useRef(reducedMotion);
  const settledRef = useRef(false);
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [onSettled]);

  useEffect(() => {
    const settleTimer = setTimeout(settle, reducedMotion ? 0 : ACTS.wordmark.end);
    if (reducedMotion) return () => clearTimeout(settleTimer);
    t.value = withTiming(ACTS.handoff.start, { duration: ACTS.handoff.start, easing: Curve.linear }, finished => {
      if (finished) scheduleOnRN(setAtRest, true);
    });
    return () => clearTimeout(settleTimer);
    // Once, on mount: this is the whole sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const side = Math.min(width, height) * 0.46;
  const half = side / 2;
  /** Room under the mark, for its tiles' shadows, before the name. */
  const lip = Math.max(5, side * 0.04);
  const cx = width / 2;
  const cy = height * 0.42;

  // Gone in the first part of the hand-off, before Home's pieces arrive,
  // so the mark never hangs half-faded over them.
  const markStyle = useAnimatedStyle(() => {
    const tile = easeOut(actProgress(t.value, ACTS.tileIn));
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    // The whole mark gives once as the gem seats.
    const press = tilePress(t.value) * 0.035;
    return {
      opacity: tile * (1 - Math.min(1, handoff * 1.7)),
      transform: [{ translateY: (1 - tile) * 18 - handoff * 26 }, { scale: (0.86 + 0.14 * tile + 0.05 * handoff) * (1 - press) }],
    };
  });

  // The loading bar under the name. It fills toward most of the way as the
  // mark builds and the name sets, and finishes only once the app behind
  // is ready - the clock does not pass the handoff until it is - so it is
  // a true account of the wait, not a decoration.
  const barTrackStyle = useAnimatedStyle(() => {
    const shown = easeOut(actProgress(t.value, BAR_IN));
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    return { opacity: shown * (1 - handoff) };
  });
  const barFillStyle = useAnimatedStyle(() => {
    const loading = easeOut(actProgress(t.value, { start: ACTS.tileIn.start, end: ACTS.handoff.start })) * 0.86;
    const finishing = easeOut(actProgress(t.value, { start: ACTS.handoff.start, end: ACTS.handoff.start + 180 })) * 0.14;
    const p = loading + finishing;
    return { transform: [{ translateX: (-BAR_W / 2) * (1 - p) }, { scaleX: Math.max(0.001, p) }] };
  });

  // The layer's own fade, on the native driver.
  const cover = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    // Hold on the assembled tile until the app behind is actually ready -
    // handing off to a screen still resolving its own storage read is the
    // one thing that would make this feel like a loading spinner.
    if (finishedRef.current || !atRest || !appReady) return;
    finishedRef.current = true;
    onHandoff?.();
    const duration = ACTS.handoff.end - ACTS.handoff.start;
    if (!reducedMotion) t.value = withTiming(TOTAL_MS, { duration, easing: Curve.linear });
    Animated.timing(cover, {
      toValue: 0,
      duration,
      easing: curve.glide,
      useNativeDriver: true,
    }).start(() => {
      setFaded(true);
      setTimeout(onDone, LINGER_MS);
    });
  }, [atRest, appReady, reducedMotion, cover, onDone, onHandoff, t]);

  const skip = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimation(t);
    t.value = Math.max(t.value, ACTS.handoff.start);
    setAtRest(true);
    settle();
  }, [t, settle]);

  return (
    <Animated.View
      collapsable={false}
      pointerEvents={faded ? 'none' : 'auto'}
      style={[
        StyleSheet.absoluteFill,
        styles.layer,
        { opacity: cover, transform: [{ scale: cover.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] },
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip the opening animation"
      >
        {/* The mark building itself from the icon's own layers: the
            ground rises, the four tiles fly in from their corners and land
            with their shares of the star, and the gem drops in last. */}
        <Reanimated.View pointerEvents="none" style={[styles.mark, { left: cx - half, top: cy - half, width: side, height: side }, markStyle]}>
          <Image source={GROUND} style={styles.layerFill} fadeDuration={0} />
          {TILES.map((tile, i) => (
            <TileLayer key={i} index={i} source={tile.source} from={tile.from} spin={tile.spin} side={side} t={t} />
          ))}
          <GemLayer side={side} t={t} />
        </Reanimated.View>

        {/* RN text, not Skia: no Skia font is bundled in this app. */}
        <View style={[styles.wordmarkRow, { top: cy + half + lip + theme.spacing.xl }]} pointerEvents="none">
          {LETTERS.map((ch, i) => (
            <Letter key={i} letter={ch} index={i} t={t} />
          ))}
        </View>
        <Reanimated.View
          style={[styles.barTrack, { top: cy + half + lip + theme.spacing.xl + theme.typography.sizes.headline * 1.7 }, barTrackStyle]}
          pointerEvents="none"
        >
          <Reanimated.View style={[styles.barFill, barFillStyle]} />
        </Reanimated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * One letter of the name, set on the UI thread: it rises into its place,
 * a touch small and in pale ink, and settles at full size as it darkens
 * to ink. (The letters used to roll through others on a JS timer, which
 * re-rendered the row thirty times a second while Home was being built
 * behind it, and stuttered on exactly the phones that most needed it not
 * to.)
 */
function Letter({ letter, index, t }: { letter: string; index: number; t: SharedValue<number> }): React.JSX.Element {
  const pale = theme.colors.textTertiary;
  const ink = theme.colors.textPrimary;
  const style = useAnimatedStyle(() => {
    const arrive = letterProgress(t.value, index, LETTERS.length);
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    // Leaving, the letters lift and fade one after another, left to right.
    const leave = Math.min(1, Math.max(0, handoff * 1.6 - (index / LETTERS.length) * 0.6));
    const shown = Math.min(1, arrive * 1.8) * (1 - leave);
    return {
      opacity: shown,
      color: interpolateColor(arrive, [0.35, 1], [pale, ink]),
      transform: [{ translateY: leave > 0 ? -leave * 10 : (1 - arrive) * 14 }, { scale: 0.9 + 0.1 * arrive }],
    };
  });
  return (
    <Reanimated.Text maxFontSizeMultiplier={textScale()} style={[styles.wordmark, style]}>
      {letter}
    </Reanimated.Text>
  );
}

/** One tile of the mark, flying in from its corner and landing. */
function TileLayer({ index, source, from, spin, side, t }: { index: number; source: number; from: readonly number[]; spin: number; side: number; t: SharedValue<number> }): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const start = ACTS.assemble.start + index * TILE_STAGGER_MS;
    const p = Math.min(1, Math.max(0, (t.value - start) / TILE_FLIGHT_MS));
    const land = overshoot(p);
    const away = 1 - land;
    return {
      opacity: Math.min(1, p * 3),
      transform: [
        { translateX: from[0] * side * 0.42 * away },
        { translateY: from[1] * side * 0.42 * away },
        { rotate: `${spin * away}deg` },
        { scale: 0.72 + 0.28 * land },
      ],
    };
  });
  return (
    <Reanimated.View style={[styles.layerFill, style]}>
      <Image source={source} style={styles.layerFill} fadeDuration={0} />
    </Reanimated.View>
  );
}

/** The gold gem, dropping onto the meeting of the four as the last lands. */
function GemLayer({ side, t }: { side: number; t: SharedValue<number> }): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const p = actProgress(t.value, GEM_IN);
    const land = overshoot(p);
    return {
      opacity: Math.min(1, p * 4),
      transform: [{ translateY: -(1 - Math.min(1, land)) * side * 0.12 }, { scale: Math.max(0, 0.3 + 0.7 * land) }],
    };
  });
  return (
    <Reanimated.View style={[styles.layerFill, style]}>
      <Image source={GEM} style={styles.layerFill} fadeDuration={0} />
    </Reanimated.View>
  );
}

const styles = themedStyles(() => ({
  layer: {
    backgroundColor: theme.colors.background,
    zIndex: 100,
  },
  mark: { position: 'absolute' },
  layerFill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  wordmarkRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  barTrack: { position: 'absolute', left: '50%', width: BAR_W, marginLeft: -BAR_W / 2, height: 3, borderRadius: 1.5, overflow: 'hidden', backgroundColor: theme.colors.border },
  barFill: { width: BAR_W, height: 3, borderRadius: 1.5, backgroundColor: OCHRE },
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: theme.typography.tracking.wordmark,
    color: theme.colors.textPrimary,
  },
}));


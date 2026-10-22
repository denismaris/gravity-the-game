import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MAX_TEXT_SCALE } from './Text';
import Reanimated, { cancelAnimation, Easing as Curve, interpolateColor, SharedValue, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Canvas, Group, Path, RoundedRect, rect, rrect, Skia } from '@shopify/react-native-skia';
import { shade, useReducedMotion } from '../game/rendering';
import { theme, themedStyles } from '../theme';
import {
  ACTS,
  actProgress,
  easeInOut,
  easeOut,
  launchPieces,
  LaunchPiece,
  letterProgress,
  OCHRE,
  pieceMoveAt,
  pieceOpacity,
  pieceProgress,
  sheenBandPoints,
  sheenOpacity,
  sheenTravel,
  tilePress,
  TOTAL_MS,
} from './launchChoreography';
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
 * A tessera rises into place, eighteen pieces of tilework slide in and
 * lock into the star-and-cross of the app icon, the tile gives once as
 * the heart seats, the wordmark rolls up letter by letter into the name,
 * and the tile lifts away to Home. Timing and geometry live in
 * `launchChoreography.ts`; this file is only the rendering.
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
  const pieces = useMemo(() => launchPieces(), []);

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
  const radius = side * 0.225;
  /** The tile's lip: the darker edge below it that every card in the app
   * stands on, and that it presses into as the heart seats. */
  const lip = Math.max(5, side * 0.04);
  const cx = width / 2;
  const cy = height * 0.42;

  const tileTransform = useDerivedValue(() => {
    const tile = easeOut(actProgress(t.value, ACTS.tileIn));
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    return [
      { translateX: cx },
      // Arriving, it rises a little into place; leaving, it lifts up and
      // away as it fades - a gentle rise, not a zoom at the viewer.
      { translateY: cy + (1 - tile) * 18 - handoff * 26 },
      { scale: 0.86 + 0.14 * tile + 0.05 * handoff },
    ];
  });
  // Gone in the first part of the hand-off, before Home's pieces arrive,
  // so the tile never hangs half-faded over them.
  const tileOpacity = useDerivedValue(() => easeOut(actProgress(t.value, ACTS.tileIn)) * (1 - Math.min(1, easeInOut(actProgress(t.value, ACTS.handoff)) * 1.7)));
  const faceTransform = useDerivedValue(() => [{ translateY: tilePress(t.value) * lip * 0.6 }]);

  // Square, not rounded: the sheen only ever brushes a corner while it is
  // fading in or out, not worth a hand-written arc path.
  const tileClipPath = useMemo(() => `M ${-half} ${-half} L ${half} ${-half} L ${half} ${half} L ${-half} ${half} Z`, [half]);
  // The pieces are clipped to the true rounded silhouette: they slide in
  // from under the tile's edge.
  const tileClipRRect = useMemo(() => rrect(rect(-half, -half, side, side), radius, radius), [half, side, radius]);
  const sheenPath = useDerivedValue(() => {
    const points = sheenBandPoints(sheenTravel(t.value));
    let d = '';
    for (let i = 0; i < points.length; i += 1) d += `${i === 0 ? 'M' : 'L'} ${points[i][0] * half} ${points[i][1] * half} `;
    return `${d}Z`;
  });
  const sheen = useDerivedValue(() => sheenOpacity(t.value));

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
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={tileTransform} opacity={tileOpacity}>
            <RoundedRect x={-half} y={-half + lip} width={side} height={side} r={radius} color={shade(theme.colors.brandTile, 0.6)} />
            <Group transform={faceTransform}>
              <RoundedRect x={-half} y={-half} width={side} height={side} r={radius} color={theme.colors.brandTile} />
              <Group clip={tileClipRRect}>
                {pieces.map((piece, i) => (
                  <Piece key={i} piece={piece} half={half} t={t} />
                ))}
              </Group>
              {/* The glow: once the star is built, the same diagonal light
                  sweep every completion card plays once it has settled. */}
              <Group clip={tileClipPath}>
                <Path path={sheenPath} color="rgba(255,255,255,0.55)" opacity={sheen} />
              </Group>
            </Group>
          </Group>
        </Canvas>

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
    <Reanimated.Text maxFontSizeMultiplier={MAX_TEXT_SCALE} style={[styles.wordmark, style]}>
      {letter}
    </Reanimated.Text>
  );
}

/**
 * One piece of tilework, sliding in along its own vector and turning
 * upright about its own centre as it lands. Its outline is built once;
 * each frame only moves it (see `pieceMoveAt`), on the UI thread.
 */
function Piece({ piece, half, t }: { piece: LaunchPiece; half: number; t: SharedValue<number> }): React.JSX.Element {
  const path = useMemo(() => {
    const d = piece.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x * half} ${y * half}`).join(' ');
    return Skia.Path.MakeFromSVGString(`${d} Z`) ?? Skia.Path.Make();
  }, [piece, half]);
  const transform = useDerivedValue(() => {
    const m = pieceMoveAt(piece, pieceProgress(t.value, piece));
    return [{ translateX: m.x * half }, { translateY: m.y * half }, { rotate: m.rotate }, { scale: m.scale }, { translateX: -m.cx * half }, { translateY: -m.cy * half }];
  });
  const opacity = useDerivedValue(() => {
    const progress = pieceProgress(t.value, piece);
    return progress <= 0 ? 0 : pieceOpacity(progress);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} color={piece.color} />
    </Group>
  );
}

const styles = themedStyles(() => ({
  layer: {
    backgroundColor: theme.colors.background,
    zIndex: 100,
  },
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


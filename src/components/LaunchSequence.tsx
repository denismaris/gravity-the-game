import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Reanimated, { cancelAnimation, Easing as Curve, SharedValue, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Canvas, Group, Path, RoundedRect, rect, rrect } from '@shopify/react-native-skia';
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
  pieceOpacity,
  piecePointsAt,
  pieceProgress,
  rollingGlyph,
  sheenBandPoints,
  sheenOpacity,
  sheenTravel,
  tilePress,
  TOTAL_MS,
} from './launchChoreography';

export interface LaunchSequenceProps {
  /** Whether the app behind this has finished loading. The sequence always
   * plays its full beat, but it will hold on the finished tile rather than
   * hand off to a half-loaded screen. */
  readonly appReady: boolean;
  /** Called once, when the sequence is over and the layer can unmount. */
  readonly onDone: () => void;
}

const WORDMARK = 'TESSELLATUM';
const LETTERS = WORDMARK.split('');

/** The short ochre rule drawing out under the name once it has set - the
 * same closing stroke the finish card puts under "Solved". */
const RULE = { start: ACTS.wordmark.end - 220, end: ACTS.handoff.start - 20 } as const;

const landedGlyphs = (): ReadonlyArray<{ glyph: string; landed: boolean }> => LETTERS.map(glyph => ({ glyph, landed: true }));

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
export function LaunchSequence({ appReady, onDone }: LaunchSequenceProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const pieces = useMemo(() => launchPieces(), []);

  /** Milliseconds into the sequence. Runs to the handoff and holds there
   * until the app behind is ready, then runs out. */
  const t = useSharedValue(reducedMotion ? TOTAL_MS : 0);
  const [atRest, setAtRest] = useState(reducedMotion);
  const [glyphs, setGlyphs] = useState(() => (reducedMotion ? landedGlyphs() : LETTERS.map((ch, i) => rollingGlyph(ch, i, 0))));
  const stoppedRef = useRef(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withTiming(ACTS.handoff.start, { duration: ACTS.handoff.start, easing: Curve.linear }, finished => {
      if (finished) scheduleOnRN(setAtRest, true);
    });
    // The rolling letters: only the glyphs, and only when one changes.
    const began = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - began;
      if (stoppedRef.current || elapsed >= ACTS.wordmark.end) {
        clearInterval(timer);
        setGlyphs(landedGlyphs());
        return;
      }
      const next = LETTERS.map((ch, i) => rollingGlyph(ch, i, letterProgress(elapsed, i, LETTERS.length)));
      setGlyphs(prev => (prev.every((g, i) => g.glyph === next[i].glyph && g.landed === next[i].landed) ? prev : next));
    }, 32);
    return () => clearInterval(timer);
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
  const tileOpacity = useDerivedValue(() => easeOut(actProgress(t.value, ACTS.tileIn)) * (1 - easeInOut(actProgress(t.value, ACTS.handoff))));
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

  const ruleStyle = useAnimatedStyle(() => {
    const drawn = easeOut(actProgress(t.value, RULE));
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    return { opacity: drawn > 0 ? 1 - handoff : 0, transform: [{ scaleX: drawn }] };
  });

  // The layer's own fade, on the native driver.
  const cover = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  useEffect(() => {
    // Hold on the assembled tile until the app behind is actually ready -
    // handing off to a screen still resolving its own storage read is the
    // one thing that would make this feel like a loading spinner.
    if (finishedRef.current || !atRest || !appReady) return;
    finishedRef.current = true;
    const duration = ACTS.handoff.end - ACTS.handoff.start;
    if (!reducedMotion) t.value = withTiming(TOTAL_MS, { duration, easing: Curve.linear });
    Animated.timing(cover, {
      toValue: 0,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [atRest, appReady, reducedMotion, cover, onDone, t]);

  const skip = useCallback(() => {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    cancelAnimation(t);
    t.value = Math.max(t.value, ACTS.handoff.start);
    setGlyphs(landedGlyphs());
    setAtRest(true);
  }, [t]);

  return (
    <Animated.View
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
            <Letter key={i} letter={ch} index={i} glyph={glyphs[i].glyph} landed={glyphs[i].landed} t={t} />
          ))}
        </View>
        <Reanimated.View
          style={[styles.rule, { top: cy + half + lip + theme.spacing.xl + theme.typography.sizes.headline * 1.45 }, ruleStyle]}
          pointerEvents="none"
        />
      </Pressable>
    </Animated.View>
  );
}

/**
 * One letter of the name. The real letter holds its space, invisibly, so
 * the row never shifts while a narrower or wider one rolls over it.
 */
function Letter({ letter, index, glyph, landed, t }: { letter: string; index: number; glyph: string; landed: boolean; t: SharedValue<number> }): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const arrive = letterProgress(t.value, index, LETTERS.length);
    const handoff = easeInOut(actProgress(t.value, ACTS.handoff));
    // Leaving, the letters lift and fade one after another, left to right.
    const leave = Math.min(1, Math.max(0, handoff * 1.6 - (index / LETTERS.length) * 0.6));
    const shown = arrive * (1 - leave);
    return { opacity: shown, transform: [{ translateY: leave > 0 ? -leave * 10 : (1 - arrive) * 16 }] };
  });
  return (
    <View>
      <Text style={[styles.wordmark, styles.holder]}>{letter}</Text>
      <Reanimated.Text style={[styles.wordmark, styles.overlay, !landed && styles.rolling, style]}>{glyph}</Reanimated.Text>
    </View>
  );
}

/**
 * One piece of tilework, sliding in along its own vector and turning
 * upright about its own centre as it lands (see `piecePointsAt`), all of
 * it worked out on the UI thread each frame.
 */
function Piece({ piece, half, t }: { piece: LaunchPiece; half: number; t: SharedValue<number> }): React.JSX.Element {
  const path = useDerivedValue(() => {
    const progress = pieceProgress(t.value, piece);
    if (progress <= 0) return 'M 0 0 Z';
    const points = piecePointsAt(piece, progress);
    let d = '';
    for (let i = 0; i < points.length; i += 1) d += `${i === 0 ? 'M' : 'L'} ${points[i][0] * half} ${points[i][1] * half} `;
    return `${d}Z`;
  });
  const opacity = useDerivedValue(() => pieceOpacity(pieceProgress(t.value, piece)));
  return <Path path={path} color={piece.color} opacity={opacity} />;
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
  holder: { opacity: 0 },
  overlay: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  /** Rolling letters are set lighter; each darkens to ink as it lands. */
  rolling: { color: theme.colors.textTertiary },
  rule: { position: 'absolute', alignSelf: 'center', left: '50%', width: 40, marginLeft: -20, height: 2.5, borderRadius: 1.25, backgroundColor: OCHRE },
  wordmark: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: theme.typography.tracking.wordmark,
    color: theme.colors.textPrimary,
  },
}));

